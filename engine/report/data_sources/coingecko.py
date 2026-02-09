"""
CoinGecko API Data Source.

Provides price, market cap, ATH, supply, and community data.
API Documentation: https://www.coingecko.com/en/api/documentation
"""
import httpx
from typing import Dict, Any, Optional
from loguru import logger


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

    async def fetch(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch all available CoinGecko data for a token.

        Args:
            ticker: Token symbol (e.g., "SOL", "ETH")

        Returns:
            Dict with market data, supply, community info
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
        }

        try:
            coin_id = await self._resolve_coin_id(ticker)
            if not coin_id:
                logger.warning(f"Could not resolve CoinGecko ID for {ticker}")
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

                logger.info(f"CoinGecko data fetched for {ticker}")

        except httpx.HTTPStatusError as e:
            logger.error(f"CoinGecko API error for {ticker}: {e.response.status_code}")
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

                # Fallback to first result
                if coins:
                    return coins[0].get("id")

        except Exception as e:
            logger.warning(f"CoinGecko search failed for {ticker}: {e}")

        return None


# Singleton
_coingecko_source: Optional[CoinGeckoDataSource] = None


def get_coingecko_source() -> CoinGeckoDataSource:
    """Get or create CoinGecko data source singleton."""
    global _coingecko_source
    if _coingecko_source is None:
        _coingecko_source = CoinGeckoDataSource()
    return _coingecko_source
