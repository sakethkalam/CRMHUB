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
from routers import users, accounts, contacts, opportunities, chat

logger = logging.getLogger(__name__)


async def run_migrations():
    """
    Lightweight startup migrations — adds new columns without breaking existing data.
    Uses 'IF NOT EXISTS' so it's safe to run on every startup.
    Existing users get is_approved=TRUE (DEFAULT TRUE) so they aren't locked out.
    New registrations will have is_approved set to FALSE by SQLAlchemy explicitly.
    """
    async with engine.begin() as conn:
        await conn.execute(__import__('sqlalchemy').text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "is_approved BOOLEAN NOT NULL DEFAULT TRUE"
        ))
    logger.info("Startup migrations complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    # Disable interactive API docs in production
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://crmhub-ten.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(accounts.router)
app.include_router(contacts.router)
app.include_router(opportunities.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    return {"message": "CRM API is running"}


if __name__ == "__main__":
    # Bind to localhost only in dev; use a production ASGI server (gunicorn) in prod
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=settings.DEBUG)
