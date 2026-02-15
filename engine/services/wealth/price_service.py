"""
Price Service for Wealth Dashboard.

Fetches prices from multiple providers and caches them in Supabase.
"""
import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Optional
import aiohttp
from loguru import logger

from config import settings


class PriceProvider(ABC):
    """Base class for price providers."""

    @abstractmethod
    async def get_price(self, ticker: str) -> Optional[dict]:
        """
        Fetch price for a ticker.

        Returns:
            dict with keys: price_usd, change_24h_pct, market_cap, volume_24h, source
            or None if not found
        """
        pass

    @abstractmethod
    def supports(self, asset_class: str) -> bool:
        """Check if this provider supports the given asset class."""
        pass


class CoinGeckoPriceProvider(PriceProvider):
    """
    CoinGecko price provider for cryptocurrency.

    Free tier: 10-30 requests per minute
    No API key required for basic usage.
    """

    BASE_URL = "https://api.coingecko.com/api/v3"

    # Mapping of common tickers to CoinGecko IDs
    TICKER_TO_ID = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "USDT": "tether",
        "BNB": "binancecoin",
        "SOL": "solana",
        "XRP": "ripple",
        "USDC": "usd-coin",
        "ADA": "cardano",
        "DOGE": "dogecoin",
        "TRX": "tron",
        "AVAX": "avalanche-2",
        "LINK": "chainlink",
        "DOT": "polkadot",
        "MATIC": "matic-network",
        "TON": "the-open-network",
        "SHIB": "shiba-inu",
        "LTC": "litecoin",
        "BCH": "bitcoin-cash",
        "XLM": "stellar",
        "UNI": "uniswap",
        "ATOM": "cosmos",
        "NEAR": "near",
        "APT": "aptos",
        "ARB": "arbitrum",
        "OP": "optimism",
        "FIL": "filecoin",
        "HBAR": "hedera-hashgraph",
        "VET": "vechain",
        "ICP": "internet-computer",
        "IMX": "immutable-x",
    }

    def supports(self, asset_class: str) -> bool:
        return asset_class == "crypto"

    def _get_coin_id(self, ticker: str) -> str:
        """Convert ticker to CoinGecko coin ID."""
        return self.TICKER_TO_ID.get(ticker.upper(), ticker.lower())

    async def get_price(self, ticker: str) -> Optional[dict]:
        """Fetch crypto price from CoinGecko."""
        coin_id = self._get_coin_id(ticker)

        url = f"{self.BASE_URL}/simple/price"
        params = {
            "ids": coin_id,
            "vs_currencies": "usd",
            "include_24hr_change": "true",
            "include_market_cap": "true",
            "include_24hr_vol": "true",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10) as response:
                    if response.status != 200:
                        logger.warning(f"CoinGecko API error: {response.status}")
                        return None

                    data = await response.json()

                    if coin_id not in data:
                        logger.warning(f"Coin not found: {ticker} (ID: {coin_id})")
                        return None

                    coin_data = data[coin_id]
                    return {
                        "price_usd": coin_data.get("usd", 0),
                        "change_24h_pct": coin_data.get("usd_24h_change"),
                        "market_cap": coin_data.get("usd_market_cap"),
                        "volume_24h": coin_data.get("usd_24h_vol"),
                        "source": "coingecko",
                    }
        except asyncio.TimeoutError:
            logger.warning(f"CoinGecko timeout for {ticker}")
            return None
        except Exception as e:
            logger.error(f"CoinGecko error for {ticker}: {e}")
            return None

    async def search_coin(self, query: str) -> list[dict]:
        """Search for coins by name or ticker."""
        url = f"{self.BASE_URL}/search"
        params = {"query": query}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10) as response:
                    if response.status != 200:
                        return []

                    data = await response.json()
                    coins = data.get("coins", [])

                    return [
                        {
                            "ticker": coin.get("symbol", "").upper(),
                            "name": coin.get("name", ""),
                            "coingecko_id": coin.get("id", ""),
                            "market_cap_rank": coin.get("market_cap_rank"),
                            "logo_url": coin.get("thumb"),
                        }
                        for coin in coins[:20]
                    ]
        except Exception as e:
            logger.error(f"CoinGecko search error: {e}")
            return []


