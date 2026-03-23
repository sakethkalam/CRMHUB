from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_

from auth import get_current_user
from database import get_db
from models import Account, Activity, Contact, User, UserRole
from permissions import ROLE_RANK, require_role
from schemas import ActivityResponse, ContactCreate, ContactUpdate, ContactResponse
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

    for key, value in contact_in.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)

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
    await db.delete(contact)
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
