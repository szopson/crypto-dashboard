"""
CCXT Exchange Client for fetching market data.
Supports Bybit, OKX, Kraken, KuCoin and other exchanges.
"""
import ccxt
from datetime import datetime, timezone
from typing import Optional
from loguru import logger

from config import settings, TIMEFRAME_MAP


class ExchangeClient:
    """
    Unified exchange client using CCXT library.
    Default exchange: Bybit (perpetual futures).
    """

    def __init__(self, exchange_id: str = None, symbol: str = None):
        """
        Initialize exchange client.

        Args:
            exchange_id: Exchange identifier (bybit, okx, kraken, etc.)
            symbol: Trading pair symbol (e.g., 'BTC/USDT:USDT' for Bybit perpetual)
        """
        self.exchange_id = exchange_id or settings.exchange_id
        self.symbol = symbol or settings.default_symbol

        # Initialize CCXT exchange
        exchange_class = getattr(ccxt, self.exchange_id)
        self.exchange = exchange_class({
            'enableRateLimit': True,
        })

        logger.info(f"Initialized {self.exchange_id} exchange client for {self.symbol}")

    def fetch_ohlcv(
        self,
        symbol: str = None,
        timeframe: str = "1d",
        limit: int = None,
        since: int = None
    ) -> list[dict]:
        """
        Fetch OHLCV candlestick data.

        Args:
            symbol: Trading pair symbol
            timeframe: Candle timeframe (1h, 4h, 1d, 1w, 1M)
            limit: Number of candles to fetch
            since: Start timestamp in milliseconds

        Returns:
            List of OHLCV dictionaries with keys:
            - timestamp: Unix timestamp in milliseconds
            - datetime: ISO datetime string
            - open, high, low, close: Price values
            - volume: Trading volume
        """
        symbol = symbol or self.symbol
        limit = limit or settings.ohlcv_limit

        try:
            raw_ohlcv = self.exchange.fetch_ohlcv(
                symbol=symbol,
                timeframe=timeframe,
                limit=limit,
                since=since
            )

            # Convert to list of dicts
            ohlcv_data = []
            for candle in raw_ohlcv:
                ohlcv_data.append({
                    'timestamp': candle[0],
                    'datetime': datetime.fromtimestamp(candle[0] / 1000, tz=timezone.utc).isoformat(),
                    'open': candle[1],
                    'high': candle[2],
                    'low': candle[3],
                    'close': candle[4],
                    'volume': candle[5],
                })

            logger.debug(f"Fetched {len(ohlcv_data)} candles for {symbol} {timeframe}")
            return ohlcv_data

        except Exception as e:
            logger.error(f"Error fetching OHLCV for {symbol} {timeframe}: {e}")
            raise

    def fetch_funding_rate(self, symbol: str = None) -> dict:
        """
        Fetch current funding rate for perpetual futures.

        Args:
            symbol: Trading pair symbol

        Returns:
            Dictionary with funding rate data:
            - symbol: Trading pair
            - funding_rate: Current funding rate (as percentage, e.g., 0.01 = 0.01%)
            - funding_timestamp: Timestamp of current funding
            - next_funding_timestamp: Timestamp of next funding
        """
        symbol = symbol or self.symbol

        try:
            funding = self.exchange.fetch_funding_rate(symbol)

            result = {
                'symbol': funding.get('symbol', symbol),
                'funding_rate': funding.get('fundingRate', 0) * 100,  # Convert to percentage
                'funding_timestamp': funding.get('fundingTimestamp'),
                'next_funding_timestamp': funding.get('nextFundingTimestamp'),
                'mark_price': funding.get('markPrice'),
            }

            logger.debug(f"Fetched funding rate for {symbol}: {result['funding_rate']:.4f}%")
            return result

        except Exception as e:
            logger.error(f"Error fetching funding rate for {symbol}: {e}")
            raise

    def get_current_price(self, symbol: str = None) -> dict:
        """
        Get current ticker price.

        Args:
            symbol: Trading pair symbol

        Returns:
            Dictionary with price data:
            - symbol: Trading pair
            - price: Last traded price
            - bid: Best bid price
            - ask: Best ask price
            - change_24h: 24h price change percentage
            - volume_24h: 24h trading volume
        """
        symbol = symbol or self.symbol

        try:
            ticker = self.exchange.fetch_ticker(symbol)

            result = {
                'symbol': ticker.get('symbol', symbol),
                'price': ticker.get('last'),
                'bid': ticker.get('bid'),
                'ask': ticker.get('ask'),
                'change_24h': ticker.get('percentage'),
                'volume_24h': ticker.get('quoteVolume'),
                'high_24h': ticker.get('high'),
                'low_24h': ticker.get('low'),
                'timestamp': ticker.get('timestamp'),
            }

            logger.debug(f"Current price for {symbol}: ${result['price']:,.2f}")
            return result

        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {e}")
            raise

    def fetch_ohlcv_for_all_timeframes(
        self,
        symbol: str = None,
        timeframes: list[str] = None,
        limit: int = None
    ) -> dict[str, list[dict]]:
        """
        Fetch OHLCV data for multiple timeframes.

        Args:
            symbol: Trading pair symbol
            timeframes: List of timeframes to fetch
            limit: Number of candles per timeframe

        Returns:
            Dictionary mapping timeframe to OHLCV data
        """
        symbol = symbol or self.symbol
        timeframes = timeframes or settings.timeframes
        limit = limit or settings.ohlcv_limit

        result = {}
        for tf in timeframes:
            try:
                result[tf] = self.fetch_ohlcv(symbol, tf, limit)
            except Exception as e:
                logger.warning(f"Failed to fetch {tf} data: {e}")
                result[tf] = []

        return result

    def get_display_timeframe(self, ccxt_timeframe: str) -> str:
        """Convert CCXT timeframe format to display format."""
        return TIMEFRAME_MAP.get(ccxt_timeframe, ccxt_timeframe.upper())

    def fetch_open_interest(self, symbol: str = None) -> dict:
        """
        Fetch open interest for perpetual futures.

        Args:
            symbol: Trading pair symbol

        Returns:
            Dictionary with open interest data
        """
        symbol = symbol or self.symbol

        try:
            # Bybit uses fetchOpenInterest
            if hasattr(self.exchange, 'fetch_open_interest'):
                oi = self.exchange.fetch_open_interest(symbol)
                return {
                    'symbol': symbol,
                    'open_interest': oi.get('openInterestValue') or oi.get('openInterestAmount', 0),
                    'open_interest_value': oi.get('openInterestValue', 0),
                    'timestamp': oi.get('timestamp'),
                }
            else:
                logger.warning(f"Open interest not supported for {self.exchange_id}")
                return {'symbol': symbol, 'open_interest': None, 'open_interest_value': None}

        except Exception as e:
            logger.error(f"Error fetching open interest for {symbol}: {e}")
            return {'symbol': symbol, 'open_interest': None, 'open_interest_value': None, 'error': str(e)}

    def fetch_long_short_ratio(self, symbol: str = None) -> dict:
        """
        Fetch long/short ratio for perpetual futures.

        Args:
            symbol: Trading pair symbol

        Returns:
            Dictionary with long/short ratio data
        """
        import requests

        symbol = symbol or self.symbol

        try:
            # Convert symbol format: "BTC/USDT:USDT" -> "BTCUSDT"
            base = symbol.split('/')[0]
            bybit_symbol = f"{base}USDT"

            # Try Bybit public API for account ratio
            url = f"https://api.bybit.com/v5/market/account-ratio"
            params = {
                'category': 'linear',
                'symbol': bybit_symbol,
                'period': '1h',  # 1 hour period for more recent data
                'limit': 1
            }

            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            if data.get('retCode') == 0 and data.get('result', {}).get('list'):
                latest = data['result']['list'][0]
                # buyRatio and sellRatio are strings like "0.5234"
                buy_ratio = float(latest.get('buyRatio', 0.5))
                sell_ratio = float(latest.get('sellRatio', 0.5))

                return {
                    'symbol': symbol,
                    'long_ratio': round(buy_ratio * 100, 2),
                    'short_ratio': round(sell_ratio * 100, 2),
                    'long_short_ratio': round(buy_ratio / sell_ratio, 2) if sell_ratio > 0 else 1.0,
                    'timestamp': latest.get('timestamp'),
                    'estimated': False,
                }

            # Fallback: Try CCXT method
            if hasattr(self.exchange, 'fetch_long_short_ratio_history'):
                ratios = self.exchange.fetch_long_short_ratio_history(symbol, limit=1)
                if ratios and len(ratios) > 0:
                    latest = ratios[-1]
                    return {
                        'symbol': symbol,
                        'long_ratio': latest.get('longAccount', 0.5) * 100,
                        'short_ratio': latest.get('shortAccount', 0.5) * 100,
                        'long_short_ratio': latest.get('longShortRatio', 1.0),
                        'timestamp': latest.get('timestamp'),
                        'estimated': False,
                    }

            # Last fallback: estimate from funding rate
            funding = self.fetch_funding_rate(symbol)
            funding_rate = funding.get('funding_rate', 0)

            # Positive funding = more longs, negative = more shorts
            # Scale factor: 0.01% funding ≈ 55/45 ratio
            if funding_rate > 0:
                adjustment = min(funding_rate * 500, 15)  # More aggressive scaling
                long_ratio = 50 + adjustment
                short_ratio = 50 - adjustment
            elif funding_rate < 0:
                adjustment = min(abs(funding_rate) * 500, 15)
                long_ratio = 50 - adjustment
                short_ratio = 50 + adjustment
            else:
                long_ratio = 50
                short_ratio = 50

            return {
                'symbol': symbol,
                'long_ratio': round(long_ratio, 2),
                'short_ratio': round(short_ratio, 2),
                'long_short_ratio': round(long_ratio / short_ratio, 2) if short_ratio > 0 else 1.0,
                'estimated': True,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.error(f"Error fetching long/short ratio for {symbol}: {e}")
            return {
                'symbol': symbol,
                'long_ratio': 50,
                'short_ratio': 50,
                'long_short_ratio': 1.0,
                'estimated': True,
                'error': str(e)
            }


# Singleton instance
_exchange_client: Optional[ExchangeClient] = None


def get_exchange_client() -> ExchangeClient:
    """Get or create exchange client singleton."""
    global _exchange_client
    if _exchange_client is None:
        _exchange_client = ExchangeClient()
    return _exchange_client
