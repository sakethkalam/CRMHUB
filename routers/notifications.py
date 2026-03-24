from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Notification, NotificationType, User
from services.notification_service import mark_read, mark_all_read, get_unread_count

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class NotificationRead(BaseModel):
    id:                  int
    type:                NotificationType
    title:               str
    message:             str
    is_read:             bool
    related_record_type: str | None
    related_record_id:   int | None
    created_at:          str   # ISO 8601

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, obj: Notification) -> "NotificationRead":
        return cls(
            id=obj.id,
            type=obj.type,
            title=obj.title,
            message=obj.message,
            is_read=obj.is_read,
            related_record_type=obj.related_record_type,
            related_record_id=obj.related_record_id,
            created_at=obj.created_at.isoformat(),
        )


class UnreadCount(BaseModel):
    count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[NotificationRead])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the 50 most-recent notifications for the current user."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()
    return [NotificationRead.from_orm(n) for n in notifications]


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await get_unread_count(db, current_user.id)
    return UnreadCount(count=count)


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = await mark_read(db, notification_id, current_user.id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.commit()
    return NotificationRead.from_orm(notif)


@router.post("/read-all", response_model=UnreadCount)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = await mark_all_read(db, current_user.id)
    await db.commit()
    return UnreadCount(count=updated)
