from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime

from models import (
    OpportunityStage, ForecastCategory,
    LeadSource, LeadStatus,
    TaskPriority, TaskStatus, TaskType,
    UserRole,
)

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

# --- User Schemas ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None

class UserCreate(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

class UserUpdate(BaseModel):
    full_name: str | None = None
    region: str | None = None
    current_password: str | None = None
    new_password: str | None = None

    @field_validator('new_password')
    @classmethod
    def new_password_strength(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_approved: bool
    role: UserRole
    region: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Account Schemas ---
class AccountBase(BaseModel):
    name: str
    industry: str | None = None
    website: str | None = None
    region: str | None = None

class AccountCreate(AccountBase):
    pass

class AccountUpdate(AccountBase):
    name: str | None = None

class AccountResponse(AccountBase):
    id: int
    owner_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Contact Schemas ---
class ContactBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr | None = None
    phone: str | None = None
    account_id: int | None = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(ContactBase):
    first_name: str | None = None
    last_name: str | None = None

class ContactResponse(ContactBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Opportunity Schemas ---

class OpportunityBase(BaseModel):
    name: str
    amount: float = 0.0
    stage: OpportunityStage = OpportunityStage.PROSPECTING
    probability: int = 10
    forecast_category: ForecastCategory = ForecastCategory.PIPELINE
    close_reason: str | None = None
    expected_close_date: datetime | None = None
    account_id: int | None = None

class OpportunityCreate(OpportunityBase):
    pass

class OpportunityUpdate(BaseModel):
    name: str | None = None
    amount: float | None = None
    stage: OpportunityStage | None = None
    probability: int | None = None          # override auto-calculated value if needed
    forecast_category: ForecastCategory | None = None
    close_reason: str | None = None
    expected_close_date: datetime | None = None
    account_id: int | None = None

class OpportunityStageUpdate(BaseModel):
    stage: OpportunityStage
    close_reason: str | None = None         # caller can supply reason at stage change time

class OpportunityResponse(OpportunityBase):
    id: int
    weighted_amount: float = 0.0
    stage_changed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Lead Schemas ---
class LeadBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr | None = None
    phone: str | None = None
    company_name: str | None = None
    job_title: str | None = None
    lead_source: LeadSource = LeadSource.OTHER
    status: LeadStatus = LeadStatus.NEW
    notes: str | None = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    company_name: str | None = None
    job_title: str | None = None
    lead_source: LeadSource | None = None
    status: LeadStatus | None = None
    notes: str | None = None


class LeadRead(LeadBase):
    id: int
    is_converted: bool
    converted_at: datetime | None = None
    converted_account_id: int | None = None
    converted_contact_id: int | None = None
    converted_opportunity_id: int | None = None
    owner_id: int | None = None
    owner: UserResponse | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeadConvertRequest(BaseModel):
    account_name: str | None = None          # defaults to company_name or lead full name
    contact_first_name: str | None = None    # defaults to lead first_name
    contact_last_name: str | None = None     # defaults to lead last_name
    opportunity_name: str | None = None      # defaults to "{full_name} Opportunity"
    opportunity_amount: float = 0.0
    opportunity_expected_close_date: datetime | None = None


class LeadConvertResponse(BaseModel):
    converted_account_id: int
    converted_contact_id: int
    converted_opportunity_id: int | None = None
    message: str


# --- Task Schemas ---
class TaskBase(BaseModel):
    subject: str
    description: str | None = None
    due_date: datetime | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.OPEN
    type: TaskType = TaskType.OTHER
    assigned_to_id: int
    related_account_id: int | None = None
    related_contact_id: int | None = None
    related_opportunity_id: int | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    subject: str | None = None
    description: str | None = None
    due_date: datetime | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    type: TaskType | None = None
    assigned_to_id: int | None = None
    related_account_id: int | None = None
    related_contact_id: int | None = None
    related_opportunity_id: int | None = None


class TaskRead(TaskBase):
    id: int
    created_by_id: int
    assigned_to: UserResponse | None = None
    created_by: UserResponse | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
