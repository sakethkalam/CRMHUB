"""
routers/reports.py — Management reporting endpoints.

All endpoints require Manager or Admin role.

Endpoints
---------
GET /reports/sales-summary      — opportunity pipeline stats for a date range
GET /reports/activity-summary   — activity counts by type per user
GET /reports/lead-funnel        — lead counts by status + conversion metrics
GET /reports/tasks-completion   — task completion / overdue rates
"""

from datetime import datetime, timedelta, timezone
from typing import List, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import (
    Account,
    Activity,
    Lead,
    LeadStatus,
    Opportunity,
    OpportunityStage,
    Task,
    TaskStatus,
    User,
    UserRole,
)
from permissions import require_role

router = APIRouter(prefix="/reports", tags=["Reports"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class TopAccount(BaseModel):
    name: str
    total_value: float


class SalesSummary(BaseModel):
    total_opportunities: int
    total_value: float
    won_value: float
    lost_value: float
    win_rate: float           # 0–100
    avg_deal_size: float      # average won deal size
    top_accounts: List[TopAccount]


class ActivityRow(BaseModel):
    user_id: int
    user_name: str | None
    call_count: int
    email_count: int
    meeting_count: int
    note_count: int
    other_count: int
    total: int


class LeadStatusCount(BaseModel):
    status: str
    count: int


class LeadFunnel(BaseModel):
    by_status: List[LeadStatusCount]
    total: int
    converted: int
    conversion_rate_pct: float
    avg_days_to_convert: float | None


class TasksCompletion(BaseModel):
    total: int
    completed: int
    overdue: int
    completion_rate_pct: float
    avg_days_to_complete: float | None


# ---------------------------------------------------------------------------
# Date-range helper
# ---------------------------------------------------------------------------

DateRangeLiteral = Literal["7d", "30d", "90d", "this_week", "this_month", "this_quarter", "this_year"]


def _range_start(date_range: DateRangeLiteral) -> datetime:
    """Return the UTC start of a named relative range."""
    now = datetime.now(timezone.utc)
    if date_range == "7d":
        return now - timedelta(days=7)
    if date_range == "30d":
        return now - timedelta(days=30)
    if date_range == "90d":
        return now - timedelta(days=90)
    if date_range == "this_week":
        return (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    if date_range == "this_month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if date_range == "this_quarter":
        q_month = ((now.month - 1) // 3) * 3 + 1
        return now.replace(month=q_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    # this_year
    return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# GET /reports/sales-summary
# ---------------------------------------------------------------------------

@router.get("/sales-summary", response_model=SalesSummary)
async def sales_summary(
    start_date: datetime | None = Query(None, description="ISO-8601 — filter Opportunity.created_at ≥"),
    end_date:   datetime | None = Query(None, description="ISO-8601 — filter Opportunity.created_at ≤"),
    owner_id:   int | None      = Query(None, description="Scope to a specific account owner"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER)),
):
    """
    Aggregated sales performance.
    Date range filters on Opportunity.created_at.
    """
    # Build shared filter — applied to every sub-query below
    def _base(q):
        q = q.outerjoin(Account, Account.id == Opportunity.account_id)
        if owner_id:
            q = q.where(Account.owner_id == owner_id)
        if start_date:
            q = q.where(Opportunity.created_at >= start_date)
        if end_date:
            q = q.where(Opportunity.created_at <= end_date)
        return q

    # --- Overall totals ---
    totals = (await db.execute(
        _base(select(
            func.count(Opportunity.id).label("total"),
            func.coalesce(func.sum(Opportunity.amount), 0).label("total_value"),
        ))
    )).one()

    # --- Closed Won / Lost breakdown ---
    closed_rows = (await db.execute(
        _base(
            select(
                Opportunity.stage,
                func.count(Opportunity.id).label("cnt"),
                func.coalesce(func.sum(Opportunity.amount), 0).label("val"),
            )
        )
        .where(Opportunity.stage.in_([OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST]))
        .group_by(Opportunity.stage)
    )).all()

    won_value = lost_value = won_count = lost_count = 0.0
    for row in closed_rows:
        stage_str = row.stage if isinstance(row.stage, str) else row.stage.value
        if stage_str == "Closed Won":
            won_value  = float(row.val)
            won_count  = int(row.cnt)
        else:
            lost_value = float(row.val)
            lost_count = int(row.cnt)

    total_closed = won_count + lost_count

    # --- Top 5 accounts by pipeline value ---
    top_q = (
        select(
            Account.name,
            func.coalesce(func.sum(Opportunity.amount), 0).label("total_value"),
        )
        .join(Opportunity, Opportunity.account_id == Account.id)
    )
    if owner_id:
        top_q = top_q.where(Account.owner_id == owner_id)
    if start_date:
        top_q = top_q.where(Opportunity.created_at >= start_date)
    if end_date:
        top_q = top_q.where(Opportunity.created_at <= end_date)
    top_q = top_q.group_by(Account.id, Account.name) \
                 .order_by(func.sum(Opportunity.amount).desc()) \
                 .limit(5)
    top_rows = (await db.execute(top_q)).all()

    return SalesSummary(
        total_opportunities=int(totals.total),
        total_value=round(float(totals.total_value), 2),
        won_value=round(won_value, 2),
        lost_value=round(lost_value, 2),
        win_rate=round(won_count / total_closed * 100, 1) if total_closed else 0.0,
        avg_deal_size=round(won_value / won_count, 2) if won_count else 0.0,
        top_accounts=[
            TopAccount(name=r.name, total_value=round(float(r.total_value), 2))
            for r in top_rows
        ],
    )


# ---------------------------------------------------------------------------
# GET /reports/activity-summary
# ---------------------------------------------------------------------------

@router.get("/activity-summary", response_model=List[ActivityRow])
async def activity_summary(
    start_date: datetime | None = Query(None, description="Filter Activity.created_at ≥"),
    end_date:   datetime | None = Query(None, description="Filter Activity.created_at ≤"),
    user_id:    int | None      = Query(None, description="Scope to a specific user"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER)),
):
    """
    Activity counts grouped by user and type.
    Returns one row per user with per-type counts.
    """
    q = (
        select(
            Activity.user_id,
            User.full_name,
            Activity.type,
            func.count(Activity.id).label("cnt"),
        )
        .join(User, User.id == Activity.user_id)
    )
    if user_id:
        q = q.where(Activity.user_id == user_id)
    if start_date:
        q = q.where(Activity.created_at >= start_date)
    if end_date:
        q = q.where(Activity.created_at <= end_date)
    q = q.group_by(Activity.user_id, User.full_name, Activity.type) \
         .order_by(Activity.user_id)

    rows = (await db.execute(q)).all()

    # Pivot type → count in Python (avoids SQLAlchemy CASE version differences)
    TYPE_KEYS = {"call": "call_count", "email": "email_count",
                 "meeting": "meeting_count", "note": "note_count"}

    users: dict[int, dict] = {}
    for row in rows:
        uid = row.user_id
        if uid not in users:
            users[uid] = {
                "user_id": uid,
                "user_name": row.full_name,
                "call_count": 0,
                "email_count": 0,
                "meeting_count": 0,
                "note_count": 0,
                "other_count": 0,
                "total": 0,
            }
        key = TYPE_KEYS.get((row.type or "").lower(), "other_count")
        users[uid][key] += int(row.cnt)
        users[uid]["total"] += int(row.cnt)

    return [ActivityRow(**u) for u in users.values()]


# ---------------------------------------------------------------------------
# GET /reports/lead-funnel
# ---------------------------------------------------------------------------

@router.get("/lead-funnel", response_model=LeadFunnel)
async def lead_funnel(
    start_date: datetime | None = Query(None, description="Filter Lead.created_at ≥"),
    end_date:   datetime | None = Query(None, description="Filter Lead.created_at ≤"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER)),
):
    """
    Lead counts by status, overall conversion rate, and average days to convert.
    """
    # --- Counts by status ---
    q = select(Lead.status, func.count(Lead.id).label("cnt")).group_by(Lead.status)
    if start_date:
        q = q.where(Lead.created_at >= start_date)
    if end_date:
        q = q.where(Lead.created_at <= end_date)
    status_rows = (await db.execute(q)).all()

    by_status = []
    total = converted = 0
    for row in status_rows:
        status_str = row.status if isinstance(row.status, str) else row.status.value
        count = int(row.cnt)
        by_status.append(LeadStatusCount(status=status_str, count=count))
        total += count
        if status_str == "Converted":
            converted = count

    # Canonical status ordering
    STATUS_ORDER = ["New", "Contacted", "Qualified", "Unqualified", "Converted"]
    by_status.sort(key=lambda x: STATUS_ORDER.index(x.status) if x.status in STATUS_ORDER else 99)

    # --- Average days from created_at to converted_at ---
    avg_q = select(
        func.avg(
            func.extract("epoch", Lead.converted_at - Lead.created_at) / 86400.0
        ).label("avg_days")
    ).where(Lead.is_converted.is_(True))
    if start_date:
        avg_q = avg_q.where(Lead.created_at >= start_date)
    if end_date:
        avg_q = avg_q.where(Lead.created_at <= end_date)

    avg_row = (await db.execute(avg_q)).one()
    avg_days = round(float(avg_row.avg_days), 1) if avg_row.avg_days is not None else None

    return LeadFunnel(
        by_status=by_status,
        total=total,
        converted=converted,
        conversion_rate_pct=round(converted / total * 100, 1) if total else 0.0,
        avg_days_to_convert=avg_days,
    )


# ---------------------------------------------------------------------------
# GET /reports/tasks-completion
# ---------------------------------------------------------------------------

@router.get("/tasks-completion", response_model=TasksCompletion)
async def tasks_completion(
    date_range: DateRangeLiteral | None = Query(
        None,
        description="Relative window: 7d | 30d | 90d | this_week | this_month | this_quarter | this_year",
    ),
    user_id: int | None = Query(None, description="Scope to tasks assigned to a specific user"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER)),
):
    """
    Task completion and overdue metrics.
    Overdue = not Completed and due_date is in the past.
    """
    now = datetime.now(timezone.utc)

    def _apply(q):
        if date_range:
            q = q.where(Task.created_at >= _range_start(date_range))
        if user_id:
            q = q.where(Task.assigned_to_id == user_id)
        return q

    # --- Total tasks in window ---
    total = (await db.execute(
        _apply(select(func.count(Task.id).label("n")))
    )).scalar_one()

    # --- Completed ---
    completed = (await db.execute(
        _apply(
            select(func.count(Task.id).label("n"))
            .where(Task.status == TaskStatus.COMPLETED)
        )
    )).scalar_one()

    # --- Overdue (not completed, past due date) ---
    overdue = (await db.execute(
        _apply(
            select(func.count(Task.id).label("n"))
            .where(
                Task.status != TaskStatus.COMPLETED,
                Task.due_date.isnot(None),
                Task.due_date < now,
            )
        )
    )).scalar_one()

    # --- Average days from created_at to completed_at ---
    avg_row = (await db.execute(
        _apply(
            select(
                func.avg(
                    func.extract("epoch", Task.completed_at - Task.created_at) / 86400.0
                ).label("avg_days")
            ).where(Task.status == TaskStatus.COMPLETED)
        )
    )).one()
    avg_days = round(float(avg_row.avg_days), 1) if avg_row.avg_days is not None else None

    return TasksCompletion(
        total=int(total),
        completed=int(completed),
        overdue=int(overdue),
        completion_rate_pct=round(int(completed) / int(total) * 100, 1) if total else 0.0,
        avg_days_to_complete=avg_days,
    )
