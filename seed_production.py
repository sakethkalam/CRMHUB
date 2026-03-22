"""
Run this script to seed demo data into the production CRM.
Usage:
  python seed_production.py
"""
import requests

BASE_URL = "https://web-production-57d8e.up.railway.app"

# ── Update these with the account you registered in production ──
EMAIL    = "test@testmail.com"   # change to your email
PASSWORD = "Test1234"            # change to your password
# ────────────────────────────────────────────────────────────────

session = requests.Session()

# 1. Login
print("Logging in...")
resp = session.post(f"{BASE_URL}/users/login", data={"username": EMAIL, "password": PASSWORD})
if resp.status_code != 200:
    print(f"Login failed: {resp.status_code} {resp.text}")
    exit(1)
print("Logged in successfully.")

# 2. Create Accounts
accounts_data = [
    {"name": "Medtronic",          "industry": "Medical Devices",    "website": "medtronic.com"},
    {"name": "Boston Scientific",  "industry": "Medical Devices",    "website": "bostonscientific.com"},
    {"name": "Stryker Corporation","industry": "Medical Technology", "website": "stryker.com"},
    {"name": "Zimmer Biomet",      "industry": "Orthopedics",        "website": "zimmerbiomet.com"},
]

print("\nCreating accounts...")
accounts = {}
for a in accounts_data:
    r = session.post(f"{BASE_URL}/accounts/", json=a)
    if r.status_code == 201:
        acc = r.json()
        accounts[a["name"]] = acc["id"]
        print(f"  ✓ {a['name']} (id={acc['id']})")
    else:
        print(f"  ✗ {a['name']}: {r.text}")

# 3. Create Contacts
contacts_data = [
    {"first_name": "Sarah",   "last_name": "Johnson", "email": "sjohnson@medtronic.com",    "phone": "612-555-0101", "account_id": accounts.get("Medtronic")},
    {"first_name": "Michael", "last_name": "Chen",    "email": "mchen@bostonscientific.com","phone": "508-555-0182", "account_id": accounts.get("Boston Scientific")},
    {"first_name": "Emily",   "last_name": "Davis",   "email": "edavis@stryker.com",         "phone": "269-555-0134", "account_id": accounts.get("Stryker Corporation")},
    {"first_name": "James",   "last_name": "Wilson",  "email": "jwilson@zimmerbiomet.com",   "phone": "574-555-0167", "account_id": accounts.get("Zimmer Biomet")},
    {"first_name": "Lisa",    "last_name": "Martinez","email": "lmartinez@medtronic.com",    "phone": "612-555-0198", "account_id": accounts.get("Medtronic")},
]

print("\nCreating contacts...")
for c in contacts_data:
    if c["account_id"] is None:
        continue
    r = session.post(f"{BASE_URL}/contacts/", json=c)
    if r.status_code == 201:
        print(f"  ✓ {c['first_name']} {c['last_name']}")
    else:
        print(f"  ✗ {c['first_name']} {c['last_name']}: {r.text}")

# 4. Create Opportunities
opportunities_data = [
    {"name": "Medtronic Q2 Spine Deal",       "amount": 125000, "stage": "PROPOSAL",      "account_id": accounts.get("Medtronic")},
    {"name": "BSci Cardiac Rhythm Contract",  "amount": 340000, "stage": "NEGOTIATION",   "account_id": accounts.get("Boston Scientific")},
    {"name": "Stryker Joint Replacement",     "amount": 210000, "stage": "CLOSED_WON",    "account_id": accounts.get("Stryker Corporation")},
    {"name": "Zimmer Knee System Pilot",      "amount": 87000,  "stage": "QUALIFICATION", "account_id": accounts.get("Zimmer Biomet")},
    {"name": "Medtronic Neuro Expansion",     "amount": 450000, "stage": "PROSPECTING",   "account_id": accounts.get("Medtronic")},
    {"name": "BSci EP Lab Equipment",         "amount": 175000, "stage": "CLOSED_WON",    "account_id": accounts.get("Boston Scientific")},
]

print("\nCreating opportunities...")
for o in opportunities_data:
    if o["account_id"] is None:
        continue
    r = session.post(f"{BASE_URL}/opportunities/", json=o)
    if r.status_code == 201:
        print(f"  ✓ {o['name']} — ${o['amount']:,} [{o['stage']}]")
    else:
        print(f"  ✗ {o['name']}: {r.text}")

print("\nDone! Refresh your CRM dashboard.")
