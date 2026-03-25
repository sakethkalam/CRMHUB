from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import uvicorn
import logging
from contextlib import asynccontextmanager

from config import settings
from database import engine, Base
from limiter import limiter
from routers import users, accounts, contacts, opportunities, chat, leads, tasks, reports, activities, admin, notifications, ai_assistant, search, products

logger = logging.getLogger(__name__)


async def run_migrations():
    """
    Lightweight startup migrations — adds new columns without breaking existing data.
    Uses 'IF NOT EXISTS' so it's safe to run on every startup.
    Existing users get is_approved=TRUE (DEFAULT TRUE) so they aren't locked out.
    New registrations will have is_approved set to FALSE by SQLAlchemy explicitly.
    """
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "is_approved BOOLEAN NOT NULL DEFAULT TRUE"
        ))
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "role VARCHAR(50) NOT NULL DEFAULT 'Sales Rep'"
        ))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(100)"))
        await conn.execute(text("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS region VARCHAR(100)"))
        # Opportunity extensions
        await conn.execute(text("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS probability INTEGER NOT NULL DEFAULT 10"))
        await conn.execute(text("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS forecast_category VARCHAR(50) NOT NULL DEFAULT 'Pipeline'"))
        await conn.execute(text("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS close_reason VARCHAR(255)"))
        await conn.execute(text("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ"))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                subject VARCHAR(255) NOT NULL,
                description TEXT,
                due_date TIMESTAMPTZ,
                priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
                status VARCHAR(50) NOT NULL DEFAULT 'Open',
                type VARCHAR(50) NOT NULL DEFAULT 'Other',
                assigned_to_id INTEGER NOT NULL REFERENCES users(id),
                created_by_id INTEGER NOT NULL REFERENCES users(id),
                related_account_id INTEGER REFERENCES accounts(id),
                related_contact_id INTEGER REFERENCES contacts(id),
                related_opportunity_id INTEGER REFERENCES opportunities(id),
                completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        # Admin tables
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ"))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                user_email VARCHAR(255),
                action VARCHAR(20) NOT NULL,
                table_name VARCHAR(100) NOT NULL,
                record_id INTEGER,
                changes TEXT
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE,
                phone VARCHAR(50),
                company_name VARCHAR(255),
                job_title VARCHAR(100),
                lead_source VARCHAR(50) DEFAULT 'Other',
                status VARCHAR(50) NOT NULL DEFAULT 'New',
                notes TEXT,
                is_converted BOOLEAN NOT NULL DEFAULT FALSE,
                converted_at TIMESTAMPTZ,
                converted_account_id INTEGER REFERENCES accounts(id),
                converted_contact_id INTEGER REFERENCES contacts(id),
                converted_opportunity_id INTEGER REFERENCES opportunities(id),
                owner_id INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                related_record_type VARCHAR(100),
                related_record_id INTEGER,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications(created_at)"
        ))
        # Product hierarchy
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS product_categories (
                id          SERIAL PRIMARY KEY,
                name        VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                is_active   BOOLEAN NOT NULL DEFAULT TRUE,
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                updated_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS product_families (
                id               SERIAL PRIMARY KEY,
                name             VARCHAR(255) NOT NULL,
                category_id      INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
                description      TEXT,
                therapeutic_area VARCHAR(255),
                is_active        BOOLEAN NOT NULL DEFAULT TRUE,
                created_at       TIMESTAMPTZ DEFAULT NOW(),
                updated_at       TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS products (
                id                SERIAL PRIMARY KEY,
                sku               VARCHAR(100) NOT NULL UNIQUE,
                name              VARCHAR(255) NOT NULL,
                family_id         INTEGER NOT NULL REFERENCES product_families(id) ON DELETE CASCADE,
                description       TEXT,
                unit_price        FLOAT NOT NULL DEFAULT 0.0,
                currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
                unit_of_measure   VARCHAR(50),
                regulatory_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                device_class      VARCHAR(50),
                is_active         BOOLEAN NOT NULL DEFAULT TRUE,
                launch_date       TIMESTAMPTZ,
                discontinue_date  TIMESTAMPTZ,
                created_at        TIMESTAMPTZ DEFAULT NOW(),
                updated_at        TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS opportunity_products (
                opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
                product_id     INTEGER NOT NULL REFERENCES products(id)      ON DELETE CASCADE,
                PRIMARY KEY (opportunity_id, product_id)
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS lead_products (
                lead_id    INTEGER NOT NULL REFERENCES leads(id)    ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                PRIMARY KEY (lead_id, product_id)
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS opportunity_accounts (
                opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
                account_id     INTEGER NOT NULL REFERENCES accounts(id)      ON DELETE CASCADE,
                PRIMARY KEY (opportunity_id, account_id)
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS lead_accounts (
                lead_id    INTEGER NOT NULL REFERENCES leads(id)    ON DELETE CASCADE,
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                PRIMARY KEY (lead_id, account_id)
            )
        """))
    logger.info("Startup migrations complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations()
    yield
    await engine.dispose()


app = FastAPI(
    title="SHINSO API",
    description="SHINSO — The Intelligent Layer for Corporate Accounts",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — merge hardcoded dev origins with FRONTEND_URL from env
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    settings.FRONTEND_URL,
]
allowed_origins = [o for o in allowed_origins if o]  # drop empty strings

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": "SHINSO", "version": "1.0.0"}


app.include_router(users.router)
app.include_router(accounts.router)
app.include_router(contacts.router)
app.include_router(opportunities.router)
app.include_router(chat.router)
app.include_router(leads.router)
app.include_router(tasks.router)
app.include_router(reports.router)
app.include_router(activities.router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(ai_assistant.router)
app.include_router(search.router)
app.include_router(products.router)


@app.get("/")
async def root():
    return {"message": "SHINSO API is running"}


if __name__ == "__main__":
    # Bind to localhost only in dev; use a production ASGI server (gunicorn) in prod
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=settings.DEBUG)
