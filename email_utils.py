"""
email_utils.py — Sends approval emails via Resend (resend.com).

Requires in Railway environment variables:
  RESEND_API_KEY = re_xxxxxxxxxxxx   (from resend.com dashboard)
  BACKEND_URL    = https://web-production-57d8e.up.railway.app
"""
import logging
from datetime import datetime, timedelta, timezone

import jwt
import resend

from config import settings

logger = logging.getLogger(__name__)


def _create_approval_token(email: str, action: str) -> str:
    """Creates a short-lived JWT used in the approve/reject link (72hr expiry)."""
    payload = {
        "sub": email,
        "type": action,
        "exp": datetime.now(timezone.utc) + timedelta(hours=72),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def send_approval_request(user_email: str, user_name: str | None) -> None:
    """
    Emails ADMIN_EMAIL asking them to approve or reject a new registration.
    Called in a FastAPI BackgroundTask so it never blocks the HTTP response.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping approval email.")
        return

    resend.api_key = settings.RESEND_API_KEY

    approve_url = f"{settings.BACKEND_URL}/users/approve?token={_create_approval_token(user_email, 'approve')}"
    reject_url  = f"{settings.BACKEND_URL}/users/reject?token={_create_approval_token(user_email, 'reject')}"
    display     = user_name or user_email

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;">
      <h2 style="color:#1e293b;margin-bottom:4px;">New CRM Registration</h2>
      <p style="color:#64748b;margin-top:0;">Someone new signed up and needs your approval.</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr style="background:#f8fafc;">
          <td style="padding:10px 14px;font-weight:600;color:#475569;width:80px;">Name</td>
          <td style="padding:10px 14px;color:#1e293b;">{display}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#475569;">Email</td>
          <td style="padding:10px 14px;color:#1e293b;">{user_email}</td>
        </tr>
      </table>

      <div style="margin:28px 0;display:flex;gap:12px;">
        <a href="{approve_url}"
           style="background:#10b981;color:#fff;padding:13px 28px;border-radius:8px;
                  text-decoration:none;font-weight:700;font-size:15px;margin-right:12px;">
          ✅ Approve
        </a>
        <a href="{reject_url}"
           style="background:#ef4444;color:#fff;padding:13px 28px;border-radius:8px;
                  text-decoration:none;font-weight:700;font-size:15px;">
          ❌ Reject
        </a>
      </div>

      <p style="color:#94a3b8;font-size:12px;">Links expire in 72 hours.</p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": "CRM Hub <onboarding@resend.dev>",
            "to": settings.ADMIN_EMAIL,
            "subject": f"[CRM] Approve account for {display}",
            "html": html,
        })
        logger.info("Approval email sent to %s for user %s", settings.ADMIN_EMAIL, user_email)
    except Exception as exc:
        logger.error("Failed to send approval email: %s", exc)


def send_invite_email(user_email: str, user_name: str | None, invite_token: str) -> None:
    """Sends an invitation email to a new user created by an admin."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping invite email.")
        return

    resend.api_key = settings.RESEND_API_KEY
    display = user_name or user_email
    # The invite token activates the account and redirects to a password-set flow
    invite_url = f"{settings.BACKEND_URL}/users/approve?token={invite_token}"

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;">
      <h2 style="color:#1e293b;">You've been invited to CRM Hub</h2>
      <p>Hi {display},</p>
      <p>An admin has invited you to join CRM Hub. Click the button below to activate your account
         and set your password.</p>
      <a href="{invite_url}"
         style="background:#3b82f6;color:#fff;padding:13px 28px;border-radius:8px;
                text-decoration:none;font-weight:700;font-size:15px;display:inline-block;margin-top:8px;">
        Accept Invitation
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">This link expires in 72 hours.</p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": "CRM Hub <onboarding@resend.dev>",
            "to": user_email,
            "subject": "You've been invited to CRM Hub",
            "html": html,
        })
        logger.info("Invite email sent to %s", user_email)
    except Exception as exc:
        logger.error("Failed to send invite email to %s: %s", user_email, exc)


def send_password_reset_email(user_email: str, user_name: str | None, reset_token: str) -> None:
    """Sends a password-reset link to the user."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping reset email.")
        return

    resend.api_key = settings.RESEND_API_KEY
    display = user_name or user_email
    # Frontend handles /reset-password?token=... and POSTs new password to the API
    reset_url = f"https://crmhub-ten.vercel.app/reset-password?token={reset_token}"

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;">
      <h2 style="color:#1e293b;">Password Reset Request</h2>
      <p>Hi {display},</p>
      <p>An admin has initiated a password reset for your CRM Hub account.
         Click the button below to set a new password.</p>
      <a href="{reset_url}"
         style="background:#ef4444;color:#fff;padding:13px 28px;border-radius:8px;
                text-decoration:none;font-weight:700;font-size:15px;display:inline-block;margin-top:8px;">
        Reset Password
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        This link expires in 24 hours. If you did not request this, you can safely ignore this email.
      </p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": "CRM Hub <onboarding@resend.dev>",
            "to": user_email,
            "subject": "CRM Hub — Password Reset",
            "html": html,
        })
        logger.info("Password reset email sent to %s", user_email)
    except Exception as exc:
        logger.error("Failed to send reset email to %s: %s", user_email, exc)


def send_approval_confirmation(user_email: str, user_name: str | None, approved: bool) -> None:
    """Notifies the new user that their account was approved or rejected."""
    if not settings.RESEND_API_KEY:
        return

    resend.api_key = settings.RESEND_API_KEY
    display = user_name or user_email

    if approved:
        subject = "Your CRM account has been approved!"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;">
          <h2 style="color:#10b981;">You're approved! 🎉</h2>
          <p>Hi {display},</p>
          <p>Your CRM Hub account has been approved. You can now log in:</p>
          <a href="https://crmhub-ten.vercel.app"
             style="background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;
                    text-decoration:none;font-weight:700;display:inline-block;margin-top:8px;">
            Log in to CRM Hub
          </a>
        </div>
        """
    else:
        subject = "CRM account registration update"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;">
          <h2 style="color:#ef4444;">Registration Not Approved</h2>
          <p>Hi {display},</p>
          <p>Your registration was not approved. Please contact the administrator for more information.</p>
        </div>
        """

    try:
        resend.Emails.send({
            "from": "CRM Hub <onboarding@resend.dev>",
            "to": user_email,
            "subject": subject,
            "html": html,
        })
    except Exception as exc:
        logger.error("Failed to send confirmation email to %s: %s", user_email, exc)
