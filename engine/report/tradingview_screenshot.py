"""
TradingView Chart Screenshot Service.

Uses Playwright to capture TradingView charts with technical indicators
for embedding in PDF reports.
"""
import asyncio
import base64
from typing import Dict, Any, Optional, List
from urllib.parse import urlencode
from loguru import logger


class TradingViewScreenshotService:
    """
    Capture TradingView charts as images for PDF embedding.

    Uses TradingView's widget embed URL with Playwright headless browser.
    """

    # TradingView widget base URL
    WIDGET_BASE_URL = "https://s.tradingview.com/widgetembed/"

    # Exchange mapping for common tokens
    EXCHANGE_MAP = {
        "BTC": "BINANCE",
        "ETH": "BINANCE",
        "SOL": "BINANCE",
        "AAVE": "BINANCE",
        "UNI": "BINANCE",
        "LINK": "BINANCE",
        "AVAX": "BINANCE",
        "MATIC": "BINANCE",
        "ARB": "BINANCE",
        "OP": "BINANCE",
        "DOT": "BINANCE",
        "ATOM": "BINANCE",
        "NEAR": "BINANCE",
        "SUI": "BINANCE",
        "APT": "BINANCE",
        "INJ": "BINANCE",
        "SEI": "BINANCE",
        "FTM": "BINANCE",
        "MKR": "COINBASE",
        "CRV": "BINANCE",
        "LDO": "BINANCE",
        "COMP": "COINBASE",
        "SNX": "BINANCE",
        "DYDX": "BINANCE",
        "GMX": "BINANCE",
        "PENDLE": "BINANCE",
        "JUP": "BYBIT",
    }

    def __init__(self):
        self._browser = None
        self._playwright = None

    async def _ensure_browser(self):
        """Ensure Playwright browser is initialized."""
        if self._browser is None:
            from playwright.async_api import async_playwright
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(headless=True)

    async def close(self):
        """Close browser resources."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    def _get_symbol(self, ticker: str) -> str:
        """
        Get TradingView symbol format for a ticker.

        Args:
            ticker: Token symbol (e.g., "AAVE")

        Returns:
            TradingView format symbol (e.g., "BINANCE:AAVEUSDT")
        """
        exchange = self.EXCHANGE_MAP.get(ticker.upper(), "BINANCE")
        return f"{exchange}:{ticker.upper()}USDT"

    def _build_widget_url(
        self,
        symbol: str,
        interval: str = "D",
        range_param: str = "3M",
        theme: str = "dark",
        studies: Optional[List[str]] = None,
    ) -> str:
        """
        Build TradingView widget embed URL.

        Args:
            symbol: TradingView symbol (e.g., "BINANCE:BTCUSDT")
            interval: Chart interval (D, W, M)
            range_param: Time range (1M, 3M, 6M, 12M, ALL)
            theme: Chart theme (dark, light)
            studies: List of studies to add

        Returns:
            Complete widget URL
        """
        if studies is None:
            studies = ["MASimple@tv-basicstudies", "RSI@tv-basicstudies"]

        params = {
            "symbol": symbol,
            "interval": interval,
            "hidesidetoolbar": "0",
            "hidetoptoolbar": "0",
            "symboledit": "0",
            "saveimage": "0",
            "toolbarbg": "f1f3f6" if theme == "light" else "1e222d",
            "studies": str(studies),
            "theme": theme,
            "style": "1",  # Candlestick
            "locale": "en",
            "timezone": "Etc/UTC",
            "range": range_param,
            "withdateranges": "1",
            "hide_side_toolbar": "0",
            "allow_symbol_change": "0",
            "details": "1",
            "hotlist": "0",
            "calendar": "0",
        }

        return f"{self.WIDGET_BASE_URL}?{urlencode(params)}"

    async def capture_chart(
        self,
        ticker: str,
        interval: str = "D",
        timeframe_days: int = 90,
        width: int = 1200,
        height: int = 600,
        theme: str = "dark",
    ) -> Optional[bytes]:
        """
        Capture a TradingView chart screenshot.

        Args:
            ticker: Token symbol (e.g., "AAVE", "BTC")
            interval: Chart interval ("D" for daily, "W" for weekly)
            timeframe_days: Number of days to display (30, 90, 180, 365)
            width: Image width in pixels
            height: Image height in pixels
            theme: Chart theme ("dark" or "light")

        Returns:
            PNG image bytes or None on failure
        """
        # Map timeframe to range parameter
        range_map = {
            30: "1M",
            60: "3M",
            90: "3M",
            180: "6M",
            365: "12M",
        }
        range_param = range_map.get(timeframe_days, "3M")

        symbol = self._get_symbol(ticker)
        url = self._build_widget_url(
            symbol=symbol,
            interval=interval,
            range_param=range_param,
            theme=theme,
        )

        try:
            await self._ensure_browser()

            page = await self._browser.new_page(
                viewport={"width": width, "height": height}
            )

            try:
                # Navigate to widget
                await page.goto(url, wait_until="networkidle", timeout=30000)

                # Wait for chart to fully render
                await page.wait_for_timeout(4000)

                # Take screenshot
                screenshot = await page.screenshot(type="png", full_page=False)

                logger.info(f"TradingView chart captured for {ticker}")
                return screenshot

            finally:
                await page.close()

        except Exception as e:
            logger.error(f"TradingView screenshot failed for {ticker}: {e}")
            return None

    async def capture_chart_base64(
        self,
        ticker: str,
        interval: str = "D",
        timeframe_days: int = 90,
        width: int = 1200,
        height: int = 600,
        theme: str = "dark",
    ) -> Optional[str]:
        """
        Capture chart and return as base64-encoded string.

        Convenient for embedding directly in HTML templates.

        Returns:
            Base64-encoded PNG string or None
        """
        screenshot = await self.capture_chart(
            ticker=ticker,
            interval=interval,
            timeframe_days=timeframe_days,
            width=width,
            height=height,
            theme=theme,
        )

        if screenshot:
            return base64.b64encode(screenshot).decode("utf-8")
        return None

    def calculate_trading_levels(
        self,
        current_price: float,
        atr_percent: float = 3.0,
        risk_reward_target: float = 3.0,
    ) -> Dict[str, Any]:
        """
        Calculate trading levels based on current price.

        Uses ATR-based methodology for stop loss and take profit levels.
        In a production system, you would fetch actual ATR data.

        Args:
            current_price: Current token price
            atr_percent: Estimated ATR as percentage of price (default 3%)
            risk_reward_target: Target risk:reward ratio

        Returns:
            Dict with entry zones, stop loss, take profits, and R:R ratio
        """
        if current_price <= 0:
            return {
                "entry_zone_low": 0,
                "entry_zone_high": 0,
                "stop_loss": 0,
                "take_profit_1": 0,
                "take_profit_2": 0,
                "take_profit_3": 0,
                "risk_reward_ratio": "N/A",
                "support_levels": [],
                "resistance_levels": [],
            }

        # Calculate ATR value
        atr = current_price * (atr_percent / 100)

        # Entry zone: current price +/- 0.5 ATR
        entry_zone_low = round(current_price - (atr * 0.5), 4)
        entry_zone_high = round(current_price + (atr * 0.5), 4)

        # Stop loss: 2 ATR below entry
        stop_loss = round(current_price - (atr * 2), 4)

        # Calculate risk (distance to stop loss)
        risk = current_price - stop_loss

        # Take profits based on risk:reward ratios
        take_profit_1 = round(current_price + (risk * 1.5), 4)  # 1.5R
        take_profit_2 = round(current_price + (risk * 2.5), 4)  # 2.5R
        take_profit_3 = round(current_price + (risk * risk_reward_target), 4)  # 3R

        # Support and resistance levels (simplified)
        support_levels = [
            round(current_price - (atr * 3), 4),
            round(current_price - (atr * 5), 4),
        ]

        resistance_levels = [
            round(current_price + (atr * 3), 4),
            round(current_price + (atr * 5), 4),
        ]

        # Calculate actual R:R for TP3
        actual_rr = (take_profit_3 - current_price) / risk if risk > 0 else 0

        return {
            "entry_zone_low": entry_zone_low,
            "entry_zone_high": entry_zone_high,
            "stop_loss": stop_loss,
            "take_profit_1": take_profit_1,
            "take_profit_2": take_profit_2,
            "take_profit_3": take_profit_3,
            "risk_reward_ratio": f"1:{actual_rr:.1f}",
            "support_levels": support_levels,
            "resistance_levels": resistance_levels,
            "risk_amount": round(risk, 4),
            "reward_amount": round(take_profit_3 - current_price, 4),
        }

    def calculate_advanced_levels(
        self,
        current_price: float,
        high_24h: float,
        low_24h: float,
        ath: float,
        price_change_30d: float,
    ) -> Dict[str, Any]:
        """
        Calculate more sophisticated trading levels using multiple data points.

        Args:
            current_price: Current price
            high_24h: 24-hour high
            low_24h: 24-hour low
            ath: All-time high
            price_change_30d: 30-day price change percentage

        Returns:
            Dict with calculated levels
        """
        if current_price <= 0:
            return self.calculate_trading_levels(0)

        # Calculate volatility from 24h range
        range_24h = high_24h - low_24h
        volatility_pct = (range_24h / current_price) * 100 if current_price > 0 else 3.0

        # Adjust ATR estimate based on recent volatility
        atr_percent = max(2.0, min(volatility_pct * 1.5, 10.0))

        # Get base levels
        levels = self.calculate_trading_levels(current_price, atr_percent)

        # Add ATH-based resistance
        if ath and ath > current_price:
            # ATH is a major resistance
            levels["resistance_levels"].insert(0, round(ath, 4))

            # Also add intermediate levels to ATH
            ath_distance = ath - current_price
            levels["resistance_levels"].insert(1, round(current_price + (ath_distance * 0.5), 4))

        # Adjust based on momentum
        if price_change_30d:
            if price_change_30d > 20:
                # Strong uptrend - tighten stops
                levels["stop_loss"] = round(
                    current_price - (current_price - levels["stop_loss"]) * 0.8,
                    4
                )
            elif price_change_30d < -20:
                # Strong downtrend - wider stops
                levels["stop_loss"] = round(
                    current_price - (current_price - levels["stop_loss"]) * 1.3,
                    4
                )

        # Recalculate R:R after adjustments
        risk = current_price - levels["stop_loss"]
        if risk > 0:
            levels["risk_reward_ratio"] = f"1:{(levels['take_profit_3'] - current_price) / risk:.1f}"

        return levels


# Singleton
_service: Optional[TradingViewScreenshotService] = None


def get_tradingview_service() -> TradingViewScreenshotService:
    """Get or create TradingView screenshot service singleton."""
    global _service
    if _service is None:
        _service = TradingViewScreenshotService()
    return _service
