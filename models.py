from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, Enum, Text, Table, event
from sqlalchemy.orm import relationship, validates
import enum

from database import Base


# ---------------------------------------------------------------------------
# Audit log — records every admin/mutating action for compliance visibility
# ---------------------------------------------------------------------------
class NotificationType(str, enum.Enum):
    TASK_DUE      = "TaskDue"
    DEAL_WON      = "DealWon"
    DEAL_LOST     = "DealLost"
    LEAD_ASSIGNED = "LeadAssigned"
    MENTION_NOTE  = "MentionInNote"


class Notification(Base):
    __tablename__ = "notifications"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type                = Column(Enum(NotificationType, values_callable=lambda obj: [e.value for e in obj], native_enum=False), nullable=False)
    title               = Column(String(255), nullable=False)
    message             = Column(Text, nullable=False)
    is_read             = Column(Boolean, default=False, nullable=False)
    related_record_type = Column(String(100), nullable=True)   # e.g. "opportunity", "task", "lead"
    related_record_id   = Column(Integer, nullable=True)
    created_at          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])


class AuditLog(Base):
    __tablename__ = "audit_log"

    id         = Column(Integer, primary_key=True, index=True)
    timestamp  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_email = Column(String(255), nullable=True)   # denormalised so history survives user deletion
    action     = Column(String(20),  nullable=False)  # CREATE | UPDATE | DELETE
    table_name = Column(String(100), nullable=False)
    record_id  = Column(Integer,     nullable=True)
    changes    = Column(Text,        nullable=True)   # JSON: {"old": {...}, "new": {...}}


# ---------------------------------------------------------------------------
# System settings — key / JSON-value pairs managed by Admins
# ---------------------------------------------------------------------------
class SystemSetting(Base):
    __tablename__ = "system_settings"

    key   = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)   # JSON-encoded scalar or object

class UserRole(str, enum.Enum):
    ADMIN     = "Admin"
    MANAGER   = "Manager"
    SALES_REP = "Sales Rep"
    READ_ONLY = "Read Only"


class ForecastCategory(str, enum.Enum):
    PIPELINE  = "Pipeline"
    BEST_CASE = "Best Case"
    COMMIT    = "Commit"
    CLOSED    = "Closed"
    OMITTED   = "Omitted"


# Maps each stage to its default probability (0-100)
STAGE_PROBABILITY: dict[str, int] = {
    "Prospecting":   10,
    "Qualification": 20,
    "Proposal":      50,
    "Negotiation":   75,
    "Closed Won":   100,
    "Closed Lost":    0,
}


class TaskPriority(str, enum.Enum):
    LOW    = "Low"
    MEDIUM = "Medium"
    HIGH   = "High"
    URGENT = "Urgent"


class TaskStatus(str, enum.Enum):
    OPEN        = "Open"
    IN_PROGRESS = "In Progress"
    COMPLETED   = "Completed"
    DEFERRED    = "Deferred"


class TaskType(str, enum.Enum):
    CALL          = "Call"
    EMAIL         = "Email"
    FOLLOW_UP     = "Follow Up"
    DEMO          = "Demo"
    SEND_PROPOSAL = "Send Proposal"
    OTHER         = "Other"


class LeadSource(str, enum.Enum):
    WEB = "Web"
    REFERRAL = "Referral"
    COLD_CALL = "Cold Call"
    EMAIL_CAMPAIGN = "Email Campaign"
    TRADE_SHOW = "Trade Show"
    OTHER = "Other"


class LeadStatus(str, enum.Enum):
    NEW = "New"
    CONTACTED = "Contacted"
    QUALIFIED = "Qualified"
    UNQUALIFIED = "Unqualified"
    CONVERTED = "Converted"


class OpportunityStage(str, enum.Enum):
    """Stages representing our sales pipeline for the Kanban board"""
    PROSPECTING = "Prospecting"
    QUALIFICATION = "Qualification"
    PROPOSAL = "Proposal"
    NEGOTIATION = "Negotiation"
    CLOSED_WON = "Closed Won"
    CLOSED_LOST = "Closed Lost"


class RegulatoryStatus(str, enum.Enum):
    APPROVED        = "Approved"
    PENDING         = "Pending"
    DISCONTINUED    = "Discontinued"
    INVESTIGATIONAL = "Investigational"


class DeviceClass(str, enum.Enum):
    CLASS_I   = "Class I"
    CLASS_II  = "Class II"
    CLASS_III = "Class III"


# ---------------------------------------------------------------------------
# Product hierarchy — association tables (defined before ORM classes)
# ---------------------------------------------------------------------------

