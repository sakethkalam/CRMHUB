"""
seed_data.py — Populate CRMHUB with realistic sample data for saketh.kalam@gmail.com.
Run from project root:  python seed_data.py
"""
import asyncio
import asyncpg
import ssl
import json
from datetime import datetime, timezone, timedelta
import random

DB_URL = "postgresql+asyncpg://admin_crmhub:Sakiabhi%4091@crmhub.postgres.database.azure.com:5432/postgres"

# Parse the URL manually for asyncpg
def parse_db_url(url):
    # Strip driver prefix
    url = url.replace("postgresql+asyncpg://", "")
    user_pass, rest = url.split("@", 1)
    host_port, dbname = rest.rsplit("/", 1)
    user, password = user_pass.split(":", 1)
    from urllib.parse import unquote
    password = unquote(password)
    if ":" in host_port:
        host, port = host_port.rsplit(":", 1)
        port = int(port)
    else:
        host, port = host_port, 5432
    return dict(host=host, port=port, user=user, password=password, database=dbname)

# ── Sample data ────────────────────────────────────────────────────────────────

NOW = datetime.now(timezone.utc)

def dt(days_offset=0, hours=0):
    return NOW + timedelta(days=days_offset, hours=hours)

ACCOUNTS = [
    {"name": "Nexus Technologies",       "industry": "Technology",       "website": "https://nexustech.io",         "region": "West"},
    {"name": "Apex Financial Group",      "industry": "Finance",          "website": "https://apexfinancial.com",    "region": "East"},
    {"name": "Meridian Healthcare",       "industry": "Healthcare",       "website": "https://meridianhc.com",       "region": "Central"},
    {"name": "Solaris Energy Corp",       "industry": "Energy",           "website": "https://solariscorp.com",      "region": "South"},
    {"name": "Vanguard Logistics",        "industry": "Transportation",   "website": "https://vanguardlogistics.com","region": "West"},
    {"name": "Quantum Retail Inc.",       "industry": "Retail",           "website": "https://quantumretail.com",    "region": "East"},
    {"name": "Pinnacle Manufacturing",    "industry": "Manufacturing",    "website": "https://pinnaclemnfg.com",     "region": "Central"},
    {"name": "Horizon Media Group",       "industry": "Media",            "website": "https://horizonmedia.co",      "region": "West"},
    {"name": "Crestview Realty",          "industry": "Real Estate",      "website": "https://crestviewrealty.com",  "region": "South"},
    {"name": "BluePeak Consulting",       "industry": "Consulting",       "website": "https://bluepeak.io",          "region": "East"},
    {"name": "Zephyr Cloud Systems",      "industry": "Technology",       "website": "https://zephyrcloud.io",       "region": "West"},
    {"name": "Ironclad Security Ltd.",    "industry": "Cybersecurity",    "website": "https://ironcladsec.com",      "region": "East"},
]

