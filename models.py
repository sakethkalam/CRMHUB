from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, Enum, Text
from sqlalchemy.orm import relationship
import enum

from database import Base

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

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    is_active = Column(Boolean, default=False)   # False until admin approves
    is_approved = Column(Boolean, default=False)  # Admin must approve new registrations
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    accounts = relationship("Account", back_populates="owner")
    activities = relationship("Activity", back_populates="user")
    leads = relationship("Lead", back_populates="owner")


class Account(Base):
    """Represents a Company or Organization."""
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    industry = Column(String(100))
    website = Column(String(255))
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
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    amount = Column(Float, default=0.0)
    stage = Column(Enum(OpportunityStage), default=OpportunityStage.PROSPECTING, nullable=False)
    expected_close_date = Column(DateTime(timezone=True))
    
    account_id = Column(Integer, ForeignKey("accounts.id"))
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    account = relationship("Account", back_populates="opportunities")
    activities = relationship("Activity", back_populates="opportunity")


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

    lead_source = Column(Enum(LeadSource), default=LeadSource.OTHER)
    status = Column(Enum(LeadStatus), default=LeadStatus.NEW, nullable=False)

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
    converted_account = relationship("Account", foreign_keys=[converted_account_id])
    converted_contact = relationship("Contact", foreign_keys=[converted_contact_id])
    converted_opportunity = relationship("Opportunity", foreign_keys=[converted_opportunity_id])


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
