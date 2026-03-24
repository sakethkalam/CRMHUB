"""
routers/search.py — global search across Accounts, Contacts, Opportunities, Leads.

GET /search?q=<query>&types=accounts,contacts,opportunities,leads
"""
from __future__ import annotations

import asyncio
from typing import List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from database import get_db
from models import Account, Contact, Lead, Opportunity, User, UserRole
from permissions import ROLE_RANK

router = APIRouter(prefix="/search", tags=["Search"])

LIMIT_PER_TYPE = 5
ALL_TYPES = {"accounts", "contacts", "opportunities", "leads"}


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class SearchResult(BaseModel):
    id:           int
    type:         str    # "account" | "contact" | "opportunity" | "lead"
    display_name: str
    subtitle:     str
    url:          str


class SearchResponse(BaseModel):
    accounts:      List[SearchResult]
    contacts:      List[SearchResult]
    opportunities: List[SearchResult]
    leads:         List[SearchResult]


# ---------------------------------------------------------------------------
# Role helpers (mirrors other routers)
# ---------------------------------------------------------------------------

def _rank(user: User) -> int:
    role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return ROLE_RANK.get(role, 0)


def _accessible_account_ids_subq(current_user: User):
    if _rank(current_user) >= ROLE_RANK[UserRole.ADMIN]:
        return select(Account.id)
    if _rank(current_user) >= ROLE_RANK[UserRole.MANAGER]:
        if current_user.region:
            return select(Account.id).where(Account.region == current_user.region)
        return select(Account.id)
    return select(Account.id).where(Account.owner_id == current_user.id)


# ---------------------------------------------------------------------------
# Per-type search helpers
# ---------------------------------------------------------------------------

async def _search_accounts(q: str, current_user: User, db: AsyncSession) -> list[SearchResult]:
    pat = f"%{q}%"
    scope = _accessible_account_ids_subq(current_user)
    rows = (await db.execute(
        select(Account)
        .where(
            Account.id.in_(scope),
            or_(
                Account.name.ilike(pat),
                Account.website.ilike(pat),
                Account.industry.ilike(pat),
            ),
        )
        .limit(LIMIT_PER_TYPE)
    )).scalars().all()

    return [
        SearchResult(
            id=r.id,
            type="account",
            display_name=r.name,
            subtitle=r.industry or r.website or "",
            url=f"/accounts",
        )
        for r in rows
    ]


async def _search_contacts(q: str, current_user: User, db: AsyncSession) -> list[SearchResult]:
    pat = f"%{q}%"
    scope = _accessible_account_ids_subq(current_user)
    rows = (await db.execute(
        select(Contact)
        .where(
            Contact.account_id.in_(scope),
            or_(
                Contact.first_name.ilike(pat),
                Contact.last_name.ilike(pat),
                Contact.email.ilike(pat),
            ),
        )
        .limit(LIMIT_PER_TYPE)
    )).scalars().all()

    return [
        SearchResult(
            id=r.id,
            type="contact",
            display_name=f"{r.first_name} {r.last_name}",
            subtitle=r.email or r.phone or "",
            url=f"/contacts",
        )
        for r in rows
    ]


async def _search_opportunities(q: str, current_user: User, db: AsyncSession) -> list[SearchResult]:
    pat = f"%{q}%"
    scope = _accessible_account_ids_subq(current_user)
    rows = (await db.execute(
        select(Opportunity)
        .where(
            Opportunity.account_id.in_(scope),
            Opportunity.name.ilike(pat),
        )
        .limit(LIMIT_PER_TYPE)
    )).scalars().all()

    return [
        SearchResult(
            id=r.id,
            type="opportunity",
            display_name=r.name,
            subtitle=(
                f"${r.amount:,.0f} · "
                + (r.stage.value if hasattr(r.stage, "value") else str(r.stage))
            ),
            url=f"/opportunities",
        )
        for r in rows
    ]


async def _search_leads(q: str, current_user: User, db: AsyncSession) -> list[SearchResult]:
    pat = f"%{q}%"

    # Scope: Admin/Manager see all; Sales Rep sees own leads
    base = select(Lead).where(
        or_(
            Lead.first_name.ilike(pat),
            Lead.last_name.ilike(pat),
            Lead.email.ilike(pat),
            Lead.company_name.ilike(pat),
        )
    )
    if _rank(current_user) < ROLE_RANK[UserRole.MANAGER]:
        base = base.where(Lead.owner_id == current_user.id)

    rows = (await db.execute(base.limit(LIMIT_PER_TYPE))).scalars().all()

    return [
        SearchResult(
            id=r.id,
            type="lead",
            display_name=f"{r.first_name} {r.last_name}",
            subtitle=r.company_name or r.email or "",
            url=f"/leads",
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    types: str = Query(
        "accounts,contacts,opportunities,leads",
        description="Comma-separated list of types to search",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Global search across CRM entities. Results are capped at 5 per type and
    scoped to records the current user can access.
    """
    requested = {t.strip().lower() for t in types.split(",") if t.strip()} & ALL_TYPES
    if not requested:
        requested = ALL_TYPES

    # Run all requested searches concurrently
    results = await asyncio.gather(
        _search_accounts(q, current_user, db)      if "accounts"      in requested else asyncio.sleep(0, result=[]),
        _search_contacts(q, current_user, db)      if "contacts"      in requested else asyncio.sleep(0, result=[]),
        _search_opportunities(q, current_user, db) if "opportunities" in requested else asyncio.sleep(0, result=[]),
        _search_leads(q, current_user, db)         if "leads"         in requested else asyncio.sleep(0, result=[]),
    )

    return SearchResponse(
        accounts=results[0],
        contacts=results[1],
        opportunities=results[2],
        leads=results[3],
    )