opportunity_products = Table(
    "opportunity_products",
    Base.metadata,
    Column("opportunity_id", Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), primary_key=True),
    Column("product_id",     Integer, ForeignKey("products.id",      ondelete="CASCADE"), primary_key=True),
)

lead_products = Table(
    "lead_products",
    Base.metadata,
    Column("lead_id",    Integer, ForeignKey("leads.id",    ondelete="CASCADE"), primary_key=True),
    Column("product_id", Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    is_active = Column(Boolean, default=False)   # False until admin approves
    is_approved = Column(Boolean, default=False)  # Admin must approve new registrations
    role = Column(Enum(UserRole, values_callable=lambda obj: [e.value for e in obj]), default=UserRole.SALES_REP, nullable=False)
    region = Column(String(100), nullable=True)   # e.g. "North", "West" — used for Manager scoping
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime(timezone=True), nullable=True)   # recorded on each successful login
    
    # Relationships
    accounts = relationship("Account", back_populates="owner")
    activities = relationship("Activity", back_populates="user")
    leads = relationship("Lead", back_populates="owner")
    assigned_tasks = relationship("Task", back_populates="assigned_to", foreign_keys="Task.assigned_to_id")
    created_tasks  = relationship("Task", back_populates="created_by",  foreign_keys="Task.created_by_id")


class Account(Base):
    """Represents a Company or Organization."""
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    industry = Column(String(100))
    website = Column(String(255))
    region = Column(String(100), nullable=True)   # e.g. "North", "West"
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    owner = relationship("User", back_populates="accounts")
    contacts = relationship("Contact", back_populates="account", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="account", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="account", cascade="all, delete-orphan")


class Contact(Base):
    """Represents an individual person at an Account."""
    __tablename__ = "contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(50))
    
    account_id = Column(Integer, ForeignKey("accounts.id"))
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    account = relationship("Account", back_populates="contacts")
    activities = relationship("Activity", back_populates="contact")


class Opportunity(Base):
    """Represents a potential deal or sale."""
    __tablename__ = "opportunities"

    id   = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)

    amount      = Column(Float, default=0.0)
    stage       = Column(Enum(OpportunityStage), default=OpportunityStage.PROSPECTING, nullable=False)
    probability = Column(Integer, default=10)   # 0-100; auto-set when stage changes

    forecast_category = Column(Enum(ForecastCategory, values_callable=lambda obj: [e.value for e in obj], native_enum=False), default=ForecastCategory.PIPELINE)
    close_reason      = Column(String(255), nullable=True)   # set on Closed Won / Closed Lost

    expected_close_date = Column(DateTime(timezone=True))
    stage_changed_at    = Column(DateTime(timezone=True), nullable=True)

    account_id = Column(Integer, ForeignKey("accounts.id"))

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    account    = relationship("Account", back_populates="opportunities")
    activities = relationship("Activity", back_populates="opportunity")
    products   = relationship("Product", secondary=opportunity_products, backref="opportunities")

    # ----------------------------------------------------------------
    # Computed property — not stored in DB
    # ----------------------------------------------------------------
    @property
    def weighted_amount(self) -> float:
        """amount * probability / 100"""
        return round((self.amount or 0) * (self.probability or 0) / 100, 2)

    # ----------------------------------------------------------------
    # Auto-update probability + stage_changed_at when stage is set
    # ----------------------------------------------------------------
    @validates("stage")
    def _on_stage_change(self, key, new_stage):
        stage_value = new_stage.value if hasattr(new_stage, "value") else str(new_stage)
        self.probability     = STAGE_PROBABILITY.get(stage_value, self.probability)
        self.stage_changed_at = datetime.now(timezone.utc)
        return new_stage


class Lead(Base):
    """Represents a potential customer before they enter the sales pipeline."""
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(50))
    company_name = Column(String(255))
    job_title = Column(String(100))

    lead_source = Column(Enum(LeadSource, values_callable=lambda obj: [e.value for e in obj], native_enum=False), default=LeadSource.OTHER)
    status = Column(Enum(LeadStatus, values_callable=lambda obj: [e.value for e in obj], native_enum=False), default=LeadStatus.NEW, nullable=False)

    notes = Column(Text, nullable=True)
    is_converted = Column(Boolean, default=False)
    converted_at = Column(DateTime(timezone=True), nullable=True)

    # Conversion targets (populated when lead is converted)
    converted_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    converted_contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    converted_opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True)

    owner_id = Column(Integer, ForeignKey("users.id"))

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    owner = relationship("User", back_populates="leads")
    converted_account     = relationship("Account",     foreign_keys=[converted_account_id])
    converted_contact     = relationship("Contact",     foreign_keys=[converted_contact_id])
    converted_opportunity = relationship("Opportunity", foreign_keys=[converted_opportunity_id])
    products              = relationship("Product", secondary=lead_products, backref="leads")