class YFinancePriceProvider(PriceProvider):
    """
    Yahoo Finance price provider for stocks and ETFs.

    Uses yfinance library. Free, ~2000 requests/day.
    """

    def supports(self, asset_class: str) -> bool:
        return asset_class in ("stock", "etf")

    async def get_price(self, ticker: str) -> Optional[dict]:
        """Fetch stock/ETF price from Yahoo Finance."""
        try:
            import yfinance as yf

            # Run yfinance in thread pool (it's not async)
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None,
                self._fetch_yfinance_data,
                ticker.upper(),
            )
            return data
        except ImportError:
            logger.error("yfinance not installed. Run: pip install yfinance")
            return None
        except Exception as e:
            logger.error(f"yfinance error for {ticker}: {e}")
            return None

    def _fetch_yfinance_data(self, ticker: str) -> Optional[dict]:
        """Synchronous yfinance fetch (runs in executor)."""
        import yfinance as yf

        try:
            stock = yf.Ticker(ticker)
            info = stock.info

            if not info or "regularMarketPrice" not in info:
                # Try getting from history
                hist = stock.history(period="2d")
                if hist.empty:
                    return None

                current_price = hist["Close"].iloc[-1]
                prev_price = hist["Close"].iloc[0] if len(hist) > 1 else current_price
                change_pct = ((current_price - prev_price) / prev_price * 100) if prev_price else 0

                return {
                    "price_usd": float(current_price),
                    "change_24h_pct": float(change_pct),
                    "market_cap": None,
                    "volume_24h": float(hist["Volume"].iloc[-1]) if "Volume" in hist else None,
                    "source": "yfinance",
                }

            return {
                "price_usd": info.get("regularMarketPrice") or info.get("currentPrice", 0),
                "change_24h_pct": info.get("regularMarketChangePercent"),
                "market_cap": info.get("marketCap"),
                "volume_24h": info.get("regularMarketVolume"),
                "source": "yfinance",
            }
        except Exception as e:
            logger.warning(f"yfinance fetch error for {ticker}: {e}")
            return None


class GoldAPIPriceProvider(PriceProvider):
    """
    GoldAPI.io price provider for precious metals.

    Free tier: 100 requests/month
    API key required.
    """

    BASE_URL = "https://www.goldapi.io/api"

    # Supported metals
    SUPPORTED_TICKERS = {
        "XAU": "XAU",  # Gold
        "GOLD": "XAU",
        "XAG": "XAG",  # Silver
        "SILVER": "XAG",
        "XPT": "XPT",  # Platinum
        "PLATINUM": "XPT",
        "XPD": "XPD",  # Palladium
        "PALLADIUM": "XPD",
    }

    def supports(self, asset_class: str) -> bool:
        return asset_class == "commodity"

    async def get_price(self, ticker: str) -> Optional[dict]:
        """Fetch precious metal price from GoldAPI."""
        api_key = settings.goldapi_key
        if not api_key:
            logger.warning("GoldAPI key not configured")
            return None

        # Map ticker to GoldAPI symbol
        symbol = self.SUPPORTED_TICKERS.get(ticker.upper())
        if not symbol:
            logger.warning(f"Unsupported commodity ticker: {ticker}")
            return None

        url = f"{self.BASE_URL}/{symbol}/USD"
        headers = {
            "x-access-token": api_key,
            "Content-Type": "application/json",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=10) as response:
                    if response.status == 401:
                        logger.error("GoldAPI authentication failed")
                        return None
                    if response.status != 200:
                        logger.warning(f"GoldAPI error: {response.status}")
                        return None

                    data = await response.json()

                    price = data.get("price")
                    if not price:
                        return None

                    # Calculate 24h change if previous close available
                    prev_close = data.get("prev_close_price")
                    change_pct = None
                    if prev_close and prev_close > 0:
                        change_pct = ((price - prev_close) / prev_close) * 100

                    return {
                        "price_usd": price,
                        "change_24h_pct": change_pct,
                        "market_cap": None,
                        "volume_24h": None,
                        "source": "goldapi",
                    }
        except asyncio.TimeoutError:
            logger.warning(f"GoldAPI timeout for {ticker}")
            return None
        except Exception as e:
            logger.error(f"GoldAPI error for {ticker}: {e}")
            return None


class ManualPriceProvider(PriceProvider):
    """
    Provider for assets that require manual price input.

    Used for: real_estate, bond, other (custom assets like jewelry, watches, art)
    Returns None - prices must be set manually by user.
    """

    def supports(self, asset_class: str) -> bool:
        return asset_class in ("real_estate", "bond", "other")

    async def get_price(self, ticker: str) -> Optional[dict]:
        """Manual assets don't have automatic prices."""
        return None


class CashPriceProvider(PriceProvider):
    """
    Provider for cash assets.

    Always returns 1 USD.
    """

    def supports(self, asset_class: str) -> bool:
        return asset_class == "cash"

    async def get_price(self, ticker: str) -> Optional[dict]:
        """Cash is always 1 USD."""
        return {
            "price_usd": 1.0,
            "change_24h_pct": 0.0,
            "market_cap": None,
            "volume_24h": None,
            "source": "fixed",
        }


