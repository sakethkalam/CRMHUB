from datetime import datetime, timezone
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Account, ForecastCategory, Opportunity, OpportunityStage, User, UserRole
from permissions import ROLE_RANK, require_role
from schemas import OpportunityCreate, OpportunityUpdate, OpportunityStageUpdate, OpportunityResponse

router = APIRouter(prefix="/opportunities", tags=["Opportunities & Pipeline"])


# ---------------------------------------------------------------------------
# Role helpers
# ---------------------------------------------------------------------------

def _rank(user: User) -> int:
    role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return ROLE_RANK.get(role, 0)


def _is_manager_or_above(user: User) -> bool:
    return _rank(user) >= ROLE_RANK[UserRole.MANAGER]


def _accessible_account_ids(current_user: User):
    """Subquery for account IDs visible to the current user."""
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


async def _get_opportunity_or_403(opp_id: int, current_user: User, db: AsyncSession) -> Opportunity:
    """Fetch opportunity; verify access through its linked account."""
    result = await db.execute(select(Opportunity).where(Opportunity.id == opp_id))
    opp = result.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    if opp.account_id:
        await _verify_account_access(opp.account_id, current_user, db)
    return opp


# ---------------------------------------------------------------------------
# Analytics response models
# ---------------------------------------------------------------------------

class ForecastSummary(BaseModel):
    pipeline_total:  float
    best_case_total: float
    commit_total:    float
    closed_total:    float


class StageBreakdown(BaseModel):
    stage:           str
    count:           int
    total_amount:    float
    weighted_amount: float


class WinRateStats(BaseModel):
    total_closed:      int
    won:               int
    lost:              int
    win_rate_pct:      float
    avg_deal_size_won: float


# ---------------------------------------------------------------------------
# Helpers — date range bounds
# ---------------------------------------------------------------------------

def _quarter_bounds(year: int, quarter: int) -> tuple[datetime, datetime]:
    start_month = (quarter - 1) * 3 + 1
    end_month   = start_month + 2
    start = datetime(year, start_month, 1, tzinfo=timezone.utc)
    end   = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if end_month == 12 \
            else datetime(year, end_month + 1, 1, tzinfo=timezone.utc)
    return start, end


def _date_range_bounds(date_range: str | None) -> tuple[datetime | None, datetime | None]:
    if not date_range:
        return None, None
    now = datetime.now(timezone.utc)
    current_quarter = (now.month - 1) // 3 + 1
    if date_range == "current_quarter":
        return _quarter_bounds(now.year, current_quarter)
    if date_range == "next_quarter":
        nq = current_quarter + 1
        yr = now.year + (1 if nq > 4 else 0)
        return _quarter_bounds(yr, (nq - 1) % 4 + 1)
    if date_range == "this_year":
        return datetime(now.year, 1, 1, tzinfo=timezone.utc), datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    return None, None


# ---------------------------------------------------------------------------
# Analytics endpoints  (must appear before /{opp_id})
# ---------------------------------------------------------------------------

