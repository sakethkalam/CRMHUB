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
    last_login: datetime | None = None

    class Config:
        from_attributes = True


# --- Admin schemas ---

class AdminUserResponse(UserResponse):
    """Extended user info only returned by admin endpoints."""
    pass  # same fields; kept as a distinct type for OpenAPI clarity


class AdminRoleUpdate(BaseModel):
    role: UserRole


class AdminInviteUser(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: UserRole = UserRole.SALES_REP


class AdminBulkAction(BaseModel):
    user_ids: list[int]


class AuditLogRead(BaseModel):
    id: int
    timestamp: datetime
    user_id: int | None = None
    user_email: str | None = None
    action: str
    table_name: str
    record_id: int | None = None
    changes: str | None = None   # raw JSON string

    class Config:
        from_attributes = True


class SystemSettingsResponse(BaseModel):
    AUTO_GENERATE_AGREEMENT_ON_CLOSE: bool = False
    DEFAULT_AGREEMENT_TYPE: str = "Standard"
    EMAIL_NOTIFICATIONS_ENABLED: bool = True
    MAX_LOGIN_ATTEMPTS: int = 5


class SystemSettingUpdate(BaseModel):
    AUTO_GENERATE_AGREEMENT_ON_CLOSE: bool | None = None
    DEFAULT_AGREEMENT_TYPE: str | None = None
    EMAIL_NOTIFICATIONS_ENABLED: bool | None = None
    MAX_LOGIN_ATTEMPTS: int | None = None

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


# --- Activity Schemas ---
class ActivityCreate(BaseModel):
    type: str
    description: str
    account_id: int | None = None
    contact_id: int | None = None
    opportunity_id: int | None = None


class ActivityResponse(BaseModel):
    id: int
    type: str
    description: str
    user_id: int
    account_id: int | None = None
    contact_id: int | None = None
    opportunity_id: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True
