"""
Trading Command Center - FastAPI Application.

Main entry point for the backend API.
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from config import settings
from database import init_db, close_db
from api.routes import router
from report.router import router as report_router
from data.exchange import get_exchange_client
from services.alerts import get_alert_monitor
from services.scheduler import get_scheduler_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info(f"Starting {settings.app_name}...")

    # Initialize database
    await init_db()

    # Initialize exchange client (warm up)
    try:
        exchange = get_exchange_client()
        price = exchange.get_current_price()
        logger.info(f"Connected to {settings.exchange_id}: BTC @ ${price['price']:,.2f}")
    except Exception as e:
        logger.warning(f"Could not connect to exchange on startup: {e}")

    # Start alert monitor if enabled
    alert_monitor = None
    if settings.alert_monitor_enabled:
        try:
            alert_monitor = get_alert_monitor()
            alert_monitor.check_interval = settings.alert_check_interval_seconds
            alert_monitor.sniper_min_confluence = settings.alert_sniper_min_confluence
            await alert_monitor.start()
            logger.info(f"Alert monitor started (interval: {alert_monitor.check_interval}s)")
        except Exception as e:
            logger.warning(f"Could not start alert monitor: {e}")

    # Start scheduler if enabled
    scheduler = None
    if settings.scheduler_enabled:
        try:
            scheduler = get_scheduler_service()
            scheduler.start()

            # Schedule daily briefing if enabled
            if settings.daily_briefing_enabled:
                scheduler.add_daily_briefing(
                    hour=settings.daily_briefing_hour,
                    minute=settings.daily_briefing_minute,
                    timezone=settings.daily_briefing_timezone,
                )

            logger.info("Scheduler started")
        except Exception as e:
            logger.warning(f"Could not start scheduler: {e}")

    logger.info(f"{settings.app_name} started successfully")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.app_name}...")

    # Stop scheduler
    if scheduler and scheduler.is_running:
        scheduler.stop()

    # Stop alert monitor
    if alert_monitor and alert_monitor.running:
        await alert_monitor.stop()

    await close_db()
    logger.info("Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Trading Command Center API - RADAR, Bias, and Structural Analysis",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router, prefix="/api")
app.include_router(report_router, prefix="/api/report")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "api": "/api",
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint for connection monitoring."""
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )
