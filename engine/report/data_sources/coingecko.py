"""
CoinGecko API Data Source.

Provides price, market cap, ATH, supply, and community data.
API Documentation: https://www.coingecko.com/en/api/documentation
"""
import httpx
from typing import Dict, Any, Optional, List
from loguru import logger


class TokenNotFoundError(Exception):
    """Raised when a token ticker cannot be found in CoinGecko."""

    def __init__(self, ticker: str, suggestions: List[Dict[str, str]] = None):
        self.ticker = ticker
        self.suggestions = suggestions or []
        super().__init__(f"Token '{ticker}' not found")


class CoinGeckoDataSource:
    """
    CoinGecko API client for market data.

    Free API, no authentication required (rate limited to 10-50 req/min).
    """

    BASE_URL = "https://api.coingecko.com/api/v3"

    # Common ticker to CoinGecko ID mapping
    TICKER_MAP = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "XRP": "ripple",
        "ADA": "cardano",
        "AVAX": "avalanche-2",
        "DOT": "polkadot",
        "LINK": "chainlink",
        "MATIC": "matic-network",
        "DOGE": "dogecoin",
        "SHIB": "shiba-inu",
        "LTC": "litecoin",
        "UNI": "uniswap",
        "ATOM": "cosmos",
        "XLM": "stellar",
        "NEAR": "near",
        "ARB": "arbitrum",
        "OP": "optimism",
        "SUI": "sui",
        "APT": "aptos",
        "INJ": "injective-protocol",
        "SEI": "sei-network",
        "TIA": "celestia",
        "JUP": "jupiter-exchange-solana",
        "RENDER": "render-token",
        "FET": "fetch-ai",
        "TAO": "bittensor",
        "AAVE": "aave",
        "MKR": "maker",
        "CRV": "curve-dao-token",
        "LDO": "lido-dao",
        "PENDLE": "pendle",
        "EIGEN": "eigenlayer",
    }

    async def fetch(self, ticker: str, raise_on_not_found: bool = False) -> Dict[str, Any]:
        """
        Fetch all available CoinGecko data for a token.

        Args:
            ticker: Token symbol (e.g., "SOL", "ETH")
            raise_on_not_found: If True, raise TokenNotFoundError when token not found

        Returns:
            Dict with market data, supply, community info

        Raises:
            TokenNotFoundError: If raise_on_not_found=True and token not found
        """
        data = {
            "name": ticker,
            "symbol": ticker,
            "current_price": None,
            "market_cap": None,
            "fdv": None,
            "ath": None,
            "ath_change_percentage": None,
            "ath_date": None,
            "atl": None,
            "atl_change_percentage": None,
            "price_change_24h": None,
            "price_change_7d": None,
            "price_change_30d": None,
            "total_volume": None,
            "circulating_supply": None,
            "total_supply": None,
            "max_supply": None,
            "high_24h": None,
            "low_24h": None,
            "community_data": {},
            "developer_data": {},
            "categories": [],
            "found": False,  # Track if token was found
        }

        try:
            coin_id = await self._resolve_coin_id(ticker)
            if not coin_id:
                logger.warning(f"Could not resolve CoinGecko ID for {ticker}")
                if raise_on_not_found:
                    suggestions = await self.search_suggestions(ticker)
                    raise TokenNotFoundError(ticker, suggestions)
                return data

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"{self.BASE_URL}/coins/{coin_id}",
                    params={
                        "localization": "false",
                        "tickers": "false",
                        "market_data": "true",
                        "community_data": "true",
                        "developer_data": "true",
                        "sparkline": "false",
                    }
                )
                response.raise_for_status()
                coin_data = response.json()

                # Basic info
                data["name"] = coin_data.get("name", ticker)
                data["symbol"] = coin_data.get("symbol", ticker).upper()
                data["categories"] = coin_data.get("categories", [])

                # Market data
                market = coin_data.get("market_data", {})
                if market:
                    data["current_price"] = market.get("current_price", {}).get("usd")
                    data["market_cap"] = market.get("market_cap", {}).get("usd")
                    data["fdv"] = market.get("fully_diluted_valuation", {}).get("usd")
                    data["total_volume"] = market.get("total_volume", {}).get("usd")

                    data["ath"] = market.get("ath", {}).get("usd")
                    data["ath_change_percentage"] = market.get("ath_change_percentage", {}).get("usd")
                    data["ath_date"] = market.get("ath_date", {}).get("usd")
                    data["atl"] = market.get("atl", {}).get("usd")
                    data["atl_change_percentage"] = market.get("atl_change_percentage", {}).get("usd")

                    data["price_change_24h"] = market.get("price_change_percentage_24h")
                    data["price_change_7d"] = market.get("price_change_percentage_7d")
                    data["price_change_30d"] = market.get("price_change_percentage_30d")

                    data["high_24h"] = market.get("high_24h", {}).get("usd")
                    data["low_24h"] = market.get("low_24h", {}).get("usd")

                    data["circulating_supply"] = market.get("circulating_supply")
                    data["total_supply"] = market.get("total_supply")
                    data["max_supply"] = market.get("max_supply")

                # Community data
                data["community_data"] = coin_data.get("community_data", {})

                # Developer data
                data["developer_data"] = coin_data.get("developer_data", {})

                # Platform/chain data (for Dune queries)
                platforms = coin_data.get("platforms", {})
                # Filter out empty addresses
                data["platforms"] = {k: v for k, v in platforms.items() if v}

                # Mark as found
                data["found"] = True
                logger.info(f"CoinGecko data fetched for {ticker}")

        except TokenNotFoundError:
            # Re-raise TokenNotFoundError
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"CoinGecko API error for {ticker}: {e.response.status_code}")
            if raise_on_not_found and e.response.status_code == 404:
                suggestions = await self.search_suggestions(ticker)
                raise TokenNotFoundError(ticker, suggestions)
        except Exception as e:
            logger.error(f"CoinGecko fetch error for {ticker}: {e}")

        return data

    async def _resolve_coin_id(self, ticker: str) -> Optional[str]:
        """Resolve ticker symbol to CoinGecko coin ID."""
        ticker_upper = ticker.upper()

        # Check mapping first
        if ticker_upper in self.TICKER_MAP:
            return self.TICKER_MAP[ticker_upper]

        # Search API
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    f"{self.BASE_URL}/search",
                    params={"query": ticker}
                )
                response.raise_for_status()
                results = response.json()

                coins = results.get("coins", [])
                for coin in coins:
                    if coin.get("symbol", "").upper() == ticker_upper:
                        return coin.get("id")

                # Fallback to first result if symbol matches closely
                if coins and len(coins) > 0:
                    first_coin = coins[0]
                    # Only use first result if it's a close match
                    if first_coin.get("symbol", "").upper() == ticker_upper:
                        return first_coin.get("id")

        except Exception as e:
            logger.warning(f"CoinGecko search failed for {ticker}: {e}")

        return None

    async def search_suggestions(self, ticker: str, limit: int = 5) -> List[Dict[str, str]]:
        """
        Search for similar tokens to provide suggestions.

        Args:
            ticker: The ticker that was not found
            limit: Maximum number of suggestions to return

        Returns:
            List of suggestions with id, symbol, name, and market_cap_rank
        """
        suggestions = []

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    f"{self.BASE_URL}/search",
                    params={"query": ticker}
                )
                response.raise_for_status()
                results = response.json()

                coins = results.get("coins", [])
                for coin in coins[:limit]:
                    suggestions.append({
                        "id": coin.get("id", ""),
                        "symbol": coin.get("symbol", "").upper(),
                        "name": coin.get("name", ""),
                        "market_cap_rank": coin.get("market_cap_rank"),
                    })

        except Exception as e:
            logger.warning(f"CoinGecko suggestion search failed for {ticker}: {e}")

        # If no results from search, suggest popular tokens
        if not suggestions:
            suggestions = [
                {"symbol": "BTC", "name": "Bitcoin", "id": "bitcoin", "market_cap_rank": 1},
                {"symbol": "ETH", "name": "Ethereum", "id": "ethereum", "market_cap_rank": 2},
                {"symbol": "SOL", "name": "Solana", "id": "solana", "market_cap_rank": 5},
            ]

        return suggestions

    async def validate_ticker(self, ticker: str) -> tuple:
        """
        Validate if a ticker exists and return coin_id or raise TokenNotFoundError.

        Args:
            ticker: Token symbol to validate

        Returns:
            Tuple of (coin_id, is_valid)

        Raises:
            TokenNotFoundError: If ticker is not found, includes suggestions
        """
        coin_id = await self._resolve_coin_id(ticker)

        if coin_id:
            return coin_id, True

        # Token not found - get suggestions
        suggestions = await self.search_suggestions(ticker)
        raise TokenNotFoundError(ticker, suggestions)


# Singleton
_coingecko_source: Optional[CoinGeckoDataSource] = None


def get_coingecko_source() -> CoinGeckoDataSource:
    """Get or create CoinGecko data source singleton."""
    global _coingecko_source
    if _coingecko_source is None:
        _coingecko_source = CoinGeckoDataSource()
    return _coingecko_source
