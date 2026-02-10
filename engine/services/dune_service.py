"""
Dune Analytics API integration for on-chain data.
Requires API key from https://dune.com/settings/api

To configure:
1. Create queries on dune.com (see examples below)
2. Get the query IDs and add them to your .env file:
   - DUNE_HOLDER_QUERY_ID=123456
   - DUNE_ACTIVITY_QUERY_ID=123457
"""
import httpx
import logging
import asyncio
from dataclasses import dataclass
from typing import Optional, Any, Dict

from config import settings

logger = logging.getLogger(__name__)


# CoinGecko platform ID to Dune blockchain name mapping
COINGECKO_TO_DUNE_CHAIN: Dict[str, str] = {
    "ethereum": "ethereum",
    "binance-smart-chain": "bnb",
    "polygon-pos": "polygon",
    "arbitrum-one": "arbitrum",
    "optimistic-ethereum": "optimism",
    "avalanche": "avalanche",
    "fantom": "fantom",
    "base": "base",
    "solana": "solana",
    "tron": "tron",
    "gnosis": "gnosis",
    "celo": "celo",
    "moonbeam": "moonbeam",
    "harmony-shard-0": "harmony",
    "cronos": "cronos",
}


@dataclass
class DuneData:
    """On-chain data from Dune Analytics."""
    token_address: Optional[str] = None
    chain: Optional[str] = None
    holder_count: Optional[int] = None
    top_10_holder_percent: Optional[float] = None
    top_100_holder_percent: Optional[float] = None
    active_addresses_7d: Optional[int] = None
    active_addresses_30d: Optional[int] = None
    transfer_count_7d: Optional[int] = None
    transfer_volume_7d: Optional[float] = None
    unique_users_7d: Optional[int] = None


