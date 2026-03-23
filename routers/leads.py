from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Account, Contact, Lead, LeadSource, LeadStatus, Opportunity, OpportunityStage, User
from schemas import (
    LeadConvertRequest,
    LeadConvertResponse,
    LeadCreate,
    LeadRead,
    LeadUpdate,
)

router = APIRouter(prefix="/leads", tags=["Leads"])


def _get_own_lead_query(lead_id: int, owner_id: int):
    return select(Lead).where(Lead.id == lead_id, Lead.owner_id == owner_id)


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[LeadRead])
async def list_leads(
    status: LeadStatus | None = Query(None, description="Filter by status"),
    lead_source: LeadSource | None = Query(None, description="Filter by lead source"),
    owner_id: int | None = Query(None, description="Filter by owner (admin use)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List leads owned by the current user, with optional filters."""
    query = select(Lead).where(Lead.owner_id == current_user.id)

    if status is not None:
        query = query.where(Lead.status == status)
    if lead_source is not None:
        query = query.where(Lead.lead_source == lead_source)
    if owner_id is not None:
        query = query.where(Lead.owner_id == owner_id)

    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------
@router.post("/", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead_in: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new lead owned by the logged-in user."""
    new_lead = Lead(**lead_in.model_dump(), owner_id=current_user.id)
    db.add(new_lead)
    await db.commit()
    await db.refresh(new_lead)
    return new_lead


# ---------------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------------
@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(_get_own_lead_query(lead_id, current_user.id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


# ---------------------------------------------------------------------------
# UPDATE (PATCH)
# ---------------------------------------------------------------------------
@router.patch("/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: int,
    lead_in: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(_get_own_lead_query(lead_id, current_user.id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    for key, value in lead_in.model_dump(exclude_unset=True).items():
        setattr(lead, key, value)

    await db.commit()
    await db.refresh(lead)
    return lead


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------
@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(_get_own_lead_query(lead_id, current_user.id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    await db.delete(lead)
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
    current_user: User = Depends(get_current_user),
):
    """
    Atomically convert a lead into an Account + Contact + (optionally) Opportunity.

    - Reuses an existing Account if one with a matching name is found.
    - All three records are linked back on the lead row.
    - Returns 400 if the lead is already converted.
    """
    result = await db.execute(_get_own_lead_query(lead_id, current_user.id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

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
        await db.flush()  # populate account.id without committing

    # --- Contact ---
    contact = Contact(
        first_name=convert_in.contact_first_name or lead.first_name,
        last_name=convert_in.contact_last_name or lead.last_name,
        email=lead.email,
        phone=lead.phone,
        account_id=account.id,
    )
    db.add(contact)
    await db.flush()  # populate contact.id

    # --- Opportunity (optional — only created when a name is supplied) ---
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
        await db.flush()  # populate opportunity.id

    # --- Mark lead as converted ---
    lead.is_converted = True
    lead.converted_at = datetime.now(timezone.utc)
    lead.status = LeadStatus.CONVERTED
    lead.converted_account_id = account.id
    lead.converted_contact_id = contact.id
    lead.converted_opportunity_id = opportunity.id if opportunity else None

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
