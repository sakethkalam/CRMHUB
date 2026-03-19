from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm

from database import get_db
from models import User
from schemas import UserCreate, UserResponse, Token
from auth import get_password_hash, verify_password, create_access_token, get_current_user

# Create an APIRouter for all user-related endpoints
router = APIRouter(prefix="/users", tags=["Authentication & Users"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user in the CRM"""
    
    # 1. Check if user already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
        
    # 2. Hash the plain text password
    hashed_password = get_password_hash(user_in.password)
    
    # 3. Create the database object
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name
    )
    
    # 4. Save to database
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Login endpoint. Requires Content-Type: application/x-www-form-urlencoded
    (standard OAuth2 implementation). Returns a JWT access token.
    """
    
    # 1. Authenticate user by email (form_data.username is used for email in OAuth2 spec)
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # 2. Generate and return a secure JWT token
    access_token = create_access_token(data={"sub": user.email})
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """
    Test endpoint for get_current_user dependency.
    If the client sends a valid JWT Authorization header, this returns their details.
    """
    return current_user
