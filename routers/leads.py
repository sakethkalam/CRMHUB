from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Account, Contact, Lead, LeadSource, LeadStatus, Opportunity, OpportunityStage, User, UserRole
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


async def _get_lead(lead_id: int, current_user: User, db: AsyncSession) -> Lead:
    """Fetch lead with role-aware visibility; raises 404 if not visible."""
    q = _apply_lead_scope(select(Lead).where(Lead.id == lead_id), current_user)
    lead = (await db.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


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
    query = _apply_lead_scope(select(Lead), current_user)

    if status is not None:
        query = query.where(Lead.status == status)
    if lead_source is not None:
        query = query.where(Lead.lead_source == lead_source)
    # owner_id filter only respected when caller has Manager-or-above rank
    if owner_id is not None and _is_manager_or_above(current_user):
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
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
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
    return await _get_lead(lead_id, current_user, db)


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
    lead = await _get_lead(lead_id, current_user, db)

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
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    lead = await _get_lead(lead_id, current_user, db)
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
