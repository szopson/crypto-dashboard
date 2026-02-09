"""
DefiLlama API integration for TVL and protocol data.
API is free and doesn't require authentication.
"""
import httpx
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class DefiLlamaData:
    """Data from DefiLlama API."""
    protocol_name: str
    tvl: Optional[float] = None
    tvl_change_1d: Optional[float] = None
    tvl_change_7d: Optional[float] = None
    tvl_change_30d: Optional[float] = None
    mcap_tvl_ratio: Optional[float] = None
    category: Optional[str] = None
    chains: Optional[list[str]] = None
    url: Optional[str] = None


class DefiLlamaService:
    """Service for fetching data from DefiLlama API."""

    BASE_URL = "https://api.llama.fi"
    TIMEOUT = 30.0

    def __init__(self):
        self._protocols_cache: Optional[list[dict]] = None

    async def _fetch_protocols_list(self) -> list[dict]:
        """Fetch and cache the list of all protocols."""
        if self._protocols_cache is not None:
            return self._protocols_cache

        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                response = await client.get(f"{self.BASE_URL}/protocols")
                response.raise_for_status()
                self._protocols_cache = response.json()
                return self._protocols_cache
        except Exception as e:
            logger.error(f"Failed to fetch DefiLlama protocols list: {e}")
            return []

    async def search_protocol(self, name: str) -> Optional[str]:
        """
        Search for a protocol by name or symbol.
        Returns the protocol slug if found.
        """
        protocols = await self._fetch_protocols_list()
        if not protocols:
            return None

        name_lower = name.lower()

        # First try exact symbol match
        for protocol in protocols:
            symbol = protocol.get("symbol", "").lower()
            if symbol == name_lower:
                return protocol.get("slug")

        # Then try name contains
        for protocol in protocols:
            protocol_name = protocol.get("name", "").lower()
            if name_lower in protocol_name or protocol_name in name_lower:
                return protocol.get("slug")

        # Try gecko_id match
        for protocol in protocols:
            gecko_id = protocol.get("gecko_id", "").lower() if protocol.get("gecko_id") else ""
            if gecko_id == name_lower:
                return protocol.get("slug")

        return None

    async def get_protocol_data(self, protocol_slug: str) -> Optional[DefiLlamaData]:
        """
        Fetch detailed protocol data including TVL and changes.
        """
        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                response = await client.get(f"{self.BASE_URL}/protocol/{protocol_slug}")
                response.raise_for_status()
                data = response.json()

                # Extract TVL
                tvl = data.get("tvl")
                if isinstance(tvl, list) and tvl:
                    tvl = tvl[-1].get("totalLiquidityUSD") if isinstance(tvl[-1], dict) else tvl[-1]

                # Current TVL from currentChainTvls
                current_chain_tvls = data.get("currentChainTvls", {})
                if current_chain_tvls and not tvl:
                    # Sum all chain TVLs (excluding staking, pool2, etc.)
                    tvl = sum(
                        v for k, v in current_chain_tvls.items()
                        if not any(x in k.lower() for x in ["staking", "pool2", "borrowed"])
                    )

                # Extract chains
                chains = list(data.get("chains", []))

                return DefiLlamaData(
                    protocol_name=data.get("name", protocol_slug),
                    tvl=tvl,
                    tvl_change_1d=data.get("change_1d"),
                    tvl_change_7d=data.get("change_7d"),
                    tvl_change_30d=data.get("change_1m"),
                    mcap_tvl_ratio=data.get("mcap") / tvl if data.get("mcap") and tvl else None,
                    category=data.get("category"),
                    chains=chains if chains else None,
                    url=data.get("url"),
                )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.debug(f"Protocol not found on DefiLlama: {protocol_slug}")
            else:
                logger.error(f"DefiLlama API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to fetch DefiLlama protocol data: {e}")
            return None

    async def get_protocol_by_name(self, name: str) -> Optional[DefiLlamaData]:
        """
        Search for a protocol by name and return its data.
        Convenience method that combines search and fetch.
        """
        slug = await self.search_protocol(name)
        if not slug:
            logger.debug(f"Protocol '{name}' not found on DefiLlama")
            return None

        return await self.get_protocol_data(slug)


# Singleton instance
_instance: Optional[DefiLlamaService] = None


def get_defillama_service() -> DefiLlamaService:
    """Get singleton instance of DefiLlamaService."""
    global _instance
    if _instance is None:
        _instance = DefiLlamaService()
    return _instance
