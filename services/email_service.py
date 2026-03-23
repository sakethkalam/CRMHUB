"""
services/email_service.py — CRM outbound email with automatic Activity logging.

Sends via Resend (same provider as email_utils.py) and immediately
persists an Activity record so every outbound email is tracked in the CRM.
"""

import logging
from dataclasses import dataclass, field

import resend

from config import settings
from models import Activity

logger = logging.getLogger(__name__)


@dataclass
class EmailResult:
    success: bool
    activity_id: int | None = None
    message_id: str | None = None
    error: str | None = None


def _extract_message_id(response) -> str | None:
    """
    Safely pull the Resend message ID whether the SDK returns a dict or an object.
    Older SDK versions returned a plain dict; newer ones return a typed object.
    """
    if response is None:
        return None
    if isinstance(response, dict):
        return response.get("id")
    return getattr(response, "id", None)


async def send_crm_email(
    *,
    to_address: str,
    subject: str,
    body: str,
    sender_user_id: int,
    db,                                 # AsyncSession — typed loosely to avoid circular import
    contact_id: int | None = None,
    account_id: int | None = None,
    opportunity_id: int | None = None,
) -> EmailResult:
    """
    Send one outbound email and log it as an Activity record.

    - ``body`` is treated as HTML if it starts with ``<``; otherwise plain text.
    - The Activity is only written after a successful send.
    - If the Activity write fails after a successful send, the error is logged
      but NOT re-raised — the email was already delivered and cannot be recalled.

    Returns an :class:`EmailResult` with ``success=False`` and an ``error``
    message if sending fails; the Activity will not be created in that case.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — cannot send CRM email.")
        return EmailResult(success=False, error="RESEND_API_KEY not configured")

    resend.api_key = settings.RESEND_API_KEY

    # Build the Resend payload
    payload: dict = {
        "from": "CRM Hub <onboarding@resend.dev>",
        "to": [to_address],
        "subject": subject,
    }
    if body.lstrip().startswith("<"):
        payload["html"] = body
    else:
        payload["text"] = body

    # ----------------------------------------------------------------
    # 1. Send the email
    # ----------------------------------------------------------------
    message_id: str | None = None
    try:
        response = resend.Emails.send(payload)
        message_id = _extract_message_id(response)
        logger.info("Email sent → %s  subject=%r  message_id=%s", to_address, subject, message_id)
    except Exception as exc:
        logger.error("Resend delivery failed → %s: %s", to_address, exc)
        return EmailResult(success=False, error=str(exc))

    # ----------------------------------------------------------------
    # 2. Log the Activity — non-fatal if this fails
    # ----------------------------------------------------------------
    activity_id: int | None = None
    try:
        activity = Activity(
            type="Email",
            description=f"Email sent to {to_address}: {subject}",
            user_id=sender_user_id,
            contact_id=contact_id,
            account_id=account_id,
            opportunity_id=opportunity_id,
        )
        db.add(activity)
        await db.commit()
        await db.refresh(activity)
        activity_id = activity.id
        logger.info("Activity logged: id=%s for email to %s", activity_id, to_address)
    except Exception as exc:
        logger.error(
            "Email sent OK but Activity logging failed (message_id=%s): %s",
            message_id, exc,
        )
        # Don't re-raise — the email is already delivered

    return EmailResult(success=True, activity_id=activity_id, message_id=message_id)
