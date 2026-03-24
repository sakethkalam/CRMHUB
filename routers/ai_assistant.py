"""
AI Assistant endpoints.
POST /ai/ask               — answer a question with optional CRM record context
POST /ai/suggest-next-action — structured next-step recommendation for an opportunity
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import List, Literal

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user
from config import settings
from database import get_db
from models import Account, Activity, Contact, Opportunity, OpportunityStage, User, UserRole
from permissions import ROLE_RANK

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

MODEL = "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    question: str
    context_type: Literal["opportunity", "account", "contact"] | None = None
    context_id: int | None = None


class SourceRef(BaseModel):
    record_type: str
    record_id: int
    name: str


class AskResponse(BaseModel):
    answer: str
    sources: List[SourceRef]


class SuggestRequest(BaseModel):
    opportunity_id: int


class SuggestedTask(BaseModel):
    subject: str
    type: str
    due_days_from_now: int


class SuggestResponse(BaseModel):
    suggested_action: str
    reasoning: str
    suggested_task: SuggestedTask


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _rank(user: User) -> int:
    role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return ROLE_RANK.get(role, 0)


def _fmt_amount(amount: float | None) -> str:
    return f"${amount:,.0f}" if amount else "$0"


def _fmt_date(dt: datetime | None) -> str:
    return dt.strftime("%Y-%m-%d") if dt else "N/A"


def _stage_val(stage) -> str:
    return stage.value if hasattr(stage, "value") else str(stage)


async def _fetch_recent_activities(
    db: AsyncSession,
    *,
    account_id: int | None = None,
    contact_id: int | None = None,
    opportunity_id: int | None = None,
    limit: int = 10,
) -> list[Activity]:
    q = select(Activity)
    if opportunity_id:
        q = q.where(Activity.opportunity_id == opportunity_id)
    elif contact_id:
        q = q.where(Activity.contact_id == contact_id)
    elif account_id:
        q = q.where(Activity.account_id == account_id)
    else:
        return []
    q = q.order_by(Activity.created_at.desc()).limit(limit)
    return (await db.execute(q)).scalars().all()


def _activities_text(activities: list[Activity]) -> str:
    if not activities:
        return "No recent activity recorded."
    lines = []
    for a in activities:
        lines.append(f"  [{_fmt_date(a.created_at)}] {a.type}: {a.description}")
    return "\n".join(lines)


async def _get_opportunity_context(
    opp_id: int,
    current_user: User,
    db: AsyncSession,
) -> tuple[str, list[SourceRef]]:
    """Build context block + sources for a single opportunity."""
    result = await db.execute(select(Opportunity).where(Opportunity.id == opp_id))
    opp = result.scalar_one_or_none()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    # Access check: Sales Rep can only see their own accounts' opps
    if _rank(current_user) < ROLE_RANK[UserRole.MANAGER] and opp.account_id:
        acct_check = await db.execute(
            select(Account).where(Account.id == opp.account_id, Account.owner_id == current_user.id)
        )
        if not acct_check.scalar_one_or_none():
            raise HTTPException(403, "Not authorized to access this opportunity")

    account = None
    if opp.account_id:
        account = (await db.execute(select(Account).where(Account.id == opp.account_id))).scalar_one_or_none()

    contacts: list[Contact] = []
    if opp.account_id:
        contacts = (
            await db.execute(select(Contact).where(Contact.account_id == opp.account_id).limit(5))
        ).scalars().all()

    activities = await _fetch_recent_activities(db, opportunity_id=opp.id)

    lines = [
        "=== OPPORTUNITY ===",
        f"Name: {opp.name}",
        f"Stage: {_stage_val(opp.stage)}",
        f"Amount: {_fmt_amount(opp.amount)}",
        f"Probability: {opp.probability}%",
        f"Weighted Value: {_fmt_amount((opp.amount or 0) * (opp.probability or 0) / 100)}",
        f"Expected Close Date: {_fmt_date(opp.expected_close_date)}",
        f"Forecast Category: {opp.forecast_category}",
        f"Stage Changed At: {_fmt_date(opp.stage_changed_at)}",
    ]
    if opp.close_reason:
        lines.append(f"Close Reason: {opp.close_reason}")
    if account:
        lines += [
            "",
            "=== ACCOUNT ===",
            f"Name: {account.name}",
            f"Industry: {account.industry or 'N/A'}",
            f"Region: {account.region or 'N/A'}",
        ]
    if contacts:
        lines.append("\n=== CONTACTS ===")
        for c in contacts:
            lines.append(f"  {c.first_name} {c.last_name} | {c.email or 'N/A'} | {c.phone or 'N/A'}")

    lines += ["\n=== RECENT ACTIVITIES ===", _activities_text(activities)]

    sources = [SourceRef(record_type="opportunity", record_id=opp.id, name=opp.name)]
    if account:
        sources.append(SourceRef(record_type="account", record_id=account.id, name=account.name))

    return "\n".join(lines), sources


async def _get_account_context(
    account_id: int,
    current_user: User,
    db: AsyncSession,
) -> tuple[str, list[SourceRef]]:
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")
    if _rank(current_user) < ROLE_RANK[UserRole.MANAGER] and account.owner_id != current_user.id:
        raise HTTPException(403, "Not authorized to access this account")

    contacts = (
        await db.execute(select(Contact).where(Contact.account_id == account_id).limit(10))
    ).scalars().all()

    opps = (
        await db.execute(select(Opportunity).where(Opportunity.account_id == account_id).limit(10))
    ).scalars().all()

    activities = await _fetch_recent_activities(db, account_id=account_id)

    lines = [
        "=== ACCOUNT ===",
        f"Name: {account.name}",
        f"Industry: {account.industry or 'N/A'}",
        f"Website: {account.website or 'N/A'}",
        f"Region: {account.region or 'N/A'}",
    ]
    if contacts:
        lines.append("\n=== CONTACTS ===")
        for c in contacts:
            lines.append(f"  {c.first_name} {c.last_name} | {c.email or 'N/A'} | {c.phone or 'N/A'}")
    if opps:
        lines.append("\n=== OPPORTUNITIES ===")
        for o in opps:
            lines.append(
                f"  {o.name} | {_stage_val(o.stage)} | {_fmt_amount(o.amount)} | Close: {_fmt_date(o.expected_close_date)}"
            )
        active = [o for o in opps if _stage_val(o.stage) not in ("Closed Won", "Closed Lost")]
        lines.append(f"  Active pipeline: {_fmt_amount(sum(o.amount or 0 for o in active))}")
    lines += ["\n=== RECENT ACTIVITIES ===", _activities_text(activities)]

    sources = [SourceRef(record_type="account", record_id=account.id, name=account.name)]
    return "\n".join(lines), sources


async def _get_contact_context(
    contact_id: int,
    current_user: User,
    db: AsyncSession,
) -> tuple[str, list[SourceRef]]:
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")

    account = None
    if contact.account_id:
        account = (await db.execute(select(Account).where(Account.id == contact.account_id))).scalar_one_or_none()
        if account and _rank(current_user) < ROLE_RANK[UserRole.MANAGER] and account.owner_id != current_user.id:
            raise HTTPException(403, "Not authorized to access this contact")

    activities = await _fetch_recent_activities(db, contact_id=contact_id)

    lines = [
        "=== CONTACT ===",
        f"Name: {contact.first_name} {contact.last_name}",
        f"Email: {contact.email or 'N/A'}",
        f"Phone: {contact.phone or 'N/A'}",
    ]
    if account:
        lines += [
            "",
            "=== ACCOUNT ===",
            f"Name: {account.name}",
            f"Industry: {account.industry or 'N/A'}",
        ]
    lines += ["\n=== RECENT ACTIVITIES ===", _activities_text(activities)]

    sources = [SourceRef(record_type="contact", record_id=contact.id, name=f"{contact.first_name} {contact.last_name}")]
    if account:
        sources.append(SourceRef(record_type="account", record_id=account.id, name=account.name))
    return "\n".join(lines), sources


# ---------------------------------------------------------------------------
# POST /ai/ask
# ---------------------------------------------------------------------------

@router.post("/ask", response_model=AskResponse)
async def ask(
    req: AskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Answer a free-form question. If context_type + context_id are given,
    the relevant CRM record (plus its recent activities) is injected as context.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY is not configured")

    context_block = ""
    sources: list[SourceRef] = []

    if req.context_type and req.context_id:
        if req.context_type == "opportunity":
            context_block, sources = await _get_opportunity_context(req.context_id, current_user, db)
        elif req.context_type == "account":
            context_block, sources = await _get_account_context(req.context_id, current_user, db)
        elif req.context_type == "contact":
            context_block, sources = await _get_contact_context(req.context_id, current_user, db)

    system = (
        "You are an intelligent CRM assistant. "
        "Answer questions concisely and accurately, basing your answers on the CRM data provided. "
        "If specific data is unavailable, say so rather than guessing. "
        "Format currency as $X,XXX. Format dates as Month D, YYYY."
    )
    if context_block:
        system += f"\n\nHere is the relevant CRM data:\n\n{context_block}"

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": req.question}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(503, "Invalid Anthropic API key")
    except anthropic.APIStatusError as e:
        raise HTTPException(502, f"Anthropic API error: {e.message}")

    answer = next((b.text for b in response.content if b.type == "text"), "")
    return AskResponse(answer=answer, sources=sources)


# ---------------------------------------------------------------------------
# POST /ai/suggest-next-action
# ---------------------------------------------------------------------------

_SUGGEST_SYSTEM = """\
You are an expert sales coach analysing a CRM opportunity.
Given the opportunity data, recent activity, and contacts, recommend the single most impactful next action the sales rep should take.

