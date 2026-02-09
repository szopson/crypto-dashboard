"""
Telegram Bot Service.

Provides:
- Send notifications to Telegram
- Handle bot commands
- Daily briefing delivery
"""
import asyncio
from datetime import datetime
from typing import Optional
from loguru import logger

from config import settings

try:
    from telegram import Bot, Update
    from telegram.ext import Application, CommandHandler, ContextTypes
    TELEGRAM_AVAILABLE = True
except ImportError:
    TELEGRAM_AVAILABLE = False
    logger.warning("python-telegram-bot not installed")


class TelegramService:
    """Service for Telegram bot interactions."""

    def __init__(
        self,
        bot_token: Optional[str] = None,
        chat_id: Optional[str] = None,
    ):
        self.bot_token = bot_token or settings.telegram_bot_token
        self.chat_id = chat_id or settings.telegram_chat_id
        self.bot: Optional[Bot] = None
        self.app: Optional[Application] = None

        if TELEGRAM_AVAILABLE and self.bot_token:
            self.bot = Bot(token=self.bot_token)
            logger.info("Telegram bot initialized")
        else:
            logger.warning("Telegram bot not configured. Set TELEGRAM_BOT_TOKEN.")

    def is_available(self) -> bool:
        """Check if Telegram service is available."""
        return self.bot is not None

    async def send_message(
        self,
        text: str,
        chat_id: Optional[str] = None,
        parse_mode: str = "Markdown",
    ) -> dict:
        """
        Send a message to Telegram.

        Args:
            text: Message text
            chat_id: Target chat ID (uses default if not provided)
            parse_mode: Message parse mode (Markdown or HTML)

        Returns:
            Dictionary with result
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "Telegram bot not configured",
            }

        target_chat = chat_id or self.chat_id
        if not target_chat:
            return {
                "success": False,
                "error": "No chat_id specified",
            }

        try:
            message = await self.bot.send_message(
                chat_id=target_chat,
                text=text,
                parse_mode=parse_mode,
            )

            return {
                "success": True,
                "message_id": message.message_id,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Telegram send error: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def send_alert(
        self,
        alert_type: str,
        symbol: str,
        message: str,
        price: Optional[float] = None,
        chat_id: Optional[str] = None,
    ) -> dict:
        """
        Send a formatted trading alert.

        Args:
            alert_type: Type of alert (SIGNAL, PRICE, STRUCTURE, etc.)
            symbol: Trading symbol
            message: Alert message
            price: Current price
            chat_id: Target chat ID

        Returns:
            Dictionary with result
        """
        emoji_map = {
            "SIGNAL": "🎯",
            "PRICE": "💰",
            "STRUCTURE": "📊",
            "RADAR": "📡",
            "WARNING": "⚠️",
            "INFO": "ℹ️",
        }

        emoji = emoji_map.get(alert_type.upper(), "📢")
        price_str = f"\n💵 Price: ${price:,.2f}" if price else ""

        text = f"""
{emoji} *{alert_type.upper()} ALERT*

*{symbol}*{price_str}

{message}

_Trading Command Center_
_{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_
"""

        return await self.send_message(text.strip(), chat_id)

    async def send_daily_briefing(
        self,
        briefing: str,
        chat_id: Optional[str] = None,
    ) -> dict:
        """
        Send daily briefing.

        Args:
            briefing: Briefing content
            chat_id: Target chat ID

        Returns:
            Dictionary with result
        """
        # Telegram has a 4096 character limit, split if needed
        max_length = 4000

        if len(briefing) <= max_length:
            return await self.send_message(briefing, chat_id)

        # Split into chunks
        chunks = []
        current = ""
        for line in briefing.split("\n"):
            if len(current) + len(line) + 1 <= max_length:
                current += line + "\n"
            else:
                chunks.append(current)
                current = line + "\n"
        if current:
            chunks.append(current)

        results = []
        for i, chunk in enumerate(chunks):
            result = await self.send_message(chunk, chat_id)
            results.append(result)
            if not result.get("success"):
                return result
            await asyncio.sleep(0.5)  # Rate limiting

        return {
            "success": True,
            "messages_sent": len(results),
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def send_sniper_setup(
        self,
        setup: dict,
        chat_id: Optional[str] = None,
    ) -> dict:
        """
        Send a SNIPER trade setup alert.

        Args:
            setup: Trade setup dictionary
            chat_id: Target chat ID

        Returns:
            Dictionary with result
        """
        direction = setup.get("direction", "UNKNOWN")
        emoji = "🟢" if direction == "LONG" else "🔴"

        entry_zone = setup.get("entry_zone", {})
        take_profits = setup.get("take_profits", {})

        text = f"""
{emoji} *SNIPER SETUP - {direction}*

*Zone:* {setup.get('entry_zone_type', 'N/A')}
*Entry:* ${entry_zone.get('low', 0):,.0f} - ${entry_zone.get('high', 0):,.0f}

*Stop Loss:* ${setup.get('stop_loss', 0):,.0f}

*Take Profits:*
• TP1: ${take_profits.get('tp1', 0):,.0f}
• TP2: ${take_profits.get('tp2', 0):,.0f}
• TP3: ${take_profits.get('tp3', 0):,.0f}

*Confluence:* {setup.get('confluence_score', 0)}/5
*Position Size:* {setup.get('position_size_pct', 0)}%
*R:R:* {setup.get('risk_reward', 0):.1f}

_TF: {setup.get('timeframe', 'N/A')}_
"""

        return await self.send_message(text.strip(), chat_id)


# Singleton instance
_telegram_service: Optional[TelegramService] = None


def get_telegram_service() -> TelegramService:
    """Get or create Telegram service instance."""
    global _telegram_service
    if _telegram_service is None:
        _telegram_service = TelegramService()
    return _telegram_service
