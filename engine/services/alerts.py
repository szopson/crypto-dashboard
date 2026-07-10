"""
Alert Monitoring Service.

Monitors market conditions and sends Telegram alerts when:
- RADAR classification changes (ACCUMULATE <-> NEUTRAL <-> SELL_THE_RALLY)
- High confluence SNIPER setups appear
- Price approaches key levels (Secondary Swing)
"""
import asyncio
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field
from loguru import logger

from config import settings
from data.exchange import get_exchange_client
from calculations.radar import calculate_full_radar
from calculations.structure import analyze_structure
from calculations.sniper import analyze_sniper
from services.telegram import get_telegram_service


@dataclass
class MarketState:
    """Stores last known market state for change detection."""
    radar_classification: dict[str, str] = field(default_factory=dict)  # TF -> classification
    radar_scores: dict[str, float] = field(default_factory=dict)  # TF -> score
    last_sniper_signal: Optional[str] = None
    last_sniper_score: float = 0
    last_price: float = 0
    last_check: Optional[datetime] = None
    alerted_setups: set = field(default_factory=set)  # Track already alerted setups
    last_sniper_alert_time: Optional[datetime] = None  # SNIPER cooldown
    last_sniper_direction: Optional[str] = None  # direction of last SNIPER alert
    last_alerted_signal: Optional[str] = None  # Track last signal we alerted on
    last_signal_alert_time: Optional[datetime] = None  # Cooldown tracking
    # ICT state
    last_ict_signal_id: Optional[str] = None  # Track last ICT signal
    last_ict_alert_time: Optional[datetime] = None  # ICT cooldown
    last_amd_phase: Optional[str] = None  # Track AMD phase changes