CONTACTS = [
    # Nexus Technologies
    ("Sarah",    "Chen",      "sarah.chen@nexustech.io",         "+1-415-555-0101", 0),
    ("Marcus",   "Thompson",  "marcus.t@nexustech.io",           "+1-415-555-0102", 0),
    ("Priya",    "Patel",     "priya.patel@nexustech.io",        "+1-415-555-0103", 0),
    # Apex Financial Group
    ("James",    "Walker",    "j.walker@apexfinancial.com",      "+1-212-555-0201", 1),
    ("Laura",    "Simmons",   "laura.s@apexfinancial.com",       "+1-212-555-0202", 1),
    # Meridian Healthcare
    ("Dr. Anita","Ramos",     "a.ramos@meridianhc.com",          "+1-312-555-0301", 2),
    ("Kevin",    "O'Brien",   "kobrien@meridianhc.com",          "+1-312-555-0302", 2),
    # Solaris Energy
    ("Rachel",   "Kim",       "r.kim@solariscorp.com",           "+1-713-555-0401", 3),
    ("Derek",    "Nguyen",    "d.nguyen@solariscorp.com",        "+1-713-555-0402", 3),
    # Vanguard Logistics
    ("Carlos",   "Mendez",    "c.mendez@vanguardlogistics.com",  "+1-503-555-0501", 4),
    ("Emily",    "Zhang",     "e.zhang@vanguardlogistics.com",   "+1-503-555-0502", 4),
    # Quantum Retail
    ("Brian",    "Foster",    "b.foster@quantumretail.com",      "+1-617-555-0601", 5),
    ("Jessica",  "Hart",      "j.hart@quantumretail.com",        "+1-617-555-0602", 5),
    # Pinnacle Manufacturing
    ("Tom",      "Duval",     "t.duval@pinnaclemnfg.com",        "+1-216-555-0701", 6),
    ("Anna",     "Kowalski",  "a.kowalski@pinnaclemnfg.com",     "+1-216-555-0702", 6),
    # Horizon Media
    ("Nina",     "Brooks",    "n.brooks@horizonmedia.co",        "+1-310-555-0801", 7),
    ("Eric",     "Walsh",     "e.walsh@horizonmedia.co",         "+1-310-555-0802", 7),
    # Crestview Realty
    ("Olivia",   "Carter",    "o.carter@crestviewrealty.com",    "+1-404-555-0901", 8),
    # BluePeak Consulting
    ("Daniel",   "Park",      "d.park@bluepeak.io",              "+1-512-555-1001", 9),
    ("Mia",      "Anderson",  "m.anderson@bluepeak.io",          "+1-512-555-1002", 9),
    # Zephyr Cloud
    ("Ryan",     "Larson",    "r.larson@zephyrcloud.io",         "+1-206-555-1101", 10),
    # Ironclad Security
    ("Sandra",   "Mills",     "s.mills@ironcladsec.com",         "+1-703-555-1201", 11),
]

# (name, amount, stage, probability, forecast_category, account_idx, close_days_offset)
OPPORTUNITIES = [
    ("Nexus – Enterprise SaaS License",      185000, "Closed Won",    100, "Closed",    0, -10),
    ("Nexus – API Platform Upgrade",          92000,  "Negotiation",   80,  "Commit",    0,  18),
    ("Nexus – Premium Support Contract",      34000,  "Proposal",      60,  "Best Case", 0,  35),
    ("Apex – Portfolio Analytics Suite",     250000,  "Proposal",      60,  "Best Case", 1,  25),
    ("Apex – Compliance Module",             118000,  "Negotiation",   75,  "Commit",    1,  12),
    ("Apex – Data Warehouse Integration",     67000,  "Qualification", 30,  "Pipeline",  1,  60),
    ("Meridian – Patient Portal System",     310000,  "Closed Won",   100,  "Closed",    2, -20),
    ("Meridian – Telehealth Expansion",      145000,  "Proposal",      50,  "Best Case", 2,  40),
    ("Solaris – Smart Grid Dashboard",       430000,  "Negotiation",   85,  "Commit",    3,   8),
    ("Solaris – Predictive Maintenance AI",  210000,  "Qualification", 25,  "Pipeline",  3,  55),
    ("Vanguard – Fleet Tracking Platform",   175000,  "Closed Won",   100,  "Closed",    4, -5),
    ("Vanguard – Route Optimization Module",  88000,  "Proposal",      55,  "Best Case", 4,  30),
    ("Quantum – POS System Overhaul",        120000,  "Negotiation",   70,  "Commit",    5,  15),
    ("Quantum – Loyalty Platform",            55000,  "Prospecting",   10,  "Pipeline",  5,  90),
    ("Pinnacle – ERP Integration",           390000,  "Proposal",      60,  "Best Case", 6,  28),
    ("Pinnacle – Supply Chain Analytics",    155000,  "Qualification", 35,  "Pipeline",  6,  70),
    ("Horizon – Content Distribution CDN",    78000,  "Negotiation",   80,  "Commit",    7,  10),
    ("Horizon – Ad Analytics Platform",       42000,  "Closed Lost",   0,   "Omitted",   7, -30),
    ("Crestview – CRM Customization",         95000,  "Proposal",      55,  "Best Case", 8,  22),
    ("BluePeak – Strategy Consulting Suite", 200000,  "Closed Won",   100,  "Closed",    9, -15),
    ("BluePeak – Change Management Tools",    68000,  "Qualification", 30,  "Pipeline",  9,  65),
    ("Zephyr – Cloud Migration Bundle",      320000,  "Negotiation",   75,  "Commit",   10,   6),
    ("Zephyr – DevOps Toolchain",             85000,  "Proposal",      60,  "Best Case",10,  45),
    ("Ironclad – SIEM Deployment",           410000,  "Negotiation",   90,  "Commit",   11,   4),
    ("Ironclad – Pen Testing Annual Plan",    72000,  "Qualification", 40,  "Pipeline",  11,  50),
]

