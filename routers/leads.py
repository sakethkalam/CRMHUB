from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import insert as sa_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import (
    Account, Contact, Lead, LeadSource, LeadStatus,
    NotificationType, Opportunity, OpportunityStage,
    Product, ProductFamily,
    User, UserRole,
)
from services.audit_service import log_change, snapshot
from services.csv_import import ImportResult, RowError, parse_csv_bytes, validate_email
from services.notification_service import create_notification
from permissions import ROLE_RANK, require_role
from schemas import (
    LeadConvertRequest,
    LeadConvertResponse,
    LeadCreate,
    LeadRead,
    LeadUpdate,
)

router = APIRouter(prefix="/leads", tags=["Leads"])


# ---------------------------------------------------------------------------
# Role helpers
# ---------------------------------------------------------------------------

def _rank(user: User) -> int:
    role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return ROLE_RANK.get(role, 0)


def _is_manager_or_above(user: User) -> bool:
    return _rank(user) >= ROLE_RANK[UserRole.MANAGER]


def _apply_lead_scope(query, current_user: User):
    """
    Manager/Admin see all leads.
    Sales Rep / Read Only see only leads they own.
    """
    if _is_manager_or_above(current_user):
        return query
    return query.where(Lead.owner_id == current_user.id)


async def _get_lead(
    lead_id: int,
    current_user: User,
    db: AsyncSession,
    options: list | None = None,
) -> Lead:
    """Fetch lead with role-aware visibility; raises 404 if not visible.

    Pass ``options`` (e.g. ``[_product_opts()]``) to eager-load relationships
    in the same query.  Mutation endpoints call this without options and
    re-fetch after commit via ``_fetch_lead_loaded``.
    """
    q = _apply_lead_scope(select(Lead).where(Lead.id == lead_id), current_user)
    if options:
        q = q.options(*options)
    lead = (await db.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


# ---------------------------------------------------------------------------
# Product-loading helpers
# ---------------------------------------------------------------------------

def _product_opts():
    """selectinload chain: Lead.products → family → category."""
    return (
        selectinload(Lead.products)
        .selectinload(Product.family)
        .selectinload(ProductFamily.category)
    )


async def _fetch_lead_loaded(lead_id: int, db: AsyncSession) -> Lead:
    """Re-fetch a lead with products eagerly loaded (used after mutations)."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id).options(_product_opts())
    )
    return result.scalar_one()


async def _resolve_products(product_ids: list[int], db: AsyncSession) -> list[Product]:
    """Fetch active Product rows for the given IDs."""
    if not product_ids:
        return []
    result = await db.execute(
        select(Product).where(Product.id.in_(product_ids), Product.is_active == True)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# IMPORT  (must be before /{lead_id} routes so "import" isn't treated as an id)
# ---------------------------------------------------------------------------

_VALID_LEAD_SOURCES: dict[str, str] = {s.value.lower(): s.value for s in LeadSource}


@router.post("/import", response_model=ImportResult, status_code=status.HTTP_200_OK)
async def import_leads(
    file: UploadFile = File(..., description="CSV file with lead data"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Bulk-import leads from a CSV file.

    Required columns : first_name, last_name
    Optional columns : email, phone, company_name, job_title, lead_source

    Rows with a missing first_name or an invalid email are skipped and reported.
    Duplicate emails (within the file or against existing leads) are also skipped.
    """
    content = await file.read()
    try:
        parsed = parse_csv_bytes(content, required_columns={"first_name", "last_name"})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    errors:     list[RowError] = list(parsed.errors)  # seed with any row-limit errors
    valid_rows: list[dict]     = []
    skipped = 0

    # ── Per-row validation ──────────────────────────────────────────────────
    seen_emails: dict[str, int] = {}  # email → first row number (dedup within file)

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

        lead_source_raw = row.get("lead_source", "")
        lead_source = _VALID_LEAD_SOURCES.get(lead_source_raw.lower(), LeadSource.OTHER.value)

        valid_rows.append({
            "first_name":   first_name,
            "last_name":    last_name,
            "email":        email,
            "phone":        row.get("phone")        or None,
            "company_name": row.get("company_name") or None,
            "job_title":    row.get("job_title")    or None,
            "lead_source":  lead_source,
            "status":       LeadStatus.NEW.value,
            "is_converted": False,
            "owner_id":     current_user.id,
        })

    # ── Duplicate-email check against DB ────────────────────────────────────
    if seen_emails:
        existing = set(
            (await db.execute(
                select(Lead.email).where(Lead.email.in_(list(seen_emails.keys())))
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
        await db.execute(sa_insert(Lead), valid_rows)
        await db.commit()

    return ImportResult(imported=len(valid_rows), skipped=skipped, errors=errors)


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[LeadRead])
async def list_leads(
    status: LeadStatus | None = Query(None, description="Filter by status"),
    lead_source: LeadSource | None = Query(None, description="Filter by lead source"),
    owner_id: int | None = Query(None, description="Filter by owner (Manager/Admin only)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List leads scoped by role:
    Admin / Manager → all leads (optionally filtered by owner_id);
    Sales Rep → own leads only.
    """
    query = _apply_lead_scope(select(Lead), current_user).options(_product_opts())

    if status is not None:
        query = query.where(Lead.status == status)
    if lead_source is not None:
        query = query.where(Lead.lead_source == lead_source)
    # owner_id filter only respected when caller has Manager-or-above rank
    if owner_id is not None and _is_manager_or_above(current_user):
        query = query.where(Lead.owner_id == owner_id)

    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().unique().all()


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

@router.post("/", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead_in: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """Create a new lead owned by the logged-in user.
    If product_ids is provided, those active products are linked in the same transaction.
    """
    data = lead_in.model_dump()
    product_ids: list[int] = data.pop("product_ids")  # always present (default=[])

    new_lead = Lead(**data, owner_id=current_user.id)
    db.add(new_lead)
    await db.flush()

    if product_ids:
        new_lead.products = await _resolve_products(product_ids, db)

    await log_change(db, table_name="leads", record_id=new_lead.id,
                     action="CREATE", new_values=snapshot(new_lead),
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()

    return await _fetch_lead_loaded(new_lead.id, db)


# ---------------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------------

@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_lead(lead_id, current_user, db, options=[_product_opts()])


# ---------------------------------------------------------------------------
# UPDATE (PATCH)
# ---------------------------------------------------------------------------

@router.patch("/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: int,
    lead_in: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """Partial update — only the fields you send are changed (uses exclude_unset).
    Pass ``product_ids`` (even as ``[]``) to replace the entire products list.
    Omit ``product_ids`` entirely to leave existing products untouched.
    """
    lead = await _get_lead(lead_id, current_user, db)
    old = snapshot(lead)

    data = lead_in.model_dump(exclude_unset=True)
    product_ids = data.pop("product_ids", None)  # None = not sent → leave products unchanged

    for key, value in data.items():
        setattr(lead, key, value)

    if product_ids is not None:  # even [] means "clear all products"
        lead.products = await _resolve_products(product_ids, db)

    await log_change(db, table_name="leads", record_id=lead_id,
                     action="UPDATE", old_values=old, new_values=snapshot(lead),
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()

    return await _fetch_lead_loaded(lead_id, db)


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    lead = await _get_lead(lead_id, current_user, db)
    old = snapshot(lead)
    await db.delete(lead)
    await log_change(db, table_name="leads", record_id=lead_id,
                     action="DELETE", old_values=old,
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# CONVERT
# ---------------------------------------------------------------------------

@router.post("/{lead_id}/convert", response_model=LeadConvertResponse)
async def convert_lead(
    lead_id: int,
    convert_in: LeadConvertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Atomically convert a lead into an Account + Contact + (optionally) Opportunity.
    Sales Rep can only convert their own leads.
    Manager / Admin can convert any lead.
    """
    lead = await _get_lead(lead_id, current_user, db)

    if lead.is_converted:
        raise HTTPException(status_code=400, detail="Lead has already been converted")

    # --- Account ---
    account_name = convert_in.account_name or lead.company_name or f"{lead.first_name} {lead.last_name}"

    # Reuse existing account owned by this user with the same name
    acct_result = await db.execute(
        select(Account).where(
            Account.owner_id == current_user.id,
            Account.name == account_name,
        )
    )
    account = acct_result.scalar_one_or_none()

    if not account:
        account = Account(name=account_name, owner_id=current_user.id)
        db.add(account)
        await db.flush()

    # --- Contact ---
    contact = Contact(
        first_name=convert_in.contact_first_name or lead.first_name,
        last_name=convert_in.contact_last_name or lead.last_name,
        email=lead.email,
        phone=lead.phone,
        account_id=account.id,
    )
    db.add(contact)
    await db.flush()

    # --- Opportunity (optional) ---
    opportunity = None
    if convert_in.opportunity_name:
        opportunity = Opportunity(
            name=convert_in.opportunity_name,
            amount=convert_in.opportunity_amount,
            stage=OpportunityStage.PROSPECTING,
            expected_close_date=convert_in.opportunity_expected_close_date,
            account_id=account.id,
        )
        db.add(opportunity)
        await db.flush()

    # --- Mark lead converted ---
    old_lead = snapshot(lead)
    lead.is_converted = True
    lead.converted_at = datetime.now(timezone.utc)
    lead.status = LeadStatus.CONVERTED
    lead.converted_account_id = account.id
    lead.converted_contact_id = contact.id
    lead.converted_opportunity_id = opportunity.id if opportunity else None

    await log_change(db, table_name="leads", record_id=lead_id,
                     action="UPDATE", old_values=old_lead, new_values=snapshot(lead),
                     user_id=current_user.id, user_email=current_user.email)

    # Notify the lead owner (unless they did the conversion themselves)
    if lead.owner_id and lead.owner_id != current_user.id:
        await create_notification(
            db,
            user_id=lead.owner_id,
            type=NotificationType.LEAD_ASSIGNED,
            title=f"✅ Lead converted: {lead.first_name} {lead.last_name}",
            message=(
                f'{current_user.full_name or current_user.email} converted lead '
                f'"{lead.first_name} {lead.last_name}" into Account "{account_name}"'
                + (f' and Opportunity "{opportunity.name}"' if opportunity else "")
                + "."
            ),
            related_record_type="lead",
            related_record_id=lead.id,
        )

    await db.commit()

    return LeadConvertResponse(
        converted_account_id=account.id,
        converted_contact_id=contact.id,
        converted_opportunity_id=opportunity.id if opportunity else None,
        message=(
            f"Lead converted: Account '{account_name}', "
            f"Contact '{contact.first_name} {contact.last_name}'"
            + (f", Opportunity '{opportunity.name}'" if opportunity else "")
            + " created successfully."
        ),
    )
