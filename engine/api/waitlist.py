"""
Waitlist API Router.

Handles email signups from landing page.
"""
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from time import time
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
import re
import httpx
from sqlalchemy import select
from loguru import logger

from config import settings
from database import async_session_maker
from models import WaitlistEntry
from services.telegram import get_telegram_service

# Resend email client
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False

# Turnstile secret key
TURNSTILE_SECRET_KEY = getattr(settings, "turnstile_secret_key", None)

router = APIRouter(prefix="/waitlist", tags=["waitlist"])

# Simple in-memory rate limiter
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 5  # requests
RATE_WINDOW = 60  # seconds


def _check_rate_limit(ip: str) -> bool:
    """Check if IP is within rate limit. Returns True if allowed."""
    now = time()
    # Clean old entries
    _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if now - t < RATE_WINDOW]
    if len(_rate_limit_store[ip]) >= RATE_LIMIT:
        return False
    _rate_limit_store[ip].append(now)
    return True


class WaitlistSignup(BaseModel):
    """Waitlist signup request."""
    email: str
    interest: str | None = None
    marketing_consent: bool = False
    turnstile_token: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Invalid email address")
        return v.lower()


async def verify_turnstile(token: str, ip: str) -> bool:
    """Verify Turnstile token with Cloudflare."""
    if not TURNSTILE_SECRET_KEY:
        return True  # Skip validation if no secret key configured

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={
                    "secret": TURNSTILE_SECRET_KEY,
                    "response": token,
                    "remoteip": ip,
                },
            )
            result = response.json()
            return result.get("success", False)
    except Exception as e:
        logger.warning(f"Turnstile verification failed: {e}")
        return False


class WaitlistResponse(BaseModel):
    """Waitlist signup response."""
    success: bool
    message: str


@router.post("", response_model=WaitlistResponse)
async def join_waitlist(signup: WaitlistSignup, request: Request):
    """
    Join the waitlist.

    Saves email to database and sends Telegram notification.
    Rate limited to 5 requests per IP per minute.
    """
    # Rate limit check
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later."
        )

    # Verify Turnstile token if configured
    if TURNSTILE_SECRET_KEY:
        if not signup.turnstile_token:
            raise HTTPException(
                status_code=400,
                detail="Please complete the security verification."
            )
        if not await verify_turnstile(signup.turnstile_token, client_ip):
            raise HTTPException(
                status_code=400,
                detail="Security verification failed. Please try again."
            )

    async with async_session_maker() as session:
        # Check if email already exists
        result = await session.execute(
            select(WaitlistEntry).where(WaitlistEntry.email == signup.email)
        )
        existing = result.scalar_one_or_none()

        if existing:
            return WaitlistResponse(
                success=True,
                message="You're already on the waitlist!"
            )

        # Create new entry
        entry = WaitlistEntry(
            email=signup.email,
            interest=signup.interest,
            marketing_consent=signup.marketing_consent,
        )
        session.add(entry)
        await session.commit()

        logger.info(f"New waitlist signup: {signup.email}")

        # Send welcome email via Resend
        if RESEND_AVAILABLE and settings.resend_api_key:
            try:
                resend.api_key = settings.resend_api_key
                resend.Emails.send({
                    "from": settings.resend_from_email,
                    "to": signup.email,
                    "subject": "Welcome to Follio + Your Free AAVE Report!",
                    "html": f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #1a1a1a;">You're on the list! 🎉</h1>
                        <p>Thanks for joining the Follio waitlist.</p>

                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin: 24px 0; color: white;">
                            <h2 style="margin: 0 0 12px 0; color: white;">🎁 Your Free Report</h2>
                            <p style="margin: 0 0 16px 0; opacity: 0.9;">As a thank you, here's a professional AI-generated investment report for AAVE.</p>
                            <a href="https://follio.io/api/waitlist/free-report"
                               style="display: inline-block; background: white; color: #667eea; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                                Download Report (PDF)
                            </a>
                        </div>

                        <p>We're building professional-grade crypto analysis tools with:</p>
                        <ul>
                            <li>AI-powered investment reports</li>
                            <li>Real-time market analysis</li>
                            <li>Smart trading alerts</li>
                            <li>Portfolio tracking</li>
                        </ul>
                        <p>We'll notify you as soon as we're ready to onboard new users.</p>
                        <p style="color: #666; margin-top: 30px;">
                            — The Follio Team
                        </p>
                    </div>
                    """
                })
                logger.info(f"Welcome email sent to {signup.email}")
            except Exception as e:
                logger.warning(f"Failed to send welcome email: {e}")

        # Send Telegram notification
        telegram = get_telegram_service()
        if telegram.is_available():
            interest_str = f"\nInterest: {signup.interest}" if signup.interest else ""
            await telegram.send_message(
                f"*New Waitlist Signup*\n\n"
                f"Email: `{signup.email}`{interest_str}\n\n"
                f"_{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_"
            )

        return WaitlistResponse(
            success=True,
            message="You're on the list! Check your email for confirmation."
        )


@router.get("/count")
async def get_waitlist_count():
    """Get total waitlist signups count."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(WaitlistEntry)
        )
        entries = result.scalars().all()
        return {"count": len(entries)}


@router.get("/list")
async def get_waitlist_entries():
    """Get all waitlist entries (admin endpoint)."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(WaitlistEntry).order_by(WaitlistEntry.created_at.desc())
        )
        entries = result.scalars().all()
        return {
            "count": len(entries),
            "entries": [
                {
                    "email": e.email,
                    "interest": e.interest,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in entries
            ]
        }


@router.get("/free-report")
async def download_free_report():
    """Download the free altcoin report."""
    report_path = Path(__file__).parent.parent / "static" / "free-report.pdf"

    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")

    return FileResponse(
        path=report_path,
        filename="AAVE_Investment_Report.pdf",
        media_type="application/pdf",
    )