class DuneService:
    """Service for fetching on-chain data from Dune Analytics API."""

    BASE_URL = "https://api.dune.com/api/v1"
    TIMEOUT = 120.0
    MAX_POLL_ATTEMPTS = 60  # 60 attempts * 3 seconds = 3 minutes max
    POLL_INTERVAL = 3.0

    # Token address mappings for common tokens
    # Format: ticker -> (contract_address, chain)
    TOKEN_ADDRESSES: Dict[str, tuple] = {
        "AAVE": ("0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", "ethereum"),
        "UNI": ("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "ethereum"),
        "LINK": ("0x514910771AF9Ca656af840dff83E8264EcF986CA", "ethereum"),
        "MKR": ("0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", "ethereum"),
        "CRV": ("0xD533a949740bb3306d119CC777fa900bA034cd52", "ethereum"),
        "LDO": ("0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", "ethereum"),
        "COMP": ("0xc00e94Cb662C3520282E6f5717214004A7f26888", "ethereum"),
        "SNX": ("0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F", "ethereum"),
        "SUSHI": ("0x6B3595068778DD592e39A122f4f5a5cF09C90fE2", "ethereum"),
        "YFI": ("0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e", "ethereum"),
        "1INCH": ("0x111111111117dC0aa78b770fA6A738034120C302", "ethereum"),
        "BAL": ("0xba100000625a3754423978a60c9317c58a424e3D", "ethereum"),
        "ENS": ("0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72", "ethereum"),
        "GRT": ("0xc944E90C64B2c07662A292be6244BDf05Cda44a7", "ethereum"),
        "MATIC": ("0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", "ethereum"),
        "ARB": ("0x912CE59144191C1204E64559FE8253a0e49E6548", "arbitrum"),
        "OP": ("0x4200000000000000000000000000000000000042", "optimism"),
        "GMX": ("0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", "arbitrum"),
        "PENDLE": ("0x808507121B80c02388fAd14726482e061B8da827", "ethereum"),
        "JUP": ("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", "solana"),
    }

    def __init__(self):
        self.api_key = settings.dune_api_key
        self.combined_query_id = getattr(settings, 'dune_combined_query_id', 0)

    def is_configured(self) -> bool:
        """Check if Dune API is configured."""
        return bool(self.api_key)

    def _get_headers(self) -> dict:
        """Get headers for Dune API requests."""
        return {
            "X-Dune-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def execute_query(
        self,
        query_id: int,
        parameters: Optional[dict] = None
    ) -> Optional[dict]:
        """
        Execute a Dune query and wait for results.
        Uses polling to wait for query completion.
        """
        if not self.is_configured():
            logger.debug("Dune API key not configured")
            return None

        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                # Execute the query
                execute_url = f"{self.BASE_URL}/query/{query_id}/execute"
                payload = {}
                if parameters:
                    payload["query_parameters"] = parameters

                response = await client.post(
                    execute_url,
                    headers=self._get_headers(),
                    json=payload if payload else None
                )
                response.raise_for_status()
                execution_data = response.json()

                execution_id = execution_data.get("execution_id")
                if not execution_id:
                    logger.error("No execution_id in Dune response")
                    return None

                # Poll for results
                return await self._poll_for_results(client, execution_id)

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error("Dune API key invalid or expired")
            elif e.response.status_code == 429:
                logger.warning("Dune API rate limit exceeded")
            else:
                logger.error(f"Dune API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to execute Dune query: {e}")
            return None

    async def _poll_for_results(
        self,
        client: httpx.AsyncClient,
        execution_id: str
    ) -> Optional[dict]:
        """Poll for query execution results."""
        status_url = f"{self.BASE_URL}/execution/{execution_id}/status"
        results_url = f"{self.BASE_URL}/execution/{execution_id}/results"

        for attempt in range(self.MAX_POLL_ATTEMPTS):
            try:
                # Check status
                status_response = await client.get(
                    status_url,
                    headers=self._get_headers()
                )
                status_response.raise_for_status()
                status_data = status_response.json()

                state = status_data.get("state")

                if state == "QUERY_STATE_COMPLETED":
                    # Fetch results
                    results_response = await client.get(
                        results_url,
                        headers=self._get_headers()
                    )
                    results_response.raise_for_status()
                    return results_response.json()

                elif state in ["QUERY_STATE_FAILED", "QUERY_STATE_CANCELLED"]:
                    logger.error(f"Dune query failed with state: {state}")
                    return None

                # Still executing, wait and retry
                await asyncio.sleep(self.POLL_INTERVAL)

            except Exception as e:
                logger.error(f"Error polling Dune results: {e}")
                return None

        logger.error("Dune query timed out")
        return None

    async def get_latest_results(self, query_id: int) -> Optional[dict]:
        """
        Get the latest results for a query without re-executing.
        Faster than execute_query if results are recent.
        """
        if not self.is_configured():
            return None

        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                url = f"{self.BASE_URL}/query/{query_id}/results"
                response = await client.get(
                    url,
                    headers=self._get_headers()
                )
                response.raise_for_status()
                return response.json()

        except Exception as e:
            logger.debug(f"Failed to get latest Dune results: {e}")
            return None

    def get_token_address(self, ticker: str) -> Optional[tuple]:
        """
        Get token contract address and chain for a ticker.

        Returns:
            Tuple of (contract_address, chain) or None if not found
        """
        return self.TOKEN_ADDRESSES.get(ticker.upper())

    async def get_token_data(
        self,
        token_address: str,
        chain: str = "ethereum"
    ) -> Optional[DuneData]:
        """
        Get comprehensive token on-chain data using combined query.

        Returns holder count and 7d activity metrics.

        Query returns: holder_count, active_addresses_7d, transfer_count_7d, transfer_volume_7d
        """
        if not self.is_configured():
            logger.debug("Dune API key not configured")
            return None

        if not self.combined_query_id:
            logger.debug("Combined query not configured (set DUNE_COMBINED_QUERY_ID)")
            return None

        # Execute combined query with parameters
        results = await self.execute_query(
            self.combined_query_id,
            parameters={
                "token_address": token_address,
                "chain": chain
            }
        )

        if not results:
            return None

        rows = results.get("result", {}).get("rows", [])
        if not rows:
            logger.debug("No rows returned from Dune query")
            return None

        # Parse combined results
        row = rows[0]
        logger.info(f"Dune data fetched: holder_count={row.get('holder_count')}, active_7d={row.get('active_addresses_7d')}")

        return DuneData(
            token_address=token_address,
            chain=chain,
            holder_count=row.get("holder_count"),
            active_addresses_7d=row.get("active_addresses_7d"),
            transfer_count_7d=row.get("transfer_count_7d"),
            transfer_volume_7d=row.get("transfer_volume_7d"),
        )

    async def get_data_by_ticker(self, ticker: str) -> Optional[DuneData]:
        """
        Get on-chain data for a token by its ticker symbol.

        Uses the TOKEN_ADDRESSES mapping to find the contract address.

        Args:
            ticker: Token symbol (e.g., "AAVE", "UNI")

        Returns:
            DuneData with on-chain metrics or None
        """
        token_info = self.get_token_address(ticker)
        if not token_info:
            logger.debug(f"No token address mapping for {ticker}")
            return None

        token_address, chain = token_info
        return await self.get_token_data(token_address, chain)


# Singleton instance
_instance: Optional[DuneService] = None


def get_dune_service() -> DuneService:
    """Get singleton instance of DuneService."""
    global _instance
    if _instance is None:
        _instance = DuneService()
    return _instance
