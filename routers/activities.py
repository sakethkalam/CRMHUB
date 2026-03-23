"""
routers/activities.py

POST /activities/send-email   — send a CRM email and auto-log it as an Activity
POST /activities/             — manually log any Activity (note, call, meeting…)
GET  /activities/             — list activities (scoped by role)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Account, Activity, User, UserRole
from permissions import ROLE_RANK, require_role
from schemas import ActivityCreate, ActivityResponse
from services.email_service import send_crm_email
from typing import List

router = APIRouter(prefix="/activities", tags=["Activities"])


# ---------------------------------------------------------------------------
# Request / response models specific to this router
# ---------------------------------------------------------------------------

class SendEmailRequest(BaseModel):
    to_address: EmailStr
    subject: str
    body: str
    contact_id: int | None = None
    account_id: int | None = None
    opportunity_id: int | None = None


class SendEmailResponse(BaseModel):
    success: bool
    activity_id: int | None
    message_id: str | None
    activity: ActivityResponse | None = None


# ---------------------------------------------------------------------------
# Role helper
# ---------------------------------------------------------------------------

def _is_manager_or_above(user: User) -> bool:
    role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return ROLE_RANK.get(role, 0) >= ROLE_RANK[UserRole.MANAGER]


# ---------------------------------------------------------------------------
# POST /activities/send-email
# ---------------------------------------------------------------------------

@router.post(
    "/send-email",
    response_model=SendEmailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send an email to a contact and log it as an Activity",
)
async def send_email(
    email_in: SendEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    """
    Sends an outbound email via Resend, then immediately creates an Activity record
    of type "Email" linked to the provided contact / account / opportunity.

    - Returns **502** if Resend delivery fails (email not sent, no Activity created).
    - The Activity is still attempted even if message_id is missing.
    - Body is sent as HTML if it starts with ``<``, otherwise plain text.
    """
    result = await send_crm_email(
        to_address=str(email_in.to_address),
        subject=email_in.subject,
        body=email_in.body,
        sender_user_id=current_user.id,
        contact_id=email_in.contact_id,
        account_id=email_in.account_id,
        opportunity_id=email_in.opportunity_id,
        db=db,
    )

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Email delivery failed: {result.error}",
        )

    # Fetch the created activity to return the full object
    activity_obj: ActivityResponse | None = None
    if result.activity_id:
        row = (await db.execute(
            select(Activity).where(Activity.id == result.activity_id)
        )).scalar_one_or_none()
        if row:
            activity_obj = ActivityResponse.model_validate(row)

    return SendEmailResponse(
        success=True,
        activity_id=result.activity_id,
        message_id=result.message_id,
        activity=activity_obj,
    )


# ---------------------------------------------------------------------------
# POST /activities/   — manually log a note, call, meeting, etc.
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually log an activity (Note, Call, Meeting, etc.)",
)
async def create_activity(
    activity_in: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALES_REP)),
):
    activity = Activity(
        **activity_in.model_dump(),
        user_id=current_user.id,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


# ---------------------------------------------------------------------------
# GET /activities/   — list activities
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=List[ActivityResponse],
    summary="List activities (Manager/Admin see all; others see own)",
)
async def list_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    activity_type: str | None = Query(None, description="Filter by type: Email, Call, Note, Meeting"),
    contact_id: int | None = Query(None),
    account_id: int | None = Query(None),
    opportunity_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Activity)

    if not _is_manager_or_above(current_user):
        query = query.where(Activity.user_id == current_user.id)

    if activity_type:
        query = query.where(Activity.type == activity_type)
    if contact_id:
        query = query.where(Activity.contact_id == contact_id)
    if account_id:
        query = query.where(Activity.account_id == account_id)
    if opportunity_id:
        query = query.where(Activity.opportunity_id == opportunity_id)

    query = query.order_by(Activity.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
