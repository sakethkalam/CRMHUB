from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import insert as sa_insert, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Account, User, UserRole
from permissions import ROLE_RANK, require_role
from schemas import AccountCreate, AccountUpdate, AccountResponse
from services.audit_service import log_change, snapshot
from services.csv_import import ImportResult, RowError, parse_csv_bytes
from typing import List

router = APIRouter(prefix="/accounts", tags=["Accounts"])


# ---------------------------------------------------------------------------
# Role helpers
# ---------------------------------------------------------------------------

def _rank(user: User) -> int:
    role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return ROLE_RANK.get(role, 0)


def _is_manager_or_above(user: User) -> bool:
    return _rank(user) >= ROLE_RANK[UserRole.MANAGER]


def _apply_account_scope(query, current_user: User):
    """
    Narrow a query to accounts visible to current_user:
      Admin           → all accounts
      Manager         → accounts in their region (if set), otherwise all
      Sales Rep       → only accounts they own
      Read Only       → same as Sales Rep (read-only enforced elsewhere)
    """
    if _rank(current_user) >= ROLE_RANK[UserRole.ADMIN]:
        return query
    if _is_manager_or_above(current_user):
        if current_user.region:
            return query.where(Account.region == current_user.region)
        return query  # manager with no region assigned sees all
    return query.where(Account.owner_id == current_user.id)


async def _get_account(account_id: int, current_user: User, db: AsyncSession) -> Account:
    """Fetch account with role-aware visibility; raises 404 if not visible."""
    q = _apply_account_scope(
        select(Account).where(Account.id == account_id), current_user
    )
    account = (await db.execute(q)).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


# ---------------------------------------------------------------------------
# IMPORT  (before /{account_id} to avoid path-param ambiguity)
# ---------------------------------------------------------------------------

@router.post("/import", response_model=ImportResult, status_code=status.HTTP_200_OK)
async def import_accounts(
    file: UploadFile = File(..., description="CSV file with account data"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Bulk-import accounts from a CSV file.

    Required columns : name
    Optional columns : industry, website, region

    All imported accounts are owned by the authenticated user.
    Duplicate account names (case-insensitive, within the file) are skipped.
    """
    content = await file.read()
    try:
        parsed = parse_csv_bytes(content, required_columns={"name"})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    errors:     list[RowError] = list(parsed.errors)
    valid_rows: list[dict]     = []
    skipped = 0

    seen_names: dict[str, int] = {}  # lowercased name → first row number

    for i, row in enumerate(parsed.rows, start=1):
        name = row.get("name", "")

        if not name:
            errors.append(RowError(row=i, reason="name is required"))
            skipped += 1
            continue

        name_key = name.lower()
        if name_key in seen_names:
            errors.append(RowError(row=i, reason=f"Duplicate account name in file (first seen at row {seen_names[name_key]})"))
            skipped += 1
            continue
        seen_names[name_key] = i

        valid_rows.append({
            "name":     name,
            "industry": row.get("industry") or None,
            "website":  row.get("website")  or None,
            "region":   row.get("region")   or None,
            "owner_id": current_user.id,
        })

    # ── Bulk insert (accounts have no unique constraint, so no DB dedup needed) ──
    if valid_rows:
        await db.execute(sa_insert(Account), valid_rows)
        await db.commit()

    return ImportResult(imported=len(valid_rows), skipped=skipped, errors=errors)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_in: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),   # blocks Read Only
):
    """Create a new account; owner is set to the logged-in user."""
    new_account = Account(**account_in.model_dump(), owner_id=current_user.id)
    db.add(new_account)
    await db.flush()  # populate new_account.id before logging
    await log_change(db, table_name="accounts", record_id=new_account.id,
                     action="CREATE", new_values=snapshot(new_account),
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()
    await db.refresh(new_account)
    return new_account


@router.get("/", response_model=List[AccountResponse])
async def list_accounts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = Query(None, description="Search by name or industry"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List accounts scoped by role:
    Admin → all; Manager → their region; Sales Rep → own accounts only.
    """
    query = _apply_account_scope(select(Account), current_user)
    if search:
        query = query.where(
            or_(
                Account.name.ilike(f"%{search}%"),
                Account.industry.ilike(f"%{search}%"),
            )
        )
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_account(account_id, current_user, db)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    account_in: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Update an account.
    - Sales Rep: only accounts they own.
    - Manager / Admin: any account in their visibility scope.
    """
    account = await _get_account(account_id, current_user, db)
    old = snapshot(account)

    for key, value in account_in.model_dump(exclude_unset=True).items():
        setattr(account, key, value)

    await log_change(db, table_name="accounts", record_id=account_id,
                     action="UPDATE", old_values=old, new_values=snapshot(account),
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Delete an account.
    - Sales Rep: only accounts they own.
    - Manager / Admin: any account in their visibility scope.
    """
    account = await _get_account(account_id, current_user, db)
    old = snapshot(account)
    await db.delete(account)
    await log_change(db, table_name="accounts", record_id=account_id,
                     action="DELETE", old_values=old,
                     user_id=current_user.id, user_email=current_user.email)
    await db.commit()
    return None
