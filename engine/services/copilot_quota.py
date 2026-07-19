"""
Per-user daily quota for the copilot's Claude calls (chat/analysis/briefing).

Mirrors the concurrency-safe shape of the Supabase consume_ai_setup_quota RPC:
the increment is a single conditional UPDATE (`count < limit`), so concurrent
requests cannot overshoot the limit — there is no check-then-increment race.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models import CopilotUsage


async def consume_copilot_quota(
    session: AsyncSession,
    user_id: str,
    limit: int,
) -> Optional[int]:
    """
    Consume one copilot call. Returns messages remaining after this call,
    or None when the daily limit is already exhausted.
    """
    day = datetime.utcnow().strftime("%Y-%m-%d")

    async def try_increment() -> Optional[int]:
        result = await session.execute(
            update(CopilotUsage)
            .where(
                CopilotUsage.user_id == user_id,
                CopilotUsage.day == day,
                CopilotUsage.count < limit,
            )
            .values(count=CopilotUsage.count + 1)
        )
        if result.rowcount != 1:
            return None
        await session.commit()
        used = await session.scalar(
            select(CopilotUsage.count).where(
                CopilotUsage.user_id == user_id, CopilotUsage.day == day
            )
        )
        return max(0, limit - (used or limit))

    remaining = await try_increment()
    if remaining is not None:
        return remaining

    # No row updated: either today's row doesn't exist yet, or it's at limit.
    existing = await session.scalar(
        select(CopilotUsage.count).where(
            CopilotUsage.user_id == user_id, CopilotUsage.day == day
        )
    )
    if existing is not None:
        return None  # at limit

    try:
        session.add(CopilotUsage(user_id=user_id, day=day, count=1))
        await session.commit()
        return limit - 1
    except IntegrityError:
        # Lost a first-message race — the row exists now; one retry settles it.
        await session.rollback()
        return await try_increment()