# (first, last, email, phone, company, job_title, source, status)
LEADS = [
    ("Alex",     "Turner",   "a.turner@techwave.io",      "+1-408-555-2001", "TechWave Solutions",   "CTO",               "Web",          "Qualified"),
    ("Brooke",   "Collins",  "b.collins@silverline.com",  "+1-617-555-2002", "Silverline Corp",      "VP Sales",          "Referral",     "Contacted"),
    ("Chad",     "Williams", "chad.w@brightpath.com",     "+1-213-555-2003", "BrightPath Inc",       "Founder",           "Cold Call",    "New"),
    ("Diana",    "Lee",      "d.lee@orbitsys.net",        "+1-469-555-2004", "Orbit Systems",        "Director IT",       "Trade Show",   "Qualified"),
    ("Ethan",    "Moore",    "e.moore@precisionco.io",    "+1-512-555-2005", "Precision Co.",        "Procurement Head",  "Email Campaign","Contacted"),
    ("Fiona",    "Grant",    "f.grant@clearview.co",      "+1-303-555-2006", "Clearview Analytics",  "CEO",               "Web",          "New"),
    ("George",   "Harris",   "g.harris@flashnet.com",     "+1-415-555-2007", "FlashNet Media",       "CMO",               "Referral",     "Unqualified"),
    ("Hannah",   "Scott",    "h.scott@devbridge.io",      "+1-206-555-2008", "DevBridge Software",   "Engineering Lead",  "Web",          "Qualified"),
    ("Ian",      "Price",    "i.price@greenleaf.com",     "+1-972-555-2009", "Greenleaf Partners",   "COO",               "Cold Call",    "New"),
    ("Julia",    "Ross",     "j.ross@vertexai.io",        "+1-628-555-2010", "Vertex AI Labs",       "Head of Product",   "Trade Show",   "Contacted"),
    ("Kyle",     "Barnes",   "k.barnes@solidrock.net",    "+1-404-555-2011", "SolidRock Infra",      "IT Manager",        "Email Campaign","Qualified"),
    ("Luna",     "Mitchell", "l.mitchell@wavefront.io",   "+1-224-555-2012", "Wavefront Systems",    "CTO",               "Referral",     "New"),
    ("Mason",    "Rivera",   "m.rivera@cloudpilot.co",    "+1-310-555-2013", "CloudPilot Inc",       "VP Engineering",    "Web",          "Qualified"),
    ("Natasha",  "King",     "n.king@datahub.io",         "+1-718-555-2014", "DataHub Analytics",    "Chief Data Officer","Cold Call",    "Contacted"),
    ("Owen",     "Young",    "o.young@alphastack.com",    "+1-737-555-2015", "AlphaStack Ventures",  "CEO",               "Web",          "New"),
]

