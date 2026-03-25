# ==============================================================
# app/config.py — Application Configuration
# ==============================================================
#
# PYTHON CONCEPT: Classes & Inheritance
# A class is a blueprint for creating objects.
# Here we create ONE Settings object that holds all our
# environment variables. We "inherit" from BaseSettings
# (from pydantic-settings) which gives us .env file reading
# for free.
#
# PYTHON CONCEPT: Type Hints  (the ": str", ": int" parts)
# Python is dynamically typed, but type hints are optional
# labels that tell you (and tools like PyCharm) what type
# a variable should be. They also let Pydantic validate values.
#
# PYTHON CONCEPT: @lru_cache
# A decorator that makes a function run only once and caches
# the result. Since reading .env files has a small cost, we
# don't want to re-read them on every request.
# ==============================================================

from functools import lru_cache  # Standard library — caches function results
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# ---------------------------------------------------------------
# Settings class — inherits from Pydantic's BaseSettings
# BaseSettings automatically reads values from:
#   1. Environment variables (DATABASE_URL=... in your shell)
#   2. A .env file (if you set env_file below)
# ---------------------------------------------------------------
class Settings(BaseSettings):
    """
    All application configuration lives here.
    
    Pydantic will:
    - Read each field from environment variables (case-insensitive)
    - Validate types (e.g., PORT must be an int)
    - Raise a clear error at startup if required values are missing
    
    Why centralise config here?
    - One place to see all config
    - No magic strings scattered through code
    - Easy to change per-environment (dev vs production)
    """

    # --- Application ---
    APP_NAME: str = "SHINSO"                    # Default value — used if env var not set
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True                          # Set to False in production!
    
    # --- Database ---
    # Full connection string for PostgreSQL.
    # Database Connection
    # For local development testing, we will use a local SQLite file so you don't
    # need an active Azure PostgreSQL server spinning right now.
    DATABASE_URL: str = "sqlite+aiosqlite:///./crm_local.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_scheme(cls, v: str) -> str:
        # Railway injects postgres:// — SQLAlchemy async requires postgresql+asyncpg://
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    # Think of this like a pool of workers waiting to handle DB queries
    DB_POOL_SIZE: int = 10         # Number of persistent connections
    DB_MAX_OVERFLOW: int = 20      # Extra connections allowed under load
    DB_POOL_TIMEOUT: int = 30      # Seconds to wait before giving up

    # --- Anthropic ---
    ANTHROPIC_API_KEY: str = ""

    # --- Email (Resend) ---
    # Sign up free at resend.com → API Keys → Create Key
    RESEND_API_KEY: str = ""
    ADMIN_EMAIL: str = "saketh.kalam@gmail.com"
    BACKEND_URL: str = "https://web-production-57d8e.up.railway.app"

    # --- JWT Authentication ---
    # This is the secret key used to sign JWT tokens.
    # IMPORTANT: Change this to a long random string in production!
    # Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION-use-secrets.token_hex(32)"
    
    # Algorithm used to sign the JWT. HS256 is standard and secure.
    ALGORITHM: str = "HS256"
    
    # How long the access token lasts (in minutes).
    # Short = more secure. 30 minutes is a common production setting.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Refresh tokens last much longer — used to get new access tokens
    # without the user re-logging in.
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Redis (for caching in Session 6) ---
    REDIS_URL: str = "redis://localhost:6379"

    # --- CORS (Cross-Origin Resource Sharing) ---
    # Which frontend domains are allowed to call our API.
    # Set FRONTEND_URL in Railway Variables to your Vercel deployment URL.
    # main.py builds the origins list dynamically, filtering out empty strings.
    #
    # PYTHON CONCEPT: list[str] means a list where every item is a string
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    FRONTEND_URL: str = ""  # Set to e.g. https://shinso.vercel.app in Railway Variables

    # --- Pydantic Settings Config ---
    # model_config tells Pydantic how to behave
    model_config = SettingsConfigDict(
        env_file=".env",          # Read from a .env file in the project root
        env_file_encoding="utf-8",
        case_sensitive=False,     # DATABASE_URL and database_url both work
        extra="ignore",           # Ignore extra env vars we don't define here
    )


# ---------------------------------------------------------------
# @lru_cache decorator
# 
# PYTHON CONCEPT: Decorators (@something)
# A decorator is a function that "wraps" another function to add
# behaviour. @lru_cache makes get_settings() run once and cache
# the Settings object. All subsequent calls return the same object.
#
# Why? Reading .env files on every API request would be wasteful.
# ---------------------------------------------------------------
@lru_cache
def get_settings() -> Settings:
    """
    Returns the application settings singleton.
    
    Usage anywhere in the app:
        from app.config import get_settings
        settings = get_settings()
        print(settings.APP_NAME)
    """
    return Settings()


# This is a module-level convenience variable.
# Import `settings` directly instead of calling get_settings() each time.
# Example: from app.config import settings
settings = get_settings()