Respond with ONLY a JSON object matching this exact schema — no markdown fences, no extra text:
{
  "suggested_action": "<concise action title, max 80 chars>",
  "reasoning": "<2-3 sentence explanation grounded in the data>",
  "suggested_task": {
    "subject": "<task subject line>",
    "type": "<one of: Call, Email, Follow Up, Demo, Send Proposal, Other>",
    "due_days_from_now": <integer 1-30>
  }
}
"""

_STAGE_GUIDANCE: dict[str, str] = {
    "Prospecting":   "The deal has just been identified. Focus on qualifying the opportunity.",
    "Qualification": "Assess whether there's a real need, budget, and decision-maker.",
    "Proposal":      "A proposal is being considered. Address objections and confirm value.",
    "Negotiation":   "Terms are being discussed. Move toward commitment and close.",
    "Closed Won":    "The deal is won. Focus on handoff and customer success.",
    "Closed Lost":   "The deal is lost. Consider a post-mortem or re-engagement plan.",
}


@router.post("/suggest-next-action", response_model=SuggestResponse)
async def suggest_next_action(
    req: SuggestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Given an opportunity ID, analyse its current state and return a structured
    recommendation: suggested action, reasoning, and a ready-to-create task.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY is not configured")

    context_block, _ = await _get_opportunity_context(req.opportunity_id, current_user, db)

    # Fetch the opportunity again just for stage guidance
    result = await db.execute(select(Opportunity).where(Opportunity.id == req.opportunity_id))
    opp = result.scalar_one_or_none()
    stage = _stage_val(opp.stage) if opp else "Unknown"
    guidance = _STAGE_GUIDANCE.get(stage, "")

    user_message = (
        f"{context_block}\n\n"
        f"Stage guidance: {guidance}\n\n"
        "What should the sales rep do next? Return JSON only."
    )

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=512,
            system=_SUGGEST_SYSTEM,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(503, "Invalid Anthropic API key")
    except anthropic.APIStatusError as e:
        raise HTTPException(502, f"Anthropic API error: {e.message}")

    raw = next((b.text for b in response.content if b.type == "text"), "")

    try:
        data = json.loads(raw)
        task_data = data.get("suggested_task", {})
        return SuggestResponse(
            suggested_action=data["suggested_action"],
            reasoning=data["reasoning"],
            suggested_task=SuggestedTask(
                subject=task_data["subject"],
                type=task_data.get("type", "Other"),
                due_days_from_now=int(task_data.get("due_days_from_now", 3)),
            ),
        )
    except (json.JSONDecodeError, KeyError) as exc:
        raise HTTPException(502, f"AI returned unexpected format: {exc}. Raw: {raw[:200]}")
