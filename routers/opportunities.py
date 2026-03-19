from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import Opportunity, User, OpportunityStage
from schemas import OpportunityCreate, OpportunityUpdate, OpportunityStageUpdate, OpportunityResponse
from auth import get_current_user
from typing import List

router = APIRouter(prefix="/opportunities", tags=["Opportunities & Pipeline"])

@router.post("/", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    opp_in: OpportunityCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new sales opportunity in the pipeline"""
    new_opp = Opportunity(**opp_in.model_dump())
    db.add(new_opp)
    await db.commit()
    await db.refresh(new_opp)
    return new_opp

@router.get("/", response_model=List[OpportunityResponse])
async def list_opportunities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    account_id: int | None = Query(None, description="Filter by a specific Account ID"),
    stage: str | None = Query(None, description="Filter by pipeline stage (e.g., Prospecting, Closed Won)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all opportunities. Ideal for mapping a Kanban board to stage columns."""
    query = select(Opportunity)
    
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
    """Get a specific opportunity deal by ID"""
    result = await db.execute(select(Opportunity).where(Opportunity.id == opp_id))
    opp = result.scalar_one_or_none()
    
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
    return opp

@router.put("/{opp_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opp_id: int,
    opp_in: OpportunityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update general details like deal name, amount, or expected close date"""
    result = await db.execute(select(Opportunity).where(Opportunity.id == opp_id))
    opp = result.scalar_one_or_none()
    
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
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
    """
    Kanban Optimization Endpoint!
    Specifically designed for drag-and-drop actions on the React frontend.
    Only updates the stage of the opportunity to make the REST call ultra-fast.
    """
    result = await db.execute(select(Opportunity).where(Opportunity.id == opp_id))
    opp = result.scalar_one_or_none()
    
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
    opp.stage = stage_in.stage
    
    # Optional logical hooks: if stage hits "Closed Won", we could queue
    # an event to our Azure Service Bus for the SAP integration here!
    
    await db.commit()
    await db.refresh(opp)
    
    return opp

@router.delete("/{opp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(
    opp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an opportunity"""
    result = await db.execute(select(Opportunity).where(Opportunity.id == opp_id))
    opp = result.scalar_one_or_none()
    
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
    await db.delete(opp)
    await db.commit()
    return None
