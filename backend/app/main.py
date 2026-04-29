import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.database import engine, Base
from app.routes import auth, shipments, handoffs, documents, sensors, ai_routes, verify, analytics, admin
from app.config import settings
from app.services.seed import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CryoTrace starting up...")
    Base.metadata.create_all(bind=engine)
    await seed_database()
    logger.info("CryoTrace ready.")
    yield
    logger.info("CryoTrace shutting down.")


app = FastAPI(
    title="CryoTrace API",
    description="Production-grade Cold Chain Provenance, Fraud Prevention, and Predictive Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(shipments.router, prefix="/shipments", tags=["Shipments"])
app.include_router(handoffs.router, prefix="/handoffs", tags=["Handoffs"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(sensors.router, prefix="/sensor", tags=["Sensors"])
app.include_router(ai_routes.router, prefix="/ai", tags=["AI & Analytics"])
app.include_router(verify.router, prefix="/verify", tags=["Public Verify"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "CryoTrace API", "version": "1.0.0"}
