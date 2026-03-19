# Medical Device CRM — Backend

FastAPI + PostgreSQL + SQLAlchemy (async) · Python 3.11+

---

## 🐍 Python Fresher's Setup Guide (PyCharm)

### Step 1 — Install Python
Download Python 3.11 or newer from https://python.org/downloads/
During installation, **check "Add Python to PATH"**.

Verify it works — open PyCharm's Terminal (bottom of screen) and type:
```bash
python --version
# Should print: Python 3.11.x
```

---

### Step 2 — Open the Project in PyCharm
1. Open PyCharm
2. **File → Open** → select the `crm-backend` folder
3. PyCharm will detect it's a Python project

---

### Step 3 — Create a Virtual Environment
A virtual environment is an isolated Python installation for this project.
It keeps packages separate from other projects on your machine.

In PyCharm:
1. **File → Settings → Project → Python Interpreter**
2. Click the gear icon → **Add Interpreter → Add Local Interpreter**
3. Select **Virtualenv Environment** → **New**
4. Location: `crm-backend/venv` (PyCharm usually fills this in)
5. Base interpreter: select your Python 3.11
6. Click **OK**

PyCharm will create a `venv/` folder and activate it automatically.

Alternatively, via Terminal:
```bash
# In the crm-backend/ folder
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# You'll see (venv) at the start of your terminal prompt
```

---

### Step 4 — Install Dependencies
With the virtual environment active:
```bash
pip install -r requirements.txt
```
This reads `requirements.txt` and installs every package listed.
It may take 1-2 minutes.

---

### Step 5 — Set Up PostgreSQL
1. Download PostgreSQL from https://postgresql.org/download/
2. During installation, remember the password you set for the `postgres` user
3. Open **pgAdmin** (installed with PostgreSQL)
4. Right-click **Databases → Create → Database**
5. Name it: `crm_db`
6. Click **Save**

---

### Step 6 — Configure Environment Variables
```bash
# Copy the example file
cp .env.example .env
```

Open `.env` in PyCharm and update:
```
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/crm_db
SECRET_KEY=any-long-random-string-you-make-up-for-now
```

Replace `YOUR_PASSWORD` with the password you set when installing PostgreSQL.

---

### Step 7 — Run the Server

**Option A — PyCharm Run Configuration (recommended):**
1. Open `app/main.py`
2. You'll see a green ▶ play button next to `if __name__ == "__main__":`
3. Click it → **Run 'main'**

**Option B — Terminal:**
```bash
# From the crm-backend/ folder, with venv activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`--reload` means the server automatically restarts when you change code.

---

### Step 8 — Verify It Works
Open your browser and visit:

| URL | What you'll see |
|-----|-----------------|
| http://localhost:8000 | `{"message": "Welcome to Medical Device CRM API"}` |
| http://localhost:8000/health | `{"status": "healthy", ...}` |
| http://localhost:8000/docs | Swagger UI — interactive API explorer ✨ |
| http://localhost:8000/redoc | Clean API documentation |

If you see the Swagger UI — 🎉 **Session 1 is complete!**

---

## 📁 Project Structure

```
crm-backend/
├── app/
│   ├── __init__.py          # Makes 'app' a Python package
│   ├── main.py              # FastAPI app, CORS, middleware, routers
│   ├── config.py            # Environment variables & settings
│   ├── database.py          # SQLAlchemy engine & session management
│   │
│   ├── models/              # SQLAlchemy database models (Session 2)
│   │   └── __init__.py
│   │
│   ├── schemas/             # Pydantic request/response schemas (Session 2)
│   │   └── __init__.py
│   │
│   ├── routers/             # FastAPI route handlers (Sessions 3-6)
│   │   └── __init__.py
│   │
│   └── services/            # Business logic & database queries (Sessions 3-6)
│       └── __init__.py
│
├── requirements.txt         # Python package dependencies
├── .env.example             # Template for environment variables
├── .env                     # YOUR local config (do NOT commit to Git!)
├── .gitignore               # Files Git should ignore
└── README.md                # This file
```

---

## 🔑 Key Python Concepts Used

| Concept | Where | What it means |
|---------|-------|---------------|
| `async def` / `await` | database.py, main.py | Non-blocking code — handles multiple requests at once |
| `class X(Base):` | database.py | Class inheritance — X gets all features of Base |
| `from X import Y` | all files | Import specific thing from a module |
| `@decorator` | main.py | Modifies a function's behaviour |
| `yield` | database.py | Generator — setup/teardown pattern |
| Type hints `: str`, `: int` | config.py | Optional labels for variable types |
| `if __name__ == "__main__":` | main.py | Only runs when file is executed directly |

---

## ▶ What's Next

Complete sessions in order:
- **Session 2** — Database models (User, Account, Contact, Opportunity, Activity)
- **Session 3** — JWT authentication and role-based access
- **Sessions 4-6** — CRUD API endpoints
- **Sessions 7-10** — React frontend
- **Session 11** — Integration
- **Session 12** — Azure deployment