class PriceService:
    """
    Main price service that coordinates multiple providers.

    Handles caching, rate limiting, and provider selection.
    """

    # Cache TTL by asset class (seconds)
    CACHE_TTL = {
        "crypto": 60,         # 1 minute
        "stock": 300,         # 5 minutes
        "etf": 300,           # 5 minutes
        "commodity": 300,     # 5 minutes
        "bond": 3600,         # 1 hour (manual)
        "real_estate": 86400, # 24 hours (manual)
        "cash": 86400,        # 24 hours (fixed)
        "other": 86400,       # 24 hours (manual - custom assets)
    }

    def __init__(self):
        self.providers = {
            "crypto": CoinGeckoPriceProvider(),
            "stock": YFinancePriceProvider(),
            "etf": YFinancePriceProvider(),
            "commodity": GoldAPIPriceProvider(),
            "real_estate": ManualPriceProvider(),
            "bond": ManualPriceProvider(),
            "cash": CashPriceProvider(),
        }

    def _get_provider(self, asset_class: str) -> Optional[PriceProvider]:
        """Get the appropriate provider for an asset class."""
        return self.providers.get(asset_class)

    def _is_cache_valid(self, fetched_at: str, asset_class: str) -> bool:
        """Check if cached price is still valid."""
        try:
            fetched_dt = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
            ttl = self.CACHE_TTL.get(asset_class, 300)
            return datetime.utcnow() - fetched_dt.replace(tzinfo=None) < timedelta(seconds=ttl)
        except Exception:
            return False

    async def get_price(
        self,
        asset_class: str,
        ticker: str,
        supabase_client=None,
        force_refresh: bool = False,
    ) -> Optional[dict]:
        """
        Get price for an asset, using cache when available.

        Args:
            asset_class: Type of asset (crypto, stock, etc.)
            ticker: Asset ticker symbol
            supabase_client: Supabase client for caching
            force_refresh: Skip cache and fetch fresh

        Returns:
            dict with price data or None
        """
        ticker = ticker.upper()

        # Check cache first (unless force refresh)
        if supabase_client and not force_refresh:
            try:
                cached = await supabase_client.get_cached_price(asset_class, ticker)
                if cached and self._is_cache_valid(cached["fetched_at"], asset_class):
                    logger.debug(f"Cache hit for {asset_class}:{ticker}")
                    return {
                        "price_usd": cached["price_usd"],
                        "change_24h_pct": cached.get("change_24h_pct"),
                        "market_cap": cached.get("market_cap"),
                        "volume_24h": cached.get("volume_24h"),
                        "source": cached.get("source", "cache"),
                        "fetched_at": cached["fetched_at"],
                    }
            except Exception as e:
                logger.debug(f"Cache lookup failed for {asset_class}:{ticker}: {e}")

        # Get provider
        provider = self._get_provider(asset_class)
        if not provider:
            logger.warning(f"No provider for asset class: {asset_class}")
            return None

        # Fetch fresh price
        logger.debug(f"Fetching fresh price for {asset_class}:{ticker}")
        price_data = await provider.get_price(ticker)

        if not price_data:
            return None

        # Update cache
        if supabase_client and price_data.get("price_usd"):
            try:
                await supabase_client.upsert_price_cache(
                    asset_class=asset_class,
                    ticker=ticker,
                    price_usd=price_data["price_usd"],
                    change_24h_pct=price_data.get("change_24h_pct"),
                    market_cap=price_data.get("market_cap"),
                    volume_24h=price_data.get("volume_24h"),
                    source=price_data.get("source", "unknown"),
                )
            except Exception as e:
                logger.warning(f"Failed to cache price: {e}")

        price_data["fetched_at"] = datetime.utcnow().isoformat()
        return price_data

    async def get_batch_prices(
        self,
        assets: list[dict],
        supabase_client=None,
    ) -> tuple[dict, dict]:
        """
        Fetch prices for multiple assets.

        Args:
            assets: List of {"asset_class": "...", "ticker": "..."} dicts
            supabase_client: Supabase client for caching

        Returns:
            Tuple of (prices dict, errors dict)
        """
        prices = {}
        errors = {}

        # Group by asset class for potential batching
        tasks = []
        for asset in assets:
            asset_class = asset.get("asset_class", "")
            ticker = asset.get("ticker", "").upper()
            key = f"{asset_class}:{ticker}"

            tasks.append(
                self._fetch_with_key(key, asset_class, ticker, supabase_client)
            )

        # Execute all fetches concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for item in results:
            # Handle exceptions from return_exceptions=True
            if isinstance(item, Exception):
                logger.warning(f"Batch price fetch error: {item}")
                continue

            # Unpack the (key, result) tuple from _fetch_with_key
            key, result = item
            if isinstance(result, Exception):
                errors[key] = str(result)
            elif result is None:
                errors[key] = "Price not available"
            else:
                prices[key] = result

        return prices, errors

    async def _fetch_with_key(
        self,
        key: str,
        asset_class: str,
        ticker: str,
        supabase_client,
    ) -> tuple[str, Optional[dict]]:
        """Helper to fetch price and return with key."""
        try:
            result = await self.get_price(asset_class, ticker, supabase_client)
            return (key, result)
        except Exception as e:
            return (key, e)


# Singleton
_price_service: Optional[PriceService] = None


def get_price_service() -> PriceService:
    """Get or create PriceService singleton."""
    global _price_service
    if _price_service is None:
        _price_service = PriceService()
    return _price_service
