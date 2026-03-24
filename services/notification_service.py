"""
Lightweight notification service.
All functions are simple async helpers — call them from routers after a commit.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import Notification, NotificationType


async def create_notification(
    db: AsyncSession,
    *,
    user_id: int,
    type: NotificationType,
    title: str,
    message: str,
    related_record_type: str | None = None,
    related_record_id: int | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        related_record_type=related_record_type,
        related_record_id=related_record_id,
    )
    db.add(notif)
    await db.flush()   # get id without a separate commit
    return notif


async def mark_read(db: AsyncSession, notification_id: int, user_id: int) -> Notification | None:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.flush()
    return notif


async def mark_all_read(db: AsyncSession, user_id: int) -> int:
    """Mark every unread notification for user as read. Returns count updated."""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,   # noqa: E712
        )
    )
    notifications = result.scalars().all()
    for n in notifications:
        n.is_read = True
    await db.flush()
    return len(notifications)


async def get_unread_count(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,   # noqa: E712
        )
    )
    return len(result.scalars().all())
