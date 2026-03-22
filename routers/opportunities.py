from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import Opportunity, Account, User, OpportunityStage
from schemas import OpportunityCreate, OpportunityUpdate, OpportunityStageUpdate, OpportunityResponse
from auth import get_current_user
from typing import List

router = APIRouter(prefix="/opportunities", tags=["Opportunities & Pipeline"])


async def _verify_account_ownership(account_id: int, current_user: User, db: AsyncSession) -> None:
    """Raises 403 if the account doesn't belong to the current user."""
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to access this account")


async def _get_opportunity_or_403(opp_id: int, current_user: User, db: AsyncSession) -> Opportunity:
    """Fetch opportunity and verify ownership through its linked account."""
    result = await db.execute(select(Opportunity).where(Opportunity.id == opp_id))
    opp = result.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    if opp.account_id:
        await _verify_account_ownership(opp.account_id, current_user, db)
    return opp


@router.post("/", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    opp_in: OpportunityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create an opportunity. If account_id is provided, it must belong to the current user."""
    if opp_in.account_id:
        await _verify_account_ownership(opp_in.account_id, current_user, db)

    new_opp = Opportunity(**opp_in.model_dump())
    db.add(new_opp)
    await db.commit()
    await db.refresh(new_opp)
    return new_opp


@router.get("/", response_model=List[OpportunityResponse])
async def list_opportunities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    account_id: int | None = Query(None, description="Filter by Account ID"),
    stage: str | None = Query(None, description="Filter by pipeline stage"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List opportunities linked to accounts owned by the current user."""
    user_account_ids = select(Account.id).where(Account.owner_id == current_user.id)
    query = select(Opportunity).where(Opportunity.account_id.in_(user_account_ids))

    if account_id:
        query = query.where(Opportunity.account_id == account_id)
    if stage:
        query = query.where(Opportunity.stage == stage)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{opp_id}", response_model=OpportunityResponse)
async def get_opportunity(
    opp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await _get_opportunity_or_403(opp_id, current_user, db)


@router.put("/{opp_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opp_id: int,
    opp_in: OpportunityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    opp = await _get_opportunity_or_403(opp_id, current_user, db)

    if opp_in.account_id and opp_in.account_id != opp.account_id:
        await _verify_account_ownership(opp_in.account_id, current_user, db)

    update_data = opp_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(opp, key, value)

    await db.commit()
    await db.refresh(opp)
    return opp


@router.patch("/{opp_id}/stage", response_model=OpportunityResponse)
async def update_opportunity_stage(
    opp_id: int,
    stage_in: OpportunityStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Drag-and-drop stage update endpoint for the Kanban board."""
    opp = await _get_opportunity_or_403(opp_id, current_user, db)
    opp.stage = stage_in.stage
    await db.commit()
    await db.refresh(opp)
    return opp


@router.delete("/{opp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(
    opp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    opp = await _get_opportunity_or_403(opp_id, current_user, db)
    await db.delete(opp)
    await db.commit()
    return None
