from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from contextlib import asynccontextmanager

from config import settings
from database import engine, Base

# Import all our newly built routers
from routers import users, accounts, contacts, opportunities

# Lifespan context to automatically construct our database tables when the server starts
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Crucial for local dev: Allow the React Vite server (usually port 5173) to bypass CORS blocks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount our microservices explicitly into the app
app.include_router(users.router)
app.include_router(accounts.router)
app.include_router(contacts.router)
app.include_router(opportunities.router)

@app.get("/")
async def root():
    return {"message": "CRM API Backend is running! Access the Swagger UI at /docs"}

if __name__ == "__main__":
    # Provides a default execution profile
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