# Tasks: (subject, description, type, priority, status, due_offset_days, related_account_idx)
TASKS = [
    ("Follow up with Nexus on SaaS renewal",       "Confirm renewal terms and schedule signing.",             "Follow Up",     "High",   "Open",        2,   0),
    ("Send Apex compliance module proposal",        "Draft and send the PDF proposal to James Walker.",        "Send Proposal", "High",   "Open",        1,   1),
    ("Meridian telehealth demo call",               "Schedule product walkthrough for Dr. Ramos's team.",      "Demo",          "Urgent", "Open",        0,   2),
    ("Call Rachel Kim re: Solaris smart grid",      "Check on procurement approval status.",                   "Call",          "High",   "In Progress", 3,   3),
    ("Vanguard route optimization follow-up email", "Send product comparison sheet.",                          "Email",         "Medium", "Open",        4,   4),
    ("Quantum POS contract review",                 "Legal to review finalized SoW before sending.",           "Follow Up",     "High",   "Open",        1,   5),
    ("Pinnacle ERP integration discovery call",     "Align on integration requirements and timeline.",         "Call",          "Medium", "Open",        5,   6),
    ("Horizon CDN contract finalization",           "Get final sign-off from Eric Walsh.",                     "Follow Up",     "Urgent", "In Progress", 0,   7),
    ("Zephyr cloud migration kickoff prep",         "Prepare kickoff agenda and resource checklist.",          "Follow Up",     "High",   "Open",        3,  10),
    ("Ironclad SIEM commercial proposal",           "Send updated pricing sheet reflecting 3-year discount.",  "Send Proposal", "Urgent", "Open",        1,  11),
    ("Qualify lead: Alex Turner (TechWave)",        "Initial discovery call to understand use case.",          "Call",          "Medium", "Open",        2,   0),
    ("Send BluePeak onboarding schedule",           "Compile onboarding checklist for new account.",           "Email",         "Medium", "Completed",  -3,   9),
    ("Check Crestview CRM customization scope",     "Confirm which modules need customization.",               "Follow Up",     "Low",    "Open",        7,   8),
    ("Review Apex data warehouse requirements",     "Technical review with Laura Simmons.",                    "Call",          "Medium", "Open",        6,   1),
    ("Overdue: Meridian signed contract follow-up", "Contract was supposed to be signed last week.",           "Follow Up",     "Urgent", "Open",       -4,   2),
    ("Overdue: Nexus support contract approval",    "Waiting on budget approval from Sarah Chen.",             "Follow Up",     "High",   "Open",       -2,   0),
    ("Overdue: Solaris maintenance AI POC review",  "POC results due for review.",                             "Follow Up",     "High",   "Open",       -5,   3),
    ("Prepare quarterly pipeline review slides",    "Compile win/loss analysis and stage velocity.",           "Other",         "Medium", "In Progress",  5,   0),
    ("Ironclad pen testing scoping session",        "Define scope, assets, and rules of engagement.",          "Demo",          "High",   "Open",        4,  11),
    ("Update Zephyr opportunity forecast",          "Revise close date and probability after last call.",      "Other",         "Low",    "Open",        1,  10),
]

ACTIVITIES = [
    ("Call",    "Discovery call with Sarah Chen — confirmed Nexus needs enterprise tier. Strong interest.",                  0, 0,   0),
    ("Email",   "Sent API platform upgrade proposal deck to Marcus Thompson. Awaiting feedback.",                            0, 1,   1),
    ("Meeting", "In-person demo with Apex leadership team. Compliance module got very positive reception.",                  1, 3,   3),
    ("Note",    "Meridian closed patient portal deal. Signed 3-year contract. Handoff to CS team scheduled.",                2, 5,   6),
    ("Call",    "Checked in with Rachel Kim. Solaris board approved smart grid budget. Moving to contracts.",                3, 7,   8),
    ("Email",   "Sent Vanguard fleet tracking platform case study + updated pricing.",                                       4, 9,  10),
    ("Meeting", "Quantum POS requirement gathering session. Brian Foster requested a phased rollout option.",                5, 11,  12),
    ("Call",    "Pinnacle ERP call with Tom Duval. Confirmed SAP integration is required. Looping in tech team.",            6, 13,  14),
    ("Email",   "Horizon CDN final contract sent to Eric Walsh for signature. Legal cleared.",                               7, 15,  16),
    ("Note",    "BluePeak deal closed. Best in class implementation timeline — 4 weeks. Great reference account.",           9, 18,  19),
    ("Call",    "Zephyr migration scoping call. Ryan Larson wants a 6-month phased plan. POC agreed.",                      10, 20,  21),
    ("Meeting", "Ironclad security briefing with Sandra Mills. SIEM requirements documented. Executive sponsor confirmed.", 11, 21,  23),
    ("Email",   "Sent Alex Turner (TechWave lead) discovery questions ahead of qualifying call.",                            0, None, None),
    ("Call",    "Called Kyle Barnes (SolidRock lead). Confirmed SIEM interest. Moving to qualified pipeline.",              None, None, None),
    ("Note",    "Negotiation stalled on Horizon ad analytics. Competitor offered lower price. Deal marked lost.",            7, 16,  17),
]


