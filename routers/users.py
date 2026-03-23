from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm
import jwt
from jwt.exceptions import InvalidTokenError

from database import get_db
from models import User
from schemas import UserCreate, UserResponse, UserUpdate, Token
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from config import settings
from limiter import limiter
from email_utils import send_approval_request, send_approval_confirmation

router = APIRouter(prefix="/users", tags=["Authentication & Users"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user. Account starts as inactive until the admin approves it.
    An approval email is sent to the admin in the background.
    """
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Please check your details."
        )

    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        is_active=False,     # cannot log in until approved
        is_approved=False,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Send approval email to admin without blocking the response
    background_tasks.add_task(
        send_approval_request,
        user_email=new_user.email,
        user_name=new_user.full_name,
    )

    return new_user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Login. Rate-limited to 5/min per IP. Rejects unapproved accounts."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="pending_approval",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact the administrator.",
        )

    access_token = create_access_token(data={"sub": user.email})

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="none" if not settings.DEBUG else "lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    """Clear the auth cookie server-side."""
    response.delete_cookie(
        "access_token",
        samesite="none" if not settings.DEBUG else "lax",
        secure=not settings.DEBUG,
    )
    return {"message": "Logged out successfully"}


@router.get("/approve", response_class=HTMLResponse)
async def approve_user(token: str, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Admin clicks this link from the email to approve a registration.
    Returns an HTML page confirming the action.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        action = payload.get("type")
        if not email or action != "approve":
            raise ValueError("invalid token")
    except (InvalidTokenError, ValueError):
        return HTMLResponse(_html_page("Invalid or Expired Link",
            "This approval link is invalid or has expired (links expire after 72 hours).", error=True))

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return HTMLResponse(_html_page("User Not Found", f"No user found for {email}.", error=True))

    if user.is_approved:
        return HTMLResponse(_html_page("Already Approved", f"{email} is already approved.", error=False))

    user.is_approved = True
    user.is_active = True
    await db.commit()

    background_tasks.add_task(send_approval_confirmation, user.email, user.full_name, approved=True)

    return HTMLResponse(_html_page("Account Approved ✅",
        f"{email} has been approved and can now log in. A confirmation email has been sent to them."))


@router.get("/reject", response_class=HTMLResponse)
async def reject_user(token: str, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Admin clicks this link to reject a registration."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        action = payload.get("type")
        if not email or action != "reject":
            raise ValueError("invalid token")
    except (InvalidTokenError, ValueError):
        return HTMLResponse(_html_page("Invalid or Expired Link",
            "This rejection link is invalid or has expired.", error=True))

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return HTMLResponse(_html_page("User Not Found", f"No user found for {email}.", error=True))

    user.is_approved = False
    user.is_active = False
    await db.commit()

    background_tasks.add_task(send_approval_confirmation, user.email, user.full_name, approved=False)

    return HTMLResponse(_html_page("Account Rejected",
        f"{email} has been rejected. A notification email has been sent to them.", error=True))


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name

    if user_in.new_password:
        if not user_in.current_password:
            raise HTTPException(status_code=400, detail="Current password is required to set a new one")
        if not verify_password(user_in.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        current_user.hashed_password = get_password_hash(user_in.new_password)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


def _html_page(title: str, message: str, error: bool = False) -> str:
    color = "#ef4444" if error else "#10b981"
    icon = "❌" if error else "✅"
    return f"""
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>{title}</title>
    <style>
      body {{ font-family: Arial, sans-serif; display: flex; align-items: center;
               justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }}
      .card {{ background: white; border-radius: 12px; padding: 40px; max-width: 480px;
               text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
      h1 {{ color: {color}; font-size: 22px; margin-bottom: 12px; }}
      p  {{ color: #475569; line-height: 1.6; }}
    </style>
    </head>
    <body>
      <div class="card">
        <div style="font-size:48px;">{icon}</div>
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
    </body></html>
    """
