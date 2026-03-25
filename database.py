# ==============================================================
# app/database.py — Async Database Connection & Session
# ==============================================================
#
# PYTHON CONCEPT: async / await
# Normal Python runs line by line (synchronous).
# Async Python can "pause" a task (like waiting for DB response)
# and work on something else instead of just sitting idle.
# This is why we use "async def" and "await" — it lets FastAPI
# handle thousands of concurrent requests efficiently.
#
# PYTHON CONCEPT: Context Managers (with / async with)
# A context manager sets up a resource and tears it down cleanly.
# "async with get_db() as db:" will:
#   1. Open a DB session
#   2. Give it to your route function
#   3. Automatically close it when the route finishes (even on error)
#
# PYTHON CONCEPT: Generators (yield)
# When a function uses "yield" instead of "return", it becomes a
# generator. FastAPI's dependency injection uses generators for
# setup/teardown patterns (like DB sessions).
# ==============================================================

import os
from typing import AsyncGenerator  # Type hint: a generator that yields async values

from sqlalchemy.ext.asyncio import (
    AsyncSession,           # Async version of SQLAlchemy's Session
    AsyncEngine,            # The database engine (manages the connection pool)
    create_async_engine,    # Factory function to create an async engine
    async_sessionmaker,     # Factory for creating sessions (async version)
)
from sqlalchemy.orm import DeclarativeBase  # Base class for all our ORM models

from config import settings  # Import our config from config.py


# ---------------------------------------------------------------
# DeclarativeBase — The parent class for all SQLAlchemy models
#
# PYTHON CONCEPT: Class Inheritance
# Every database model (User, Account, Contact, etc.) will inherit
# from this Base class. SQLAlchemy uses this to track all models
# and map them to database tables.
#
# Example of how a model will use this:
#   from app.database import Base
#   class User(Base):
#       __tablename__ = "users"
#       id = Column(Integer, primary_key=True)
# ---------------------------------------------------------------
class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy ORM models.
    
    All models in app/models/ will inherit from this.
    SQLAlchemy uses it to:
    - Track which tables exist
    - Generate CREATE TABLE SQL
    - Handle relationships between models
    """
    pass  # No extra code needed — DeclarativeBase provides everything


# ---------------------------------------------------------------
# Database Engine
# 
# The engine manages the connection pool — a set of pre-opened
# database connections that can be reused across requests.
# This is much faster than opening/closing a connection per request.
# ---------------------------------------------------------------
# Railway injects DATABASE_URL as postgres:// — fix to postgresql+asyncpg://
# The config.py validator handles .env / pydantic-parsed values; this catches
# cases where the env var is read directly by SQLAlchemy before Settings loads.
_raw_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)

engine: AsyncEngine = create_async_engine(
    url=_raw_url,
    echo=settings.DEBUG,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    connect_args={"ssl": "require"} if "postgres.database.azure.com" in _raw_url else {},
)


# ---------------------------------------------------------------
# Session Factory
#
# AsyncSessionLocal is a factory (a callable that creates objects).
# Calling AsyncSessionLocal() creates a new database session.
# Sessions represent a single "unit of work" with the database.
# ---------------------------------------------------------------
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    
    # expire_on_commit=False means database objects remain accessible
    # after a commit. Without this, accessing obj.id after session.commit()
    # would trigger another database query — causing issues in async code.
    expire_on_commit=False,
    
    autocommit=False,  # We control when to commit (best practice)
    autoflush=False,   # We control when to flush (best practice for async)
)


# ---------------------------------------------------------------
# get_db — FastAPI Dependency for Database Sessions
#
# PYTHON CONCEPT: async generators (async def + yield)
# This is a dependency that FastAPI will call automatically
# whenever a route function has "db: AsyncSession = Depends(get_db)"
# in its parameters.
#
# The flow:
#   1. FastAPI calls get_db()
#   2. get_db() creates a session and yields it to the route
#   3. The route uses "db" to query the database
#   4. When the route returns, control goes back to get_db()
#   5. The "finally" block ensures the session is ALWAYS closed
#      (even if an exception was raised in the route)
#
# PYTHON CONCEPT: try / finally
# "finally" always runs, whether or not an exception occurred.
# This guarantees no database sessions are leaked (left open forever).
# ---------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session per request.
    
    Usage in a route:
        from fastapi import Depends
        from sqlalchemy.ext.asyncio import AsyncSession
        from app.database import get_db
        
        @router.get("/accounts")
        async def list_accounts(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Account))
            return result.scalars().all()
    
    The session is automatically:
    - Created before the route runs
    - Closed after the route finishes (via finally block)
    """
    # Create a new session using our factory
    async with AsyncSessionLocal() as session:
        try:
            # yield hands the session to the route function
            # Execution pauses here until the route finishes
            yield session
            
            # If we get here, no exception was raised — commit the transaction
            await session.commit()
            
        except Exception:
            # Something went wrong in the route — roll back ALL changes
            # This ensures partial data is never saved to the database
            await session.rollback()
            
            # Re-raise the exception so FastAPI's error handler can process it
            raise
        
        # The "async with" context manager automatically closes the session
        # when the block exits (equivalent to a finally: session.close())


# ---------------------------------------------------------------
# Database Lifecycle Functions
# Used by main.py to create/drop tables on startup/shutdown.
# In production we use Alembic migrations instead of these.
# ---------------------------------------------------------------

async def create_tables() -> None:
    """
    Creates all tables defined in SQLAlchemy models.
    
    IMPORTANT: Only use this for development/testing.
    In production, use Alembic migrations:
        alembic upgrade head
    
    This function is called in main.py's lifespan handler.
    """
    async with engine.begin() as conn:
        # run_sync is needed because create_all is not async
        # It runs the synchronous function in the async context
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables() -> None:
    """
    Drops all tables. USE WITH EXTREME CAUTION — deletes all data!
    Only used for testing/development resets.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