class Task(Base):
    """Sales rep follow-ups and reminders linked to CRM records."""
    __tablename__ = "tasks"

    id          = Column(Integer, primary_key=True, index=True)
    subject     = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date    = Column(DateTime(timezone=True), nullable=True)

    priority = Column(Enum(TaskPriority, values_callable=lambda obj: [e.value for e in obj], native_enum=False), default=TaskPriority.MEDIUM, nullable=False)
    status   = Column(Enum(TaskStatus,   values_callable=lambda obj: [e.value for e in obj], native_enum=False), default=TaskStatus.OPEN,     nullable=False)
    type     = Column(Enum(TaskType,     values_callable=lambda obj: [e.value for e in obj], native_enum=False), default=TaskType.OTHER,       nullable=False)

    # Ownership
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Optional CRM record links
    related_account_id     = Column(Integer, ForeignKey("accounts.id"),     nullable=True)
    related_contact_id     = Column(Integer, ForeignKey("contacts.id"),     nullable=True)
    related_opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True)

    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    assigned_to  = relationship("User",        back_populates="assigned_tasks", foreign_keys=[assigned_to_id])
    created_by   = relationship("User",        back_populates="created_tasks",  foreign_keys=[created_by_id])
    related_account     = relationship("Account",     foreign_keys=[related_account_id])
    related_contact     = relationship("Contact",     foreign_keys=[related_contact_id])
    related_opportunity = relationship("Opportunity", foreign_keys=[related_opportunity_id])


class Activity(Base):
    """Represents an interaction like a Note, Call, or Meeting."""
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False) # e.g., "Note", "Call", "Email", "Meeting"
    description = Column(Text, nullable=False)
    
    # Who created this activity?
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # What is this activity related to? (Polymorphic-esque approach via multiple nullable foreign keys)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = relationship("User", back_populates="activities")
    account = relationship("Account", back_populates="activities")
    contact = relationship("Contact", back_populates="activities")
    opportunity = relationship("Opportunity", back_populates="activities")


# ---------------------------------------------------------------------------
# Product hierarchy — 3-level: Category → Family → Product
# ---------------------------------------------------------------------------

class ProductCategory(Base):
    """Top-level grouping (e.g. Imaging, Surgical, Monitoring)."""
    __tablename__ = "product_categories"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    families = relationship("ProductFamily", back_populates="category", cascade="all, delete-orphan")


class ProductFamily(Base):
    """Mid-level grouping within a category (e.g. MRI Systems, Orthopedic Implants)."""
    __tablename__ = "product_families"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(255), nullable=False, index=True)
    category_id       = Column(Integer, ForeignKey("product_categories.id", ondelete="CASCADE"), nullable=False)
    description       = Column(Text, nullable=True)
    therapeutic_area  = Column(String(255), nullable=True)
    is_active         = Column(Boolean, default=True, nullable=False)
    created_at        = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at        = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    category = relationship("ProductCategory", back_populates="families")
    products = relationship("Product", back_populates="family", cascade="all, delete-orphan")


class Product(Base):
    """Individual SKU — leaf node of the product hierarchy."""
    __tablename__ = "products"

    id                  = Column(Integer, primary_key=True, index=True)
    sku                 = Column(String(100), unique=True, nullable=False, index=True)
    name                = Column(String(255), nullable=False, index=True)
    family_id           = Column(Integer, ForeignKey("product_families.id", ondelete="CASCADE"), nullable=False)
    description         = Column(Text, nullable=True)
    unit_price          = Column(Float, default=0.0, nullable=False)
    currency            = Column(String(10), default="USD", nullable=False)
    unit_of_measure     = Column(String(50), nullable=True)   # e.g. "each", "box of 10"
    regulatory_status   = Column(
        Enum(RegulatoryStatus, values_callable=lambda obj: [e.value for e in obj], native_enum=False),
        default=RegulatoryStatus.PENDING,
        nullable=False,
    )
    device_class        = Column(
        Enum(DeviceClass, values_callable=lambda obj: [e.value for e in obj], native_enum=False),
        nullable=True,
    )
    is_active           = Column(Boolean, default=True, nullable=False)
    launch_date         = Column(DateTime(timezone=True), nullable=True)
    discontinue_date    = Column(DateTime(timezone=True), nullable=True)
    created_at          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    family = relationship("ProductFamily", back_populates="products")

    @property
    def family_name(self) -> str:
        return self.family.name if self.family else ""

    @property
    def category_name(self) -> str:
        return self.family.category.name if self.family and self.family.category else ""
