"""
Scheduler Service for scheduled tasks.

Handles:
- Daily briefings at configured time
- Periodic data snapshots
- Scheduled reports
"""
from datetime import datetime, time
from typing import Optional, Callable
from loguru import logger

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from config import settings
from data.exchange import get_exchange_client
from calculations.radar import calculate_full_radar
from calculations.structure import analyze_structure
from calculations.sniper import analyze_sniper
from services.llm import get_llm_service
from services.telegram import get_telegram_service
from services.cockpit_digest import get_cockpit_digest_service


class SchedulerService:
    """
    Background scheduler for recurring tasks.
    """

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.exchange = get_exchange_client()
        self.telegram = get_telegram_service()
        self.llm = get_llm_service()
        self._started = False

    @property
    def is_running(self) -> bool:
        return self._started and self.scheduler.running

    def start(self):
        """Start the scheduler."""
        if not self._started:
            self.scheduler.start()
            self._started = True
            logger.info("Scheduler started")

    def stop(self):
        """Stop the scheduler."""
        if self._started:
            self.scheduler.shutdown(wait=False)
            self._started = False
            logger.info("Scheduler stopped")

    def add_daily_briefing(
        self,
        hour: int = 8,
        minute: int = 0,
        timezone: str = "Europe/Warsaw",
    ):
        """
        Schedule daily briefing at specified time.

        Args:
            hour: Hour (0-23) in specified timezone
            minute: Minute (0-59)
            timezone: Timezone name (e.g., 'Europe/Warsaw', 'UTC')
        """
        job_id = "daily_briefing"

        # Remove existing job if present
        existing = self.scheduler.get_job(job_id)
        if existing:
            self.scheduler.remove_job(job_id)

        self.scheduler.add_job(
            self._send_daily_briefing,
            trigger=CronTrigger(hour=hour, minute=minute, timezone=timezone),
            id=job_id,
            name="Daily Market Briefing",
            replace_existing=True,
        )

        logger.info(f"Daily briefing scheduled for {hour:02d}:{minute:02d} {timezone}")

    def remove_daily_briefing(self):
        """Remove daily briefing schedule."""
        job_id = "daily_briefing"
        existing = self.scheduler.get_job(job_id)
        if existing:
            self.scheduler.remove_job(job_id)
            logger.info("Daily briefing removed")

    def add_daily_cockpit_digest(
        self,
        hour: int = 9,
        minute: int = 0,
        timezone: str = "Europe/Warsaw",
    ):
        """
        Schedule the daily cockpit digest (X/Telegram content export).

        Delivers a DRAFT to the Telegram admin chat for review — never
        auto-posts to a public channel.
        """
        job_id = "cockpit_digest"

        existing = self.scheduler.get_job(job_id)
        if existing:
            self.scheduler.remove_job(job_id)

        self.scheduler.add_job(
            self._run_cockpit_digest,
            trigger=CronTrigger(hour=hour, minute=minute, timezone=timezone),
            id=job_id,
            name="Daily Cockpit Digest",
            replace_existing=True,
        )

        logger.info(f"Cockpit digest scheduled for {hour:02d}:{minute:02d} {timezone}")

    def remove_daily_cockpit_digest(self):
        """Remove the cockpit digest schedule."""
        job_id = "cockpit_digest"
        existing = self.scheduler.get_job(job_id)
        if existing:
            self.scheduler.remove_job(job_id)
            logger.info("Cockpit digest removed")

    async def _run_cockpit_digest(self):
        """Generate and deliver the daily cockpit digest draft + opportunity cards."""
        logger.info("Generating cockpit digest...")
        try:
            result = await get_cockpit_digest_service().generate_and_deliver(publish=True)
            if result.get("success"):
                logger.info(f"Cockpit digest ready (delivered={result.get('delivered')})")
            else:
                logger.warning(f"Cockpit digest not generated: {result.get('error')}")
        except Exception as e:
            logger.error(f"Error generating cockpit digest: {e}")

        # Opportunity cards ride the same daily cadence and read the same
        # snapshot source, so both surfaces describe one market state.
        try:
            from services.opportunity_engine import get_opportunity_engine_service

            result = await get_opportunity_engine_service().generate()
            if not result.get("success"):
                logger.warning(f"Opportunity cards not generated: {result.get('error')}")
        except Exception as e:
            logger.error(f"Error generating opportunity cards: {e}")

    def add_periodic_snapshot(
        self,
        interval_hours: int = 4,
    ):
        """
        Schedule periodic market snapshots.

        Args:
            interval_hours: Hours between snapshots
        """
        job_id = "periodic_snapshot"

        existing = self.scheduler.get_job(job_id)
        if existing:
            self.scheduler.remove_job(job_id)

        self.scheduler.add_job(
            self._take_market_snapshot,
            trigger=IntervalTrigger(hours=interval_hours),
            id=job_id,
            name="Periodic Market Snapshot",
            replace_existing=True,
        )

        logger.info(f"Periodic snapshot scheduled every {interval_hours} hours")

    async def _send_daily_briefing(self):
        """Generate and send daily briefing."""
        logger.info("Generating daily briefing...")

        try:
            # Gather market data
            price_data = self.exchange.get_current_price()
            funding_data = self.exchange.fetch_funding_rate()
            current_price = price_data.get("price", 0)
            funding_rate = funding_data.get("funding_rate", 0)

            # RADAR
            ohlcv_1d = self.exchange.fetch_ohlcv(timeframe="1d", limit=300)
            radar_result = calculate_full_radar(ohlcv_1d, funding_rate)

            # Bias for all TFs
            biases = {}
            for tf in settings.timeframes:
                ohlcv = self.exchange.fetch_ohlcv(timeframe=tf, limit=300)
                structure = analyze_structure(ohlcv, tf, current_price)
                display_tf = self.exchange.get_display_timeframe(tf)
                biases[display_tf] = {
                    "structural_bias": structure.get("bias", "NEUTRAL"),
                    "secondary_swing_level": structure.get("secondary_swing", {}).get("price"),
                }

            # SNIPER
            ohlcv_by_tf = {tf: self.exchange.fetch_ohlcv(timeframe=tf, limit=300)
                          for tf in settings.timeframes}
            sniper_result = analyze_sniper(ohlcv_by_tf, current_price, funding_rate)

            market_data = {
                "price": price_data,
                "radar": radar_result,
                "bias": {
                    "overall_bias": "BULLISH" if sum(1 for b in biases.values() if b["structural_bias"] == "BULLISH") > len(biases) / 2 else "BEARISH",
                    "biases": biases,
                },
                "sniper": sniper_result,
            }

            # Generate briefing with LLM if available
            if self.llm.is_available():
                result = await self.llm.generate_daily_briefing(market_data)

                if result.get("success") and result.get("briefing"):
                    # Send to Telegram
                    if self.telegram.is_available():
                        await self.telegram.send_daily_briefing(result["briefing"])
                        logger.info("Daily briefing sent to Telegram")
                    else:
                        logger.warning("Telegram not available for briefing")
                else:
                    # Send basic briefing without LLM
                    await self._send_basic_briefing(market_data)
            else:
                # Send basic briefing without LLM
                await self._send_basic_briefing(market_data)

        except Exception as e:
            logger.error(f"Error generating daily briefing: {e}")

            # Try to send error notification
            if self.telegram.is_available():
                await self.telegram.send_message(
                    f"⚠️ *Daily Briefing Error*\n\nCould not generate briefing: {str(e)[:200]}"
                )

    async def _send_basic_briefing(self, market_data: dict):
        """Send basic briefing without LLM."""
        price = market_data.get("price", {})
        radar = market_data.get("radar", {})
        bias = market_data.get("bias", {})
        sniper = market_data.get("sniper", {})

        # Format bias
        bias_lines = []
        for tf, b in bias.get("biases", {}).items():
            emoji = "🟢" if b["structural_bias"] == "BULLISH" else "🔴" if b["structural_bias"] == "BEARISH" else "🟡"
            ss = f" (SS: ${b['secondary_swing_level']:,.0f})" if b.get('secondary_swing_level') else ""
            bias_lines.append(f"  {emoji} {tf}: {b['structural_bias']}{ss}")

        confluence = sniper.get("confluence", {})

        message = f"""
📊 *DAILY BTC BRIEFING*
_{datetime.utcnow().strftime('%Y-%m-%d')}_

💰 *Price:* ${price.get('price', 0):,.0f}
📈 *24h:* {price.get('change_24h', 0):.2f}%

📡 *RADAR Score:* {radar.get('score', 0):.1f}/6
🏷️ *Classification:* {radar.get('classification', 'N/A')}

📐 *Structural Bias:*
{chr(10).join(bias_lines)}

🎯 *SNIPER:* {confluence.get('signal', 'N/A')} ({confluence.get('score', 0)}/5)

_Auto-generated briefing_
"""

        if self.telegram.is_available():
            await self.telegram.send_message(message.strip())
            logger.info("Basic daily briefing sent")

    async def _take_market_snapshot(self):
        """Take and optionally store market snapshot."""
        logger.debug("Taking market snapshot...")

        try:
            price_data = self.exchange.get_current_price()
            funding_data = self.exchange.fetch_funding_rate()

            # Could store to database here if needed
            logger.debug(f"Snapshot: BTC ${price_data.get('price', 0):,.0f}, "
                        f"Funding: {funding_data.get('funding_rate', 0):.4f}%")

        except Exception as e:
            logger.error(f"Error taking snapshot: {e}")

    async def send_briefing_now(self):
        """Send briefing immediately (for testing)."""
        await self._send_daily_briefing()

    def get_jobs(self) -> list:
        """Get list of scheduled jobs."""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            })
        return jobs


# Singleton instance
_scheduler_service: Optional[SchedulerService] = None


def get_scheduler_service() -> SchedulerService:
    """Get or create SchedulerService instance."""
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = SchedulerService()
    return _scheduler_service
