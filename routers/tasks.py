from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Task, TaskStatus, TaskPriority, User
from schemas import TaskCreate, TaskRead, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tasks"])


async def _get_accessible_task(task_id: int, current_user: User, db: AsyncSession) -> Task:
    """Return the task if the current user created it or is assigned to it, else 404."""
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            or_(
                Task.assigned_to_id == current_user.id,
                Task.created_by_id == current_user.id,
            ),
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


# ---------------------------------------------------------------------------
# SPECIAL ROUTES — must be defined before /{task_id} to avoid path conflicts
# ---------------------------------------------------------------------------

@router.get("/overdue", response_model=List[TaskRead])
async def list_overdue_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tasks past their due date that are not yet completed, visible to the current user."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Task)
        .where(
            or_(
                Task.assigned_to_id == current_user.id,
                Task.created_by_id == current_user.id,
            ),
            Task.due_date < now,
            Task.status != TaskStatus.COMPLETED,
        )
        .order_by(Task.due_date.asc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/my-tasks", response_model=List[TaskRead])
async def list_my_tasks(
    status: TaskStatus | None = Query(None),
    priority: TaskPriority | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tasks assigned directly to the current user."""
    query = select(Task).where(Task.assigned_to_id == current_user.id)

    if status is not None:
        query = query.where(Task.status == status)
    if priority is not None:
        query = query.where(Task.priority == priority)

    query = query.order_by(Task.due_date.asc().nulls_last()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# LIST (created by OR assigned to current user)
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[TaskRead])
async def list_tasks(
    status: TaskStatus | None = Query(None),
    priority: TaskPriority | None = Query(None),
    assigned_to_id: int | None = Query(None),
    due_date_before: datetime | None = Query(None, description="ISO 8601 — return tasks due before this datetime"),
    due_date_after: datetime | None = Query(None, description="ISO 8601 — return tasks due after this datetime"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tasks the current user created or is assigned to, with optional filters."""
    query = select(Task).where(
        or_(
            Task.assigned_to_id == current_user.id,
            Task.created_by_id == current_user.id,
        )
    )

    if status is not None:
        query = query.where(Task.status == status)
    if priority is not None:
        query = query.where(Task.priority == priority)
    if assigned_to_id is not None:
        query = query.where(Task.assigned_to_id == assigned_to_id)
    if due_date_before is not None:
        query = query.where(Task.due_date <= due_date_before)
    if due_date_after is not None:
        query = query.where(Task.due_date >= due_date_after)

    query = query.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

@router.post("/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a task. created_by is set to the current user automatically."""
    new_task = Task(**task_in.model_dump(), created_by_id=current_user.id)
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    return new_task


# ---------------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------------

@router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_accessible_task(task_id, current_user, db)


# ---------------------------------------------------------------------------
# UPDATE (PATCH)
# ---------------------------------------------------------------------------

@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _get_accessible_task(task_id, current_user, db)

    for key, value in task_in.model_dump(exclude_unset=True).items():
        setattr(task, key, value)

    await db.commit()
    await db.refresh(task)
    return task


# ---------------------------------------------------------------------------
# COMPLETE
# ---------------------------------------------------------------------------

@router.post("/{task_id}/complete", response_model=TaskRead)
async def complete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a task as completed and record the completion timestamp."""
    task = await _get_accessible_task(task_id, current_user, db)

    if task.status == TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Task is already completed")

    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(task)
    return task


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _get_accessible_task(task_id, current_user, db)
    await db.delete(task)
    await db.commit()
    return None
