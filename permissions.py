"""
permissions.py — Role-based access control helpers.

Role hierarchy (highest to lowest):
    Admin     — full access to every record in the system
    Manager   — full access to their team's records, read access to all
    Sales Rep — CRUD on their own records only (owner_id == current_user.id)
    Read Only — GET requests only; all mutations raise 403

Usage
-----
# Require a minimum role on a route:
    current_user: User = Depends(require_role(UserRole.MANAGER))

# Enforce ownership or elevated role on a specific record:
    require_owner_or_admin(record.owner_id, current_user)
"""

from fastapi import Depends, HTTPException, status

from auth import get_current_user
from models import User, UserRole

# Numeric rank for each role — higher = more privileged
ROLE_RANK: dict[UserRole, int] = {
    UserRole.READ_ONLY: 1,
    UserRole.SALES_REP: 2,
    UserRole.MANAGER:   3,
    UserRole.ADMIN:     4,
}


def _rank(role: UserRole | str) -> int:
    """Return the numeric rank, handling both enum members and raw strings."""
    if isinstance(role, UserRole):
        return ROLE_RANK[role]
    # asyncpg may return the raw string value
    try:
        return ROLE_RANK[UserRole(role)]
    except ValueError:
        return 0


def require_role(minimum_role: UserRole):
    """
    FastAPI dependency factory — returns a dependency that resolves the current
    user and raises 403 if their role is below `minimum_role`.

    Example::

        @router.post("/accounts/")
        async def create_account(
            ...,
            current_user: User = Depends(require_role(UserRole.SALES_REP)),
        ):
    """
    async def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if _rank(current_user.role) < _rank(minimum_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Insufficient permissions. "
                    f"Required: '{minimum_role.value}' or above, "
                    f"your role: '{current_user.role if isinstance(current_user.role, str) else current_user.role.value}'."
                ),
            )
        return current_user

    # Preserve a readable name for FastAPI's dependency graph introspection
    _dependency.__name__ = f"require_{minimum_role.value.lower().replace(' ', '_')}"
    return _dependency


def require_owner_or_admin(record_owner_id: int | None, current_user: User) -> None:
    """
    Raise 403 if `current_user` is neither the record owner nor an Admin/Manager.

    - Admin and Manager always pass (they have elevated visibility).
    - Sales Rep and Read Only pass only when they own the record.
    - `record_owner_id=None` (unowned record) is always accessible.

    Call this inside route handlers after fetching the record::

        account = await db.get(Account, account_id)
        require_owner_or_admin(account.owner_id, current_user)
    """
    if record_owner_id is None:
        return  # unowned records are universally accessible

    if _rank(current_user.role) >= _rank(UserRole.MANAGER):
        return  # Admin and Manager skip ownership check

    if current_user.id != record_owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this record.",
        )


def require_write_permission(current_user: User) -> None:
    """
    Raise 403 for Read Only users attempting any mutation (POST/PATCH/DELETE).
    Call at the top of any write endpoint that uses `get_current_user` directly
    instead of `require_role`.
    """
    if _rank(current_user.role) <= _rank(UserRole.READ_ONLY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has read-only access. Contact an Admin to request write permissions.",
        )