async def run():
    params = parse_db_url(DB_URL)

    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    print("Connecting to database…")
    conn = await asyncpg.connect(**params, ssl=ssl_ctx)

    try:
        # ── Find user ────────────────────────────────────────────────────────────
        user = await conn.fetchrow(
            "SELECT id, email, full_name FROM users WHERE email = $1",
            "saketh.kalam@gmail.com"
        )
        if not user:
            print("ERROR: User saketh.kalam@gmail.com not found. Please register first.")
            return
        user_id = user["id"]
        print(f"Found user: {user['full_name']} (id={user_id})")

        # ── Clear existing sample data owned by this user ────────────────────
        print("Clearing existing sample data…")
        # Order matters: child tables first
        await conn.execute("DELETE FROM tasks WHERE created_by_id = $1", user_id)
        await conn.execute("DELETE FROM activities WHERE user_id = $1", user_id)
        # Get account ids owned by this user
        acct_ids = [r["id"] for r in await conn.fetch(
            "SELECT id FROM accounts WHERE owner_id = $1", user_id
        )]
        if acct_ids:
            await conn.execute("DELETE FROM opportunities WHERE account_id = ANY($1::int[])", acct_ids)
            await conn.execute("DELETE FROM contacts WHERE account_id = ANY($1::int[])", acct_ids)
            await conn.execute("DELETE FROM accounts WHERE owner_id = $1", user_id)
        await conn.execute("DELETE FROM leads WHERE owner_id = $1", user_id)

        # ── Insert Accounts ───────────────────────────────────────────────────
        print("Inserting accounts…")
        account_ids = []
        for acc in ACCOUNTS:
            row = await conn.fetchrow(
                """INSERT INTO accounts (name, industry, website, region, owner_id, created_at, updated_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id""",
                acc["name"], acc["industry"], acc["website"], acc["region"],
                user_id, dt(-random.randint(30, 180))
            )
            account_ids.append(row["id"])
        print(f"  → {len(account_ids)} accounts")

        # ── Insert Contacts ───────────────────────────────────────────────────
        print("Inserting contacts…")
        contact_ids = []
        for c in CONTACTS:
            first, last, email, phone, acct_idx = c
            row = await conn.fetchrow(
                """INSERT INTO contacts (first_name, last_name, email, phone, account_id, created_at)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING id""",
                first, last, email, phone, account_ids[acct_idx],
                dt(-random.randint(15, 150))
            )
            contact_ids.append(row["id"])
        print(f"  → {len(contact_ids)} contacts")

        # ── Insert Opportunities ──────────────────────────────────────────────
        print("Inserting opportunities…")
        opp_ids = []
        for o in OPPORTUNITIES:
            name, amount, stage, prob, forecast_cat, acct_idx, close_offset = o
            close_date = dt(close_offset)
            created_ago = dt(-random.randint(10, 90))

            # Map stage to DB enum values (uppercase underscore)
            stage_map = {
                "Prospecting":   "PROSPECTING",
                "Qualification": "QUALIFICATION",
                "Proposal":      "PROPOSAL",
                "Negotiation":   "NEGOTIATION",
                "Closed Won":    "CLOSED_WON",
                "Closed Lost":   "CLOSED_LOST",
            }
            # forecast_category is varchar — store display strings
            fc_map = {
                "Pipeline":   "Pipeline",
                "Best Case":  "Best Case",
                "Commit":     "Commit",
                "Closed":     "Closed",
                "Omitted":    "Omitted",
            }

            row = await conn.fetchrow(
                """INSERT INTO opportunities
                   (name, amount, stage, probability, forecast_category, expected_close_date,
                    account_id, created_at, updated_at, stage_changed_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$8) RETURNING id""",
                name, float(amount), stage_map[stage], prob, fc_map[forecast_cat],
                close_date, account_ids[acct_idx], created_ago
            )
            opp_ids.append(row["id"])
        print(f"  → {len(opp_ids)} opportunities")

        # ── Insert Leads ──────────────────────────────────────────────────────
        print("Inserting leads…")
        source_map  = {"Web": "Web", "Referral": "Referral", "Cold Call": "Cold Call",
                       "Email Campaign": "Email Campaign", "Trade Show": "Trade Show", "Other": "Other"}
        status_map  = {"New": "New", "Contacted": "Contacted", "Qualified": "Qualified",
                       "Unqualified": "Unqualified", "Converted": "Converted"}
        lead_ids = []
        for ld in LEADS:
            first, last, email, phone, company, job_title, source, status = ld
            row = await conn.fetchrow(
                """INSERT INTO leads
                   (first_name, last_name, email, phone, company_name, job_title,
                    lead_source, status, owner_id, is_converted, created_at, updated_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$10) RETURNING id""",
                first, last, email, phone, company, job_title,
                source_map[source], status_map[status], user_id,
                dt(-random.randint(1, 60))
            )
            lead_ids.append(row["id"])
        print(f"  → {len(lead_ids)} leads")

        # ── Insert Tasks ──────────────────────────────────────────────────────
        print("Inserting tasks…")
        priority_map = {"Low": "Low", "Medium": "Medium", "High": "High", "Urgent": "Urgent"}
        status_map_t = {"Open": "Open", "In Progress": "In Progress",
                        "Completed": "Completed", "Deferred": "Deferred"}
        type_map     = {"Call": "Call", "Email": "Email", "Follow Up": "Follow Up",
                        "Demo": "Demo", "Send Proposal": "Send Proposal", "Other": "Other"}
        for t in TASKS:
            subject, desc, ttype, priority, tstatus, due_offset, acct_idx = t
            completed_at = dt(due_offset) if tstatus == "Completed" else None
            await conn.execute(
                """INSERT INTO tasks
                   (subject, description, type, priority, status, due_date,
                    assigned_to_id, created_by_id, related_account_id, completed_at, created_at, updated_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$10)""",
                subject, desc, type_map[ttype], priority_map[priority],
                status_map_t[tstatus], dt(due_offset),
                user_id, account_ids[acct_idx] if acct_idx is not None else None,
                completed_at, dt(-random.randint(1, 14))
            )
        print(f"  → {len(TASKS)} tasks")

        # ── Insert Activities ─────────────────────────────────────────────────
        print("Inserting activities…")
        for act in ACTIVITIES:
            atype, desc, acct_idx, contact_idx, opp_idx = act
            await conn.execute(
                """INSERT INTO activities (type, description, user_id, account_id, contact_id, opportunity_id, created_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                atype, desc, user_id,
                account_ids[acct_idx]    if acct_idx    is not None else None,
                contact_ids[contact_idx] if contact_idx is not None else None,
                opp_ids[opp_idx]         if opp_idx     is not None else None,
                dt(-random.randint(0, 20))
            )
        print(f"  → {len(ACTIVITIES)} activities")

        print("\n✅ Seed complete!")
        print(f"   {len(account_ids)} accounts, {len(contact_ids)} contacts,")
        print(f"   {len(opp_ids)} opportunities, {len(lead_ids)} leads,")
        print(f"   {len(TASKS)} tasks, {len(ACTIVITIES)} activities")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
