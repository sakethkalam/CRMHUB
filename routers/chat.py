from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List
import anthropic
import json

from database import get_db
from models import Account, Contact, Opportunity, User
from auth import get_current_user
from config import settings

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


def _build_crm_context(accounts, contacts, opportunities) -> str:
    lines = []

    lines.append("=== ACCOUNTS ===")
    if accounts:
        # Build a name map for reference
        account_name_map = {a.id: a.name for a in accounts}
        for a in accounts:
            lines.append(f"- [{a.id}] {a.name} | Industry: {a.industry or 'N/A'} | Website: {a.website or 'N/A'}")
    else:
        account_name_map = {}
        lines.append("No accounts.")

    lines.append("\n=== CONTACTS ===")
    if contacts:
        for c in contacts:
            acct_name = account_name_map.get(c.account_id, f"Account #{c.account_id}")
            lines.append(
                f"- {c.first_name} {c.last_name} | Email: {c.email or 'N/A'} | "
                f"Phone: {c.phone or 'N/A'} | Account: {acct_name}"
            )
    else:
        lines.append("No contacts.")

    lines.append("\n=== OPPORTUNITIES ===")
    if opportunities:
        for o in opportunities:
            acct_name = account_name_map.get(o.account_id, f"Account #{o.account_id}")
            stage = o.stage.value if hasattr(o.stage, 'value') else str(o.stage)
            amount = f"${o.amount:,.0f}" if o.amount else "$0"
            close_date = o.expected_close_date.strftime("%Y-%m-%d") if o.expected_close_date else "N/A"
            lines.append(
                f"- {o.name} | Stage: {stage} | Value: {amount} | "
                f"Close Date: {close_date} | Account: {acct_name}"
            )
    else:
        lines.append("No opportunities.")

    # Pipeline summary
    if opportunities:
        active = [o for o in opportunities if (o.stage.value if hasattr(o.stage, 'value') else str(o.stage)) not in ("Closed Won", "Closed Lost")]
        won = [o for o in opportunities if (o.stage.value if hasattr(o.stage, 'value') else str(o.stage)) == "Closed Won"]
        total_pipeline = sum(o.amount or 0 for o in active)
        total_won = sum(o.amount or 0 for o in won)
        lines.append(f"\n=== PIPELINE SUMMARY ===")
        lines.append(f"- Total deals: {len(opportunities)}")
        lines.append(f"- Active pipeline value: ${total_pipeline:,.0f}")
        lines.append(f"- Closed Won value: ${total_won:,.0f}")
        lines.append(f"- Win rate: {len(won)/len(opportunities)*100:.0f}%")

    return "\n".join(lines)


@router.post("/")
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI chatbot is not configured. Add ANTHROPIC_API_KEY to .env")

    # Fetch all CRM data for this user
    accounts_res = await db.execute(select(Account).where(Account.owner_id == current_user.id))
    accounts = accounts_res.scalars().all()

    account_ids = [a.id for a in accounts]
    contacts, opportunities = [], []

    if account_ids:
        contacts_res = await db.execute(select(Contact).where(Contact.account_id.in_(account_ids)))
        contacts = contacts_res.scalars().all()

        opps_res = await db.execute(select(Opportunity).where(Opportunity.account_id.in_(account_ids)))
        opportunities = opps_res.scalars().all()

    crm_context = _build_crm_context(accounts, contacts, opportunities)

    system_prompt = (
        f"You are an intelligent CRM assistant for {current_user.full_name or current_user.email}. "
        "You have real-time access to their complete CRM data shown below. "
        "Answer questions about accounts, contacts, opportunities, and pipeline performance. "
        "Be concise and data-driven. Format currency clearly (e.g., $50,000). "
        "If asked to summarise or analyse, do so based strictly on the data provided.\n\n"
        f"{crm_context}"
    )

    messages = [{"role": m.role, "content": m.content} for m in req.history]
    messages.append({"role": "user", "content": req.message})

    async_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def generate():
        try:
            async with async_client.messages.stream(
                model="claude-haiku-4-5",
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except anthropic.AuthenticationError:
            yield f"data: {json.dumps({'error': 'Invalid Anthropic API key.'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
