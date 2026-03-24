from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import insert as sa_insert, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Account, Activity, Contact, User, UserRole
from permissions import ROLE_RANK, require_role
from schemas import ActivityResponse, ContactCreate, ContactUpdate, ContactResponse
from services.audit_service import log_change, snapshot
from services.csv_import import ImportResult, RowError, parse_csv_bytes, validate_email
from typing import List

router = APIRouter(prefix="/contacts", tags=["Contacts"])


# ---------------------------------------------------------------------------
# Role helpers (mirrors accounts.py)
# ---------------------------------------------------------------------------

def _rank(user: User) -> int:
    role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return ROLE_RANK.get(role, 0)


def _is_manager_or_above(user: User) -> bool:
    return _rank(user) >= ROLE_RANK[UserRole.MANAGER]


def _accessible_account_ids(current_user: User):
    """Subquery returning account IDs visible to current_user."""
    if _rank(current_user) >= ROLE_RANK[UserRole.ADMIN]:
        return select(Account.id)
    if _is_manager_or_above(current_user):
        if current_user.region:
            return select(Account.id).where(Account.region == current_user.region)
        return select(Account.id)
    return select(Account.id).where(Account.owner_id == current_user.id)


async def _verify_account_access(account_id: int, current_user: User, db: AsyncSession) -> None:
    """Raises 403 if current_user cannot access the given account."""
    acct_ids = _accessible_account_ids(current_user)
    result = await db.execute(
        select(Account.id).where(Account.id == account_id, Account.id.in_(acct_ids))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to access this account")


async def _get_contact_or_403(contact_id: int, current_user: User, db: AsyncSession) -> Contact:
    """Fetch contact; verify access through its linked account."""
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.account_id:
        await _verify_account_access(contact.account_id, current_user, db)
    return contact


# ---------------------------------------------------------------------------
# IMPORT  (before /{contact_id} to avoid path-param ambiguity)
# ---------------------------------------------------------------------------

@router.post("/import", response_model=ImportResult, status_code=status.HTTP_200_OK)
async def import_contacts(
    file: UploadFile = File(..., description="CSV file with contact data"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Bulk-import contacts from a CSV file.

    Required columns : first_name, last_name
    Optional columns : email, phone, account_id

    ``account_id`` must be an integer that belongs to an account the current
    user can access.  Rows with an unrecognised account_id are imported with
    no account linkage (not skipped).
    Duplicate emails (within the file or against existing contacts) are skipped.
    """
    content = await file.read()
    try:
        parsed = parse_csv_bytes(content, required_columns={"first_name", "last_name"})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    errors:     list[RowError] = list(parsed.errors)
    valid_rows: list[dict]     = []
    skipped = 0

    # Pre-load accessible account IDs so we can validate account_id values
    acct_id_subq = _accessible_account_ids(current_user)
    accessible_acct_ids: set[int] = set(
        (await db.execute(acct_id_subq)).scalars().all()
    )

    seen_emails: dict[str, int] = {}

    for i, row in enumerate(parsed.rows, start=1):
        first_name = row.get("first_name", "")
        last_name  = row.get("last_name",  "")
        email      = row.get("email",      "") or None

        if not first_name:
            errors.append(RowError(row=i, reason="first_name is required"))
            skipped += 1
            continue

        if email:
            if not validate_email(email):
                errors.append(RowError(row=i, reason=f"Invalid email format: {email!r}"))
                skipped += 1
                continue
            if email in seen_emails:
                errors.append(RowError(row=i, reason=f"Duplicate email in file (first seen at row {seen_emails[email]})"))
                skipped += 1
                continue
            seen_emails[email] = i

        # Resolve account_id — ignore invalid or inaccessible values
        account_id: int | None = None
        raw_acct = row.get("account_id", "").strip()
        if raw_acct:
            try:
                aid = int(raw_acct)
                if aid in accessible_acct_ids:
                    account_id = aid
                else:
                    errors.append(RowError(row=i, reason=f"account_id {aid} not found or not accessible — contact imported without account link"))
            except ValueError:
                errors.append(RowError(row=i, reason=f"account_id {raw_acct!r} is not a valid integer — contact imported without account link"))

        valid_rows.append({
            "first_name": first_name,
            "last_name":  last_name,
            "email":      email,
            "phone":      row.get("phone") or None,
            "account_id": account_id,
        })

    # ── Duplicate-email check against DB ────────────────────────────────────
    if seen_emails:
        existing = set(
            (await db.execute(
                select(Contact.email).where(Contact.email.in_(list(seen_emails.keys())))
            )).scalars().all()
        )
        if existing:
            kept = []
            for r in valid_rows:
                if r["email"] in existing:
                    errors.append(RowError(
                        row=seen_emails[r["email"]],
                        reason=f"Email already exists in database: {r['email']}",
                    ))
                    skipped += 1
                else:
                    kept.append(r)
            valid_rows = kept

    # ── Bulk insert ─────────────────────────────────────────────────────────
    if valid_rows:
        await db.execute(sa_insert(Contact), valid_rows)
        await db.commit()

    return ImportResult(imported=len(valid_rows), skipped=skipped, errors=errors)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    contact_in: ContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Create a contact.
    If account_id is provided, the current user must have access to that account.
    """
    if contact_in.account_id:
        await _verify_account_access(contact_in.account_id, current_user, db)

    new_contact = Contact(**contact_in.model_dump())
    db.add(new_contact)
    await db.flush()
    await log_change(db, table_name="contacts", record_id=new_contact.id,
                     action="CREATE", new_values=snapshot(new_contact),
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()
    await db.refresh(new_contact)
    return new_contact


@router.get("/", response_model=List[ContactResponse])
async def list_contacts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = Query(None, description="Search by name or email"),
    account_id: int | None = Query(None, description="Filter by Account ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List contacts scoped to accounts the current user can access:
    Admin → all; Manager → their region; Sales Rep → own accounts only.
    """
    acct_ids = _accessible_account_ids(current_user)
    query = select(Contact).where(Contact.account_id.in_(acct_ids))

    if search:
        query = query.where(
            or_(
                Contact.first_name.ilike(f"%{search}%"),
                Contact.last_name.ilike(f"%{search}%"),
                Contact.email.ilike(f"%{search}%"),
            )
        )
    if account_id:
        query = query.where(Contact.account_id == account_id)

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_contact_or_403(contact_id, current_user, db)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int,
    contact_in: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    contact = await _get_contact_or_403(contact_id, current_user, db)

    if contact_in.account_id and contact_in.account_id != contact.account_id:
        await _verify_account_access(contact_in.account_id, current_user, db)

    old = snapshot(contact)
    for key, value in contact_in.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)

    await log_change(db, table_name="contacts", record_id=contact_id,
                     action="UPDATE", old_values=old, new_values=snapshot(contact),
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    contact = await _get_contact_or_403(contact_id, current_user, db)
    old = snapshot(contact)
    await db.delete(contact)
    await log_change(db, table_name="contacts", record_id=contact_id,
                     action="DELETE", old_values=old,
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# GET /contacts/{contact_id}/email-history
# ---------------------------------------------------------------------------

@router.get(
    "/{contact_id}/email-history",
    response_model=List[ActivityResponse],
    summary="All outbound emails logged against this contact, newest first",
)
async def contact_email_history(
    contact_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns Activity records where ``type = 'Email'`` and
    ``contact_id = {contact_id}``, sorted by ``created_at DESC``.

    Access follows the same contact-visibility rules: the current user must
    have access to the contact's linked account (or be Manager/Admin).
    """
    # Verify the caller can see this contact at all
    await _get_contact_or_403(contact_id, current_user, db)

    rows = (await db.execute(
        select(Activity)
        .where(
            Activity.contact_id == contact_id,
            Activity.type == "Email",
        )
        .order_by(Activity.created_at.desc())
        .offset(skip)
        .limit(limit)
    )).scalars().all()

    return rows
