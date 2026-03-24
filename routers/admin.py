"""
routers/admin.py — Admin-only endpoints.

All routes require role = Admin (enforced via require_role dependency).
Handles:
  • User management  (list, approve, role change, toggle-active,
                      reset password, invite, bulk actions)
  • Audit log        (list with filters, CSV export)
  • System settings  (get / patch key-value config)
"""

import csv
import io
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_password_hash
from config import settings
from database import get_db
from email_utils import (
    send_approval_confirmation,
    send_invite_email,
    send_password_reset_email,
)
from models import AuditLog, SystemSetting, User, UserRole
from permissions import require_role
from schemas import (
    AdminBulkAction,
    AdminInviteUser,
    AdminRoleUpdate,
    AdminUserResponse,
    AuditLogRead,
    SystemSettingUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

# Every endpoint in this router requires Admin role
require_admin = require_role(UserRole.ADMIN)

# Default values for system settings
_SETTING_DEFAULTS: dict = {
    "AUTO_GENERATE_AGREEMENT_ON_CLOSE": False,
    "DEFAULT_AGREEMENT_TYPE": "Standard",
    "EMAIL_NOTIFICATIONS_ENABLED": True,
    "MAX_LOGIN_ATTEMPTS": 5,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_or_404(user_id: int, db: AsyncSession) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


async def _write_audit(
    db: AsyncSession,
    *,
    current_user: User,
    action: str,
    table_name: str,
    record_id: Optional[int] = None,
    changes: Optional[dict] = None,
) -> None:
    """Insert a row into audit_log. Fire-and-forget — errors are swallowed."""
    try:
        log = AuditLog(
            user_id=current_user.id,
            user_email=current_user.email,
            action=action,
            table_name=table_name,
            record_id=record_id,
            changes=json.dumps(changes) if changes else None,
        )
        db.add(log)
        # caller is responsible for commit
    except Exception:
        pass  # never let audit logging break the main operation


async def _get_settings_dict(db: AsyncSession) -> dict:
    result = await db.execute(select(SystemSetting))
    stored = {r.key: json.loads(r.value) for r in result.scalars().all() if r.value is not None}
    return {k: stored.get(k, default) for k, default in _SETTING_DEFAULTS.items()}


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=List[AdminUserResponse])
async def list_all_users(
    search: str = Query(""),
    role: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    approved: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Return all users with optional search/role/status filtering."""
    q = select(User)
    filters = []

    if search:
        like = f"%{search}%"
        filters.append(or_(User.full_name.ilike(like), User.email.ilike(like)))
    if role:
        filters.append(User.role == role)
    if status_filter == "active":
        filters.append(User.is_active == True)
    elif status_filter == "inactive":
        filters.append(User.is_active == False)
    if approved is not None:
        filters.append(User.is_approved == approved)

    if filters:
        q = q.where(and_(*filters))

    q = q.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/users/{user_id}/approve", response_model=AdminUserResponse)
async def approve_user(
    user_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Approve a pending user registration."""
    user = await _get_user_or_404(user_id, db)
    if user.is_approved:
        raise HTTPException(status_code=400, detail="User is already approved.")

    user.is_approved = True
    user.is_active = True
    await _write_audit(db, current_user=current_user, action="UPDATE",
                       table_name="users", record_id=user_id,
                       changes={"old": {"is_approved": False}, "new": {"is_approved": True}})
    await db.commit()
    await db.refresh(user)
    background_tasks.add_task(send_approval_confirmation, user.email, user.full_name, approved=True)
    return user


@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
async def update_user_role(
    user_id: int,
    body: AdminRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Change a user's role. Admins cannot demote themselves."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role.")

    user = await _get_user_or_404(user_id, db)
    old_role = user.role
    user.role = body.role
    await _write_audit(db, current_user=current_user, action="UPDATE",
                       table_name="users", record_id=user_id,
                       changes={"old": {"role": str(old_role)}, "new": {"role": body.role.value}})
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}/toggle-active", response_model=AdminUserResponse)
async def toggle_user_active(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Activate or deactivate a user. Admins cannot deactivate themselves."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account.")

    user = await _get_user_or_404(user_id, db)
    old_state = user.is_active
    user.is_active = not user.is_active
    await _write_audit(db, current_user=current_user, action="UPDATE",
                       table_name="users", record_id=user_id,
                       changes={"old": {"is_active": old_state}, "new": {"is_active": user.is_active}})
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Generate a 24-hour reset token and email it to the user."""
    user = await _get_user_or_404(user_id, db)
    token = jwt.encode(
        {
            "sub": user.email,
            "type": "reset",
            "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    await _write_audit(db, current_user=current_user, action="UPDATE",
                       table_name="users", record_id=user_id,
                       changes={"action": "password_reset_requested"})
    await db.commit()
    background_tasks.add_task(send_password_reset_email, user.email, user.full_name, token)
    return {"message": f"Password reset email sent to {user.email}."}


# ── Invite must be declared BEFORE /{user_id} routes to avoid path conflicts ──

@router.post("/users/invite", response_model=AdminUserResponse, status_code=201)
async def invite_user(
    body: AdminInviteUser,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create an inactive user record and email an invitation link."""
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    temp_pw = secrets.token_urlsafe(16)
    new_user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=get_password_hash(temp_pw),
        role=body.role,
        is_active=False,
        is_approved=False,
    )
    db.add(new_user)
    await db.flush()   # get new_user.id before commit

    token = jwt.encode(
        {
            "sub": new_user.email,
            "type": "invite",
            "exp": datetime.now(timezone.utc) + timedelta(hours=72),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    await _write_audit(db, current_user=current_user, action="CREATE",
                       table_name="users", record_id=new_user.id,
                       changes={"email": new_user.email, "role": body.role.value})
    await db.commit()
    await db.refresh(new_user)
    background_tasks.add_task(send_invite_email, new_user.email, new_user.full_name, token)
    return new_user


# ── Bulk actions ──────────────────────────────────────────────────────────────

@router.post("/users/bulk-approve")
async def bulk_approve_users(
    body: AdminBulkAction,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.id.in_(body.user_ids), User.is_approved == False)
    )
    users = result.scalars().all()
    for u in users:
        u.is_approved = True
        u.is_active = True
        background_tasks.add_task(send_approval_confirmation, u.email, u.full_name, approved=True)
        await _write_audit(db, current_user=current_user, action="UPDATE",
                           table_name="users", record_id=u.id,
                           changes={"old": {"is_approved": False}, "new": {"is_approved": True}})
    await db.commit()
    return {"approved": len(users)}


@router.post("/users/bulk-deactivate")
async def bulk_deactivate_users(
    body: AdminBulkAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Never deactivate the requesting admin
    ids = [uid for uid in body.user_ids if uid != current_user.id]
    if not ids:
        return {"deactivated": 0}

    result = await db.execute(select(User).where(User.id.in_(ids), User.is_active == True))
    users = result.scalars().all()
    for u in users:
        u.is_active = False
        await _write_audit(db, current_user=current_user, action="UPDATE",
                           table_name="users", record_id=u.id,
                           changes={"old": {"is_active": True}, "new": {"is_active": False}})
    await db.commit()
    return {"deactivated": len(users)}


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    fmt: str = Query("json", alias="format"),
    user_id: Optional[int] = Query(None),
    table_name: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = select(AuditLog)
    filters = []

    if user_id is not None:
        filters.append(AuditLog.user_id == user_id)
    if table_name:
        filters.append(AuditLog.table_name == table_name)
    if action:
        filters.append(AuditLog.action == action)
    if date_from:
        try:
            filters.append(AuditLog.timestamp >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            filters.append(AuditLog.timestamp <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    if filters:
        q = q.where(and_(*filters))

    q = q.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    logs = result.scalars().all()

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Timestamp", "User", "Action", "Table", "Record ID", "Changes"])
        for log in logs:
            writer.writerow([
                log.id,
                log.timestamp.isoformat(),
                log.user_email or (f"user:{log.user_id}" if log.user_id else "system"),
                log.action,
                log.table_name,
                log.record_id or "",
                log.changes or "",
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
        )

    return [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "user_id": log.user_id,
            "user_email": log.user_email,
            "action": log.action,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "changes": log.changes,
        }
        for log in logs
    ]


# ── System Settings ───────────────────────────────────────────────────────────

@router.get("/settings")
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return await _get_settings_dict(db)


@router.patch("/settings")
async def update_system_settings(
    body: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    updates = body.model_dump(exclude_none=True)
    old_values = await _get_settings_dict(db)

    for key, value in updates.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        if row:
            row.value = json.dumps(value)
        else:
            db.add(SystemSetting(key=key, value=json.dumps(value)))

    await _write_audit(db, current_user=current_user, action="UPDATE",
                       table_name="system_settings",
                       changes={"old": {k: old_values.get(k) for k in updates},
                                "new": updates})
    await db.commit()
    return await _get_settings_dict(db)
