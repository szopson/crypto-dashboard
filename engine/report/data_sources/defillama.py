"""
DefiLlama API Data Source.

Provides TVL, protocol data, and DeFi metrics.
API Documentation: https://defillama.com/docs/api
"""
import httpx
from typing import Dict, Any, Optional
from loguru import logger


class DefiLlamaDataSource:
    """
    DefiLlama API client for DeFi protocol data.

    Free API, no authentication required.
    """

    BASE_URL = "https://api.llama.fi"

    # Common ticker to DefiLlama slug mapping
    TICKER_MAP = {
        "SOL": "solana",
        "ETH": "ethereum",
        "AVAX": "avalanche",
        "MATIC": "polygon",
        "ARB": "arbitrum",
        "OP": "optimism",
        "BNB": "bsc",
        "FTM": "fantom",
        "NEAR": "near",
        "SUI": "sui",
        "APT": "aptos",
        "SEI": "sei",
        "INJ": "injective",
        "AAVE": "aave",
        "UNI": "uniswap",
        "MKR": "makerdao",
        "CRV": "curve-finance",
        "LDO": "lido",
        "PENDLE": "pendle",
        "GMX": "gmx",
        "DYDX": "dydx",
        "JUP": "jupiter",
    }

    async def fetch(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch all available DefiLlama data for a token/protocol.

        Args:
            ticker: Token symbol (e.g., "SOL", "ETH")

        Returns:
            Dict with TVL, protocol data, chain data
        """
        data = {
            "tvl": None,
            "tvl_change_1d": None,
            "tvl_change_7d": None,
            "tvl_change_30d": None,
            "chain_tvl": None,
            "protocol_tvl": None,
            "category": None,
            "chains": [],
            "revenue": None,
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Try as chain first (for L1/L2)
                chain_data = await self._fetch_chain_data(client, ticker)
                if chain_data:
                    data["chain_tvl"] = chain_data.get("tvl")
                    data["tvl"] = chain_data.get("tvl")

                # Try as protocol
                protocol_data = await self._fetch_protocol_data(client, ticker)
                if protocol_data:
                    data["protocol_tvl"] = protocol_data.get("tvl")
                    data["category"] = protocol_data.get("category")
                    data["chains"] = protocol_data.get("chains", [])
                    data["tvl_change_1d"] = protocol_data.get("change_1d")
                    data["tvl_change_7d"] = protocol_data.get("change_7d")
                    data["tvl_change_30d"] = protocol_data.get("change_1m")

                    if not data["tvl"]:
                        data["tvl"] = protocol_data.get("tvl")

                logger.info(f"DefiLlama data fetched for {ticker}")

        except Exception as e:
            logger.error(f"DefiLlama fetch error for {ticker}: {e}")

        return data

    async def _fetch_chain_data(
        self,
        client: httpx.AsyncClient,
        ticker: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch chain TVL data."""
        try:
            response = await client.get(f"{self.BASE_URL}/v2/chains")
            response.raise_for_status()
            chains = response.json()

            ticker_lower = ticker.lower()
            slug = self.TICKER_MAP.get(ticker.upper(), ticker_lower)

            for chain in chains:
                chain_name = chain.get("name", "").lower()
                gecko_id = chain.get("gecko_id", "").lower()
                token_symbol = chain.get("tokenSymbol", "").lower()

                if (ticker_lower == chain_name or
                    ticker_lower == gecko_id or
                    ticker_lower == token_symbol or
                    slug == chain_name):
                    return {
                        "name": chain.get("name"),
                        "tvl": chain.get("tvl"),
                        "tokenSymbol": chain.get("tokenSymbol"),
                    }

            return None

        except Exception as e:
            logger.warning(f"DefiLlama chain fetch failed: {e}")
            return None

    async def _fetch_protocol_data(
        self,
        client: httpx.AsyncClient,
        ticker: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch protocol data by searching protocols list."""
        try:
            response = await client.get(f"{self.BASE_URL}/protocols")
            response.raise_for_status()
            protocols = response.json()

            ticker_lower = ticker.lower()
            slug = self.TICKER_MAP.get(ticker.upper(), ticker_lower)

            for protocol in protocols:
                symbol = protocol.get("symbol", "").lower()
                protocol_slug = protocol.get("slug", "").lower()
                name = protocol.get("name", "").lower()

                if (ticker_lower == symbol or
                    ticker_lower == protocol_slug or
                    slug == protocol_slug or
                    ticker_lower == name):
                    return {
                        "name": protocol.get("name"),
                        "tvl": protocol.get("tvl"),
                        "category": protocol.get("category"),
                        "chains": protocol.get("chains", []),
                        "change_1d": protocol.get("change_1d"),
                        "change_7d": protocol.get("change_7d"),
                        "change_1m": protocol.get("change_1m"),
                    }

            return None

        except Exception as e:
            logger.warning(f"DefiLlama protocol fetch failed: {e}")
            return None


# Singleton
_defillama_source: Optional[DefiLlamaDataSource] = None


def get_defillama_source() -> DefiLlamaDataSource:
    """Get or create DefiLlama data source singleton."""
    global _defillama_source
    if _defillama_source is None:
        _defillama_source = DefiLlamaDataSource()
    return _defillama_source