@router.get("/forecast/summary", response_model=ForecastSummary)
async def forecast_summary(
    owner_id: int | None = Query(None, description="Scope to a specific owner (Manager/Admin only)"),
    date_range: Literal["current_quarter", "next_quarter", "this_year"] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Totals grouped by forecast_category.
    - owner_id filter is only honoured for Manager/Admin; Sales Rep always sees own data.
    """
    if owner_id and _is_manager_or_above(current_user):
        acct_ids = select(Account.id).where(Account.owner_id == owner_id)
    else:
        acct_ids = _accessible_account_ids(current_user)

    range_start, range_end = _date_range_bounds(date_range)
    base = select(
        Opportunity.forecast_category,
        func.coalesce(func.sum(Opportunity.amount), 0).label("total"),
    ).where(Opportunity.account_id.in_(acct_ids))

    if range_start:
        base = base.where(Opportunity.expected_close_date >= range_start)
    if range_end:
        base = base.where(Opportunity.expected_close_date < range_end)

    rows = (await db.execute(base.group_by(Opportunity.forecast_category))).all()
    totals = {row.forecast_category: float(row.total) for row in rows}

    return ForecastSummary(
        pipeline_total= totals.get(ForecastCategory.PIPELINE,  totals.get("Pipeline",  0.0)),
        best_case_total=totals.get(ForecastCategory.BEST_CASE, totals.get("Best Case", 0.0)),
        commit_total=   totals.get(ForecastCategory.COMMIT,    totals.get("Commit",    0.0)),
        closed_total=   totals.get(ForecastCategory.CLOSED,    totals.get("Closed",    0.0)),
    )


@router.get("/pipeline/by-stage", response_model=List[StageBreakdown])
async def pipeline_by_stage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Count and weighted value per stage, scoped by the current user's role."""
    acct_ids = _accessible_account_ids(current_user)

    rows = (await db.execute(
        select(
            Opportunity.stage,
            func.count(Opportunity.id).label("count"),
            func.coalesce(func.sum(Opportunity.amount), 0).label("total_amount"),
            func.coalesce(
                func.sum(Opportunity.amount * Opportunity.probability / 100.0), 0
            ).label("weighted_amount"),
        )
        .where(Opportunity.account_id.in_(acct_ids))
        .group_by(Opportunity.stage)
    )).all()

    stage_order = [s.value for s in OpportunityStage]
    results = {
        row.stage if isinstance(row.stage, str) else row.stage.value: StageBreakdown(
            stage=row.stage if isinstance(row.stage, str) else row.stage.value,
            count=row.count,
            total_amount=round(float(row.total_amount), 2),
            weighted_amount=round(float(row.weighted_amount), 2),
        )
        for row in rows
    }
    return [results[s] for s in stage_order if s in results]


@router.get("/win-rate", response_model=WinRateStats)
async def win_rate(
    owner_id: int | None = Query(None, description="Scope to a specific owner (Manager/Admin only)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Win/loss stats for closed opportunities, scoped by the current user's role."""
    if owner_id and _is_manager_or_above(current_user):
        acct_ids = select(Account.id).where(Account.owner_id == owner_id)
    else:
        acct_ids = _accessible_account_ids(current_user)

    closed_stages = [OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST]
    rows = (await db.execute(
        select(
            Opportunity.stage,
            func.count(Opportunity.id).label("count"),
            func.coalesce(func.sum(Opportunity.amount), 0).label("total_amount"),
        )
        .where(
            Opportunity.account_id.in_(acct_ids),
            Opportunity.stage.in_(closed_stages),
        )
        .group_by(Opportunity.stage)
    )).all()

    won_count = won_total = lost_count = 0
    for row in rows:
        stage_val = row.stage if isinstance(row.stage, str) else row.stage.value
        if stage_val == "Closed Won":
            won_count = row.count
            won_total = float(row.total_amount)
        else:
            lost_count = row.count

    total_closed = won_count + lost_count
    return WinRateStats(
        total_closed=total_closed,
        won=won_count,
        lost=lost_count,
        win_rate_pct=round(won_count / total_closed * 100, 1) if total_closed else 0.0,
        avg_deal_size_won=round(won_total / won_count, 2) if won_count else 0.0,
    )


# ---------------------------------------------------------------------------
# Standard CRUD
# ---------------------------------------------------------------------------

@router.post("/", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    opp_in: OpportunityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Create an opportunity.
    If account_id is provided, the current user must have access to that account.
    """
    if opp_in.account_id:
        await _verify_account_access(opp_in.account_id, current_user, db)

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
    current_user: User = Depends(get_current_user),
):
    """
    List opportunities scoped by role:
    Admin → all; Manager → their region; Sales Rep → own accounts only.
    """
    acct_ids = _accessible_account_ids(current_user)
    query = select(Opportunity).where(Opportunity.account_id.in_(acct_ids))

    if account_id:
        query = query.where(Opportunity.account_id == account_id)
    if stage:
        query = query.where(Opportunity.stage == stage)

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{opp_id}", response_model=OpportunityResponse)
async def get_opportunity(
    opp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_opportunity_or_403(opp_id, current_user, db)


@router.put("/{opp_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opp_id: int,
    opp_in: OpportunityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    opp = await _get_opportunity_or_403(opp_id, current_user, db)

    if opp_in.account_id and opp_in.account_id != opp.account_id:
        await _verify_account_access(opp_in.account_id, current_user, db)

    for key, value in opp_in.model_dump(exclude_unset=True).items():
        setattr(opp, key, value)

    await db.commit()
    await db.refresh(opp)
    return opp


@router.patch("/{opp_id}/stage", response_model=OpportunityResponse)
async def update_opportunity_stage(
    opp_id: int,
    stage_in: OpportunityStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """Drag-and-drop stage update for the Kanban board."""
    opp = await _get_opportunity_or_403(opp_id, current_user, db)
    opp.stage = stage_in.stage
    if stage_in.close_reason is not None:
        opp.close_reason = stage_in.close_reason
    await db.commit()
    await db.refresh(opp)
    return opp


@router.delete("/{opp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(
    opp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    opp = await _get_opportunity_or_403(opp_id, current_user, db)
    await db.delete(opp)
    await db.commit()
    return None