class AlertMonitor:
    """
    Background monitoring service for trading alerts.
    """

    def __init__(
        self,
        check_interval_seconds: int = 300,  # 5 minutes default
        radar_alert_enabled: bool = True,
        sniper_alert_enabled: bool = True,
        sniper_min_confluence: float = 3.5,  # Minimum confluence to alert
        ict_alert_enabled: bool = True,
        ict_min_confidence: float = 0.6,  # Minimum ICT signal confidence
    ):
        self.check_interval = check_interval_seconds
        self.radar_alert_enabled = radar_alert_enabled
        self.sniper_alert_enabled = sniper_alert_enabled
        self.sniper_min_confluence = sniper_min_confluence
        self.ict_alert_enabled = ict_alert_enabled
        self.ict_min_confidence = ict_min_confidence

        self.state = MarketState()
        self.running = False
        self._task: Optional[asyncio.Task] = None

        self.exchange = get_exchange_client()
        self.telegram = get_telegram_service()

    async def start(self):
        """Start the monitoring loop."""
        if self.running:
            logger.warning("Alert monitor already running")
            return

        self.running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info(f"Alert monitor started (interval: {self.check_interval}s)")

    async def stop(self):
        """Stop the monitoring loop."""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Alert monitor stopped")

    async def _monitor_loop(self):
        """Main monitoring loop."""
        # Initial state capture (no alerts on first run)
        await self._capture_initial_state()

        while self.running:
            try:
                await asyncio.sleep(self.check_interval)
                await self._check_and_alert()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Alert monitor error: {e}")
                await asyncio.sleep(60)  # Wait before retry

    async def _capture_initial_state(self):
        """Capture initial market state without sending alerts."""
        try:
            logger.info("Capturing initial market state...")

            # Get current price
            price_data = self.exchange.get_current_price()
            self.state.last_price = price_data.get("price", 0)

            # Get funding rate
            funding_data = self.exchange.fetch_funding_rate()
            funding_rate = funding_data.get("funding_rate", 0)

            # Capture RADAR state for each timeframe
            for tf in settings.radar_timeframes:
                ohlcv = self.exchange.fetch_ohlcv(timeframe=tf, limit=300)
                radar = calculate_full_radar(ohlcv, funding_rate)

                display_tf = self.exchange.get_display_timeframe(tf)
                self.state.radar_classification[display_tf] = radar.get("classification", "NEUTRAL")
                self.state.radar_scores[display_tf] = radar.get("score", 3.0)

            # Capture SNIPER state
            ohlcv_by_tf = {tf: self.exchange.fetch_ohlcv(timeframe=tf, limit=300)
                          for tf in settings.timeframes}
            sniper = analyze_sniper(ohlcv_by_tf, self.state.last_price, funding_rate)

            confluence = sniper.get("confluence", {})
            self.state.last_sniper_signal = confluence.get("signal", "NEUTRAL")
            self.state.last_sniper_score = confluence.get("score", 0)

            self.state.last_check = datetime.utcnow()

            logger.info(f"Initial state captured: RADAR 1D={self.state.radar_classification.get('1D')}, "
                       f"SNIPER={self.state.last_sniper_signal} ({self.state.last_sniper_score}/5)")

        except Exception as e:
            logger.error(f"Error capturing initial state: {e}")

    async def _check_and_alert(self):
        """Check market conditions and send alerts if needed."""
        try:
            # Get current data
            price_data = self.exchange.get_current_price()
            current_price = price_data.get("price", 0)

            funding_data = self.exchange.fetch_funding_rate()
            funding_rate = funding_data.get("funding_rate", 0)

            # Check RADAR changes
            if self.radar_alert_enabled:
                await self._check_radar_changes(funding_rate)

            # Check SNIPER setups
            if self.sniper_alert_enabled:
                await self._check_sniper_setups(current_price, funding_rate)

            # Check ICT signals
            if self.ict_alert_enabled:
                await self._check_ict_signals(current_price)

            self.state.last_price = current_price
            self.state.last_check = datetime.utcnow()

        except Exception as e:
            logger.error(f"Error in check_and_alert: {e}")

    async def _check_radar_changes(self, funding_rate: float):
        """Check for RADAR classification changes."""
        for tf in settings.radar_timeframes:
            try:
                ohlcv = self.exchange.fetch_ohlcv(timeframe=tf, limit=300)
                radar = calculate_full_radar(ohlcv, funding_rate)

                display_tf = self.exchange.get_display_timeframe(tf)
                new_classification = radar.get("classification", "NEUTRAL")
                new_score = radar.get("score", 3.0)

                old_classification = self.state.radar_classification.get(display_tf)

                # Check for classification change
                if old_classification and old_classification != new_classification:
                    await self._send_radar_alert(
                        timeframe=display_tf,
                        old_class=old_classification,
                        new_class=new_classification,
                        score=new_score,
                        radar_data=radar,
                    )

                # Update state
                self.state.radar_classification[display_tf] = new_classification
                self.state.radar_scores[display_tf] = new_score

            except Exception as e:
                logger.error(f"Error checking RADAR for {tf}: {e}")

    async def _check_sniper_setups(self, current_price: float, funding_rate: float):
        """Check for high confluence SNIPER setups."""
        try:
            ohlcv_by_tf = {tf: self.exchange.fetch_ohlcv(timeframe=tf, limit=300)
                          for tf in settings.timeframes}

            sniper = analyze_sniper(ohlcv_by_tf, current_price, funding_rate)
            confluence = sniper.get("confluence", {})
            setups = sniper.get("setups", [])

            new_signal = confluence.get("signal", "NEUTRAL")
            new_score = confluence.get("score", 0)

            # Alert on high confluence setups.
            #
            # analyze_sniper returns up to 5 setups (one per detected zone),
            # all sharing the global confluence score. Blasting every zone as
            # a separate message produced 3+ near-identical alerts per tick
            # (observed 2026-07-10), re-fired whenever a zone re-detected at a
            # slightly different price. Instead: keep only risk-sane setups
            # (R:R >= 1), send the single best one per tick, dedup on a $500
            # price band, and rate-limit to one SNIPER alert per direction per
            # hour (a direction flip alerts immediately).
            if new_score >= self.sniper_min_confluence and setups:
                viable = [s for s in setups if (s.get("risk_reward") or s.get("rr") or 0) >= 1.0]
                best = max(viable, key=lambda s: (s.get("risk_reward") or s.get("rr") or 0), default=None)

                if best:
                    band = round(best["entry_price"] / 500) * 500
                    setup_id = f"{best['direction']}_{best['entry_zone_type']}_{band:.0f}"

                    now = datetime.utcnow()
                    same_direction = self.state.last_sniper_direction == best["direction"]
                    in_cooldown = (
                        same_direction
                        and self.state.last_sniper_alert_time is not None
                        and (now - self.state.last_sniper_alert_time).total_seconds() < 3600
                    )

                    if setup_id not in self.state.alerted_setups and not in_cooldown:
                        await self._send_sniper_alert(best, confluence, current_price)
                        self.state.alerted_setups.add(setup_id)
                        self.state.last_sniper_alert_time = now
                        self.state.last_sniper_direction = best["direction"]

                        # Keep only last 20 alerted setups
                        if len(self.state.alerted_setups) > 20:
                            self.state.alerted_setups = set(list(self.state.alerted_setups)[-20:])

            # Alert on signal change (only for significant changes, with cooldown)
            old_signal = self.state.last_sniper_signal
            if old_signal and old_signal != new_signal:
                if new_signal in ["STRONG_LONG", "STRONG_SHORT"]:
                    # Only alert if:
                    # 1. We haven't alerted this signal before, OR
                    # 2. At least 30 minutes have passed since last alert
                    should_alert = False
                    if self.state.last_alerted_signal != new_signal:
                        should_alert = True
                    elif self.state.last_signal_alert_time:
                        time_since_alert = (datetime.utcnow() - self.state.last_signal_alert_time).total_seconds()
                        if time_since_alert > 1800:  # 30 minutes cooldown
                            should_alert = True

                    if should_alert:
                        await self._send_signal_change_alert(old_signal, new_signal, new_score)
                        self.state.last_alerted_signal = new_signal
                        self.state.last_signal_alert_time = datetime.utcnow()

            self.state.last_sniper_signal = new_signal
            self.state.last_sniper_score = new_score

        except Exception as e:
            logger.error(f"Error checking SNIPER setups: {e}")

    async def _send_radar_alert(
        self,
        timeframe: str,
        old_class: str,
        new_class: str,
        score: float,
        radar_data: dict,
    ):
        """Send RADAR classification change alert."""
        emoji_map = {
            "ACCUMULATE": "🟢",
            "NEUTRAL": "🟡",
            "SELL_THE_RALLY": "🔴",
        }

        old_emoji = emoji_map.get(old_class, "⚪")
        new_emoji = emoji_map.get(new_class, "⚪")

        # Determine if bullish or bearish change
        class_order = ["SELL_THE_RALLY", "NEUTRAL", "ACCUMULATE"]
        old_idx = class_order.index(old_class) if old_class in class_order else 1
        new_idx = class_order.index(new_class) if new_class in class_order else 1

        direction = "⬆️ BULLISH" if new_idx > old_idx else "⬇️ BEARISH"

        components = radar_data.get("components", [])
        components_str = "\n".join(f"  • {c}" for c in components[:4]) if components else "  • No details"

        message = f"""
📡 *RADAR ALERT - {timeframe}*

{direction} SHIFT DETECTED

{old_emoji} {old_class.replace("_", " ")}
    ↓
{new_emoji} *{new_class.replace("_", " ")}*

*Score:* {score:.1f}/6

*Components:*
{components_str}

_{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_
"""

        if self.telegram.is_available():
            await self.telegram.send_message(message.strip())
            logger.info(f"Sent RADAR alert: {timeframe} {old_class} -> {new_class}")

    async def _send_sniper_alert(self, setup: dict, confluence: dict, current_price: float):
        """Send SNIPER setup alert."""
        direction = setup.get("direction", "UNKNOWN")
        emoji = "🟢" if direction == "LONG" else "🔴"

        entry_zone = setup.get("entry_zone", {})
        take_profits = setup.get("take_profits", {})

        message = f"""
🎯 *SNIPER SETUP DETECTED*

{emoji} *{direction}* - Confluence {setup.get('confluence_score', 0)}/5

*Entry Zone:* {setup.get('entry_zone_type', 'N/A')}
${entry_zone.get('low', 0):,.0f} - ${entry_zone.get('high', 0):,.0f}

*Current Price:* ${current_price:,.0f}

*Stop Loss:* ${setup.get('stop_loss', 0):,.0f}
*Take Profits:*
  • TP1: ${take_profits.get('tp1', 0):,.0f}
  • TP2: ${take_profits.get('tp2', 0):,.0f}
  • TP3: ${take_profits.get('tp3', 0):,.0f}

*R:R:* {setup.get('risk_reward', 0):.1f}
*Position Size:* {setup.get('position_size_pct', 0)}%
*Timeframe:* {setup.get('timeframe', 'N/A')}

*Signal:* {confluence.get('signal', 'NEUTRAL')}
*Recommendation:* {confluence.get('recommendation', '')}

_{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_
"""

        if self.telegram.is_available():
            await self.telegram.send_message(message.strip())
            logger.info(f"Sent SNIPER alert: {direction} setup")

    async def _send_signal_change_alert(self, old_signal: str, new_signal: str, score: float):
        """Send signal change alert."""
        emoji = "🚀" if "LONG" in new_signal else "📉"

        message = f"""
{emoji} *SNIPER SIGNAL CHANGE*

{old_signal} → *{new_signal}*

Confluence Score: {score}/5

_{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_
"""

        if self.telegram.is_available():
            await self.telegram.send_message(message.strip())
            logger.info(f"Sent signal change alert: {old_signal} -> {new_signal}")

    async def _check_ict_signals(self, current_price: float):
        """Check for ICT trading signals."""
        try:
            from calculations.ict_signals import analyze_ict_setup
            from calculations.sessions import is_killzone

            # Only check during killzones for higher quality signals
            if not is_killzone():
                return

            # Fetch data
            ltf_data = self.exchange.fetch_ohlcv(timeframe="15m", limit=200)
            htf_data = self.exchange.fetch_ohlcv(timeframe="4h", limit=100)

            # Analyze ICT setup
            result = analyze_ict_setup(
                ltf_ohlcv=ltf_data,
                htf_ohlcv=htf_data,
                current_price=current_price,
                timeframe="15m",
            )

            signal = result.get("signal")
            amd = result.get("amd", {})

            # Check for AMD phase change
            new_phase = amd.get("phase", "NONE")
            if self.state.last_amd_phase and new_phase != self.state.last_amd_phase:
                if new_phase == "MANIPULATION":
                    # Alert on manipulation phase (potential trade coming)
                    await self._send_amd_phase_alert(amd, current_price)

            self.state.last_amd_phase = new_phase

            # Check for valid ICT signal
            if signal and signal.get("confidence", 0) >= self.ict_min_confidence:
                # Create unique signal ID
                signal_id = f"{signal['direction']}_{signal['entry_price']:.0f}"

                # Check cooldown (15 minutes for ICT signals)
                should_alert = False
                if self.state.last_ict_signal_id != signal_id:
                    should_alert = True
                elif self.state.last_ict_alert_time:
                    time_since = (datetime.utcnow() - self.state.last_ict_alert_time).total_seconds()
                    if time_since > 900:  # 15 minute cooldown
                        should_alert = True

                if should_alert:
                    await self._send_ict_signal_alert(signal, result.get("session", {}), current_price)
                    self.state.last_ict_signal_id = signal_id
                    self.state.last_ict_alert_time = datetime.utcnow()

        except Exception as e:
            logger.error(f"Error checking ICT signals: {e}")

    async def _send_ict_signal_alert(self, signal: dict, session: dict, current_price: float):
        """Send ICT trading signal alert."""
        direction = signal.get("direction", "UNKNOWN")
        emoji = "🟢" if direction == "LONG" else "🔴"
        confidence = signal.get("confidence", 0)

        entry_zone = signal.get("entry_zone", {})
        take_profits = signal.get("take_profits", {})
        components = signal.get("components", {})
        risk_reward = signal.get("risk_reward", {})

        session_name = session.get("session", "UNKNOWN")
        in_killzone = session.get("in_killzone", False)
        kz_emoji = "🎯" if in_killzone else ""

        message = f"""
🔮 *ICT SIGNAL* {kz_emoji}

{emoji} *{direction}* - Confidence {confidence:.0%}

*Entry Type:* {signal.get('entry_type', 'N/A')}
*Entry Zone:* ${entry_zone.get('low', 0):,.0f} - ${entry_zone.get('high', 0):,.0f}

*Current Price:* ${current_price:,.0f}

*Stop Loss:* ${signal.get('stop_loss', 0):,.0f}
*Take Profits:*
  • TP1: ${take_profits.get('tp1', 0):,.0f} (1:1)
  • TP2: ${take_profits.get('tp2', 0):,.0f} (2:1)

*R:R:* {risk_reward.get('rr_ratio', 0):.1f}

*Pattern:*
  • HTF Bias: {components.get('htf_bias', 'N/A')}
  • AMD Phase: {components.get('amd_phase', 'N/A')}
  • MSS: {'✓' if components.get('mss_confirmed') else '✗'}
  • FVG: {'✓' if components.get('fvg_formed') else '✗'}

*Session:* {session_name}

_{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_
"""

        if self.telegram.is_available():
            await self.telegram.send_message(message.strip())
            logger.info(f"Sent ICT signal alert: {direction}")

    async def _send_amd_phase_alert(self, amd: dict, current_price: float):
        """Send AMD phase change alert (manipulation = potential setup coming)."""
        direction = amd.get("direction", "UNKNOWN")
        details = amd.get("details", {})
        manipulation = details.get("manipulation", {})

        emoji = "⚡"
        if direction == "BULLISH":
            emoji = "🐂"
        elif direction == "BEARISH":
            emoji = "🐻"

        message = f"""
{emoji} *MANIPULATION DETECTED*

Price swept liquidity - watch for reversal!

*Direction:* {direction}
*Swept Level:* ${manipulation.get('swept_level', 0):,.0f}
*Sweep Extreme:* ${manipulation.get('sweep_extreme', 0):,.0f}

*Current Price:* ${current_price:,.0f}

Wait for:
  1. Displacement candle
  2. Market Structure Shift
  3. FVG/OB entry zone

_{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_
"""

        if self.telegram.is_available():
            await self.telegram.send_message(message.strip())
            logger.info(f"Sent AMD manipulation alert: {direction}")

    async def force_check(self):
        """Force an immediate check (for testing)."""
        logger.info("Forcing alert check...")
        await self._check_and_alert()


# Singleton instance
_alert_monitor: Optional[AlertMonitor] = None


def get_alert_monitor() -> AlertMonitor:
    """Get or create AlertMonitor instance."""
    global _alert_monitor
    if _alert_monitor is None:
        _alert_monitor = AlertMonitor()
    return _alert_monitor
