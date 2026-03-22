"""
email_utils.py — Sends approval/rejection emails via Gmail SMTP.

Requires in Railway environment variables:
  SMTP_USER     = your-gmail@gmail.com
  SMTP_PASSWORD = 16-char Google App Password
  BACKEND_URL   = https://web-production-57d8e.up.railway.app
"""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import timedelta

import jwt

from config import settings

logger = logging.getLogger(__name__)


def _create_approval_token(email: str, action: str, expires_hours: int = 72) -> str:
    """Creates a short-lived JWT used in the approve/reject link."""
    from datetime import datetime, timezone
    payload = {
        "sub": email,
        "type": action,   # "approve" or "reject"
        "exp": datetime.now(timezone.utc) + timedelta(hours=expires_hours),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def send_approval_request(user_email: str, user_name: str | None) -> None:
    """
    Sends an email to ADMIN_EMAIL asking them to approve or reject
    the new user registration. Called in a background thread.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured — skipping approval email.")
        return

    approve_token = _create_approval_token(user_email, "approve")
    reject_token = _create_approval_token(user_email, "reject")

    approve_url = f"{settings.BACKEND_URL}/users/approve/{approve_token}"
    reject_url = f"{settings.BACKEND_URL}/users/reject/{reject_token}"

    display_name = user_name or user_email

    html = f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: #1e293b;">New CRM Registration Request</h2>
      <p>A new user has signed up and is waiting for your approval:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Name</td>
            <td style="padding: 8px;">{display_name}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding: 8px; font-weight: bold; color: #475569;">Email</td>
            <td style="padding: 8px;">{user_email}</td></tr>
      </table>
      <p>Click one of the buttons below to approve or reject this account:</p>
      <div style="margin: 24px 0;">
        <a href="{approve_url}"
           style="background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;
                  text-decoration:none;font-weight:bold;margin-right:16px;">
          ✅ Approve Account
        </a>
        <a href="{reject_url}"
           style="background:#ef4444;color:#fff;padding:12px 28px;border-radius:8px;
                  text-decoration:none;font-weight:bold;">
          ❌ Reject Account
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;">
        These links expire in 72 hours. If you didn't expect this, ignore this email.
      </p>
    </body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[CRM] Approve account for {display_name}"
    msg["From"] = settings.SMTP_USER
    msg["To"] = settings.ADMIN_EMAIL
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, settings.ADMIN_EMAIL, msg.as_string())
        logger.info("Approval email sent to %s for user %s", settings.ADMIN_EMAIL, user_email)
    except Exception as exc:
        logger.error("Failed to send approval email: %s", exc)


def send_approval_confirmation(user_email: str, user_name: str | None, approved: bool) -> None:
    """Notifies the user that their account was approved or rejected."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return

    display_name = user_name or user_email
    subject = "[CRM] Your account has been approved!" if approved else "[CRM] Account registration update"

    if approved:
        body = f"""
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
          <h2 style="color: #10b981;">Account Approved!</h2>
          <p>Hi {display_name},</p>
          <p>Your CRM account has been approved. You can now log in at:</p>
          <p><a href="https://crmhub-ten.vercel.app" style="color:#3b82f6;">crmhub-ten.vercel.app</a></p>
        </body></html>
        """
    else:
        body = f"""
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
          <h2 style="color: #ef4444;">Registration Not Approved</h2>
          <p>Hi {display_name},</p>
          <p>Your CRM registration request was not approved at this time.
             Please contact the administrator for more information.</p>
        </body></html>
        """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_USER
    msg["To"] = user_email
    msg.attach(MIMEText(body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, user_email, msg.as_string())
    except Exception as exc:
        logger.error("Failed to send confirmation email to %s: %s", user_email, exc)
