"""
services/audit_service.py — shared audit-logging helper.

Usage:
    from services.audit_service import log_change, snapshot

    old = snapshot(record)          # call BEFORE mutations
    record.name = "New Name"        # apply changes
    await log_change(
        db,
        table_name="accounts",
        record_id=record.id,
        action="UPDATE",
        old_values=old,
        new_values=snapshot(record),
        user_id=current_user.id,
        user_email=current_user.email,
    )
    await db.commit()
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from models import AuditLog


# ---------------------------------------------------------------------------
# Serialisation helper
# ---------------------------------------------------------------------------

def snapshot(obj) -> dict[str, Any]:
    """
    Convert a SQLAlchemy model instance to a plain JSON-safe dict.
    Handles datetime → ISO string and enum → .value automatically.
    Call this BEFORE and AFTER mutations to capture old/new state.
    """
    result: dict[str, Any] = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            result[col.name] = val.isoformat()
        elif hasattr(val, "value"):  # SQLAlchemy / Python enum
            result[col.name] = val.value
        else:
            result[col.name] = val
    return result


# ---------------------------------------------------------------------------
# Core log_change function
# ---------------------------------------------------------------------------

async def log_change(
    db: AsyncSession,
    *,
    table_name: str,
    record_id: int,
    action: str,                        # "CREATE" | "UPDATE" | "DELETE"
    old_values: dict | None = None,
    new_values: dict | None = None,
    user_id: int,
    user_email: str | None = None,
) -> None:
    """
    Insert a row into audit_log. Errors are swallowed so audit logging
    never disrupts the main operation. The caller is responsible for commit().
    """
    try:
        changes_payload: dict[str, Any] = {}
        if old_values is not None:
            changes_payload["old"] = old_values
        if new_values is not None:
            changes_payload["new"] = new_values

        log = AuditLog(
            user_id=user_id,
            user_email=user_email,
            action=action,
            table_name=table_name,
            record_id=record_id,
            changes=json.dumps(changes_payload) if changes_payload else None,
        )
        db.add(log)
        # db.flush() intentionally omitted — caller flushes/commits as needed
    except Exception:
        pass  # never let audit logging break the main operation
