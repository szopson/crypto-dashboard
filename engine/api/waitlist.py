"""
Waitlist API Router.

Handles email signups from landing page.
"""
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
import re
from sqlalchemy import select
from loguru import logger

from database import async_session_maker
from models import WaitlistEntry
from services.telegram import get_telegram_service

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistSignup(BaseModel):
    """Waitlist signup request."""
    email: str
    interest: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Invalid email address")
        return v.lower()


class WaitlistResponse(BaseModel):
    """Waitlist signup response."""
    success: bool
    message: str


@router.post("", response_model=WaitlistResponse)
async def join_waitlist(signup: WaitlistSignup):
    """
    Join the waitlist.

    Saves email to database and sends Telegram notification.
    """
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
        )
        session.add(entry)
        await session.commit()

        logger.info(f"New waitlist signup: {signup.email}")

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
            message="You're on the list! We'll be in touch soon."
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
