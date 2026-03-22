from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_

from database import get_db
from models import Contact, Account, User
from schemas import ContactCreate, ContactUpdate, ContactResponse
from auth import get_current_user
from typing import List

router = APIRouter(prefix="/contacts", tags=["Contacts"])


async def _verify_account_ownership(account_id: int, current_user: User, db: AsyncSession) -> None:
    """Raises 403 if the account doesn't belong to the current user."""
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to access this account")


async def _get_contact_or_403(contact_id: int, current_user: User, db: AsyncSession) -> Contact:
    """Fetch contact and verify ownership through its linked account."""
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.account_id:
        await _verify_account_ownership(contact.account_id, current_user, db)
    return contact


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    contact_in: ContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a contact. If account_id is provided, it must belong to the current user."""
    if contact_in.account_id:
        await _verify_account_ownership(contact_in.account_id, current_user, db)

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
    current_user: User = Depends(get_current_user)
):
    """List contacts linked to accounts owned by the current user."""
    user_account_ids = select(Account.id).where(Account.owner_id == current_user.id)
    query = select(Contact).where(Contact.account_id.in_(user_account_ids))

    if search:
        query = query.where(
            or_(
                Contact.first_name.ilike(f"%{search}%"),
                Contact.last_name.ilike(f"%{search}%"),
                Contact.email.ilike(f"%{search}%")
            )
        )

    if account_id:
        query = query.where(Contact.account_id == account_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await _get_contact_or_403(contact_id, current_user, db)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int,
    contact_in: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contact = await _get_contact_or_403(contact_id, current_user, db)

    # If changing account, verify the new account is also owned by current user
    if contact_in.account_id and contact_in.account_id != contact.account_id:
        await _verify_account_ownership(contact_in.account_id, current_user, db)

    update_data = contact_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contact, key, value)

    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contact = await _get_contact_or_403(contact_id, current_user, db)
    await db.delete(contact)
    await db.commit()
    return None
