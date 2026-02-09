"""
Dune Analytics API integration for on-chain data.
Requires API key from https://dune.com/settings/api
"""
import httpx
import logging
import asyncio
from dataclasses import dataclass
from typing import Optional, Any

from config import settings

logger = logging.getLogger(__name__)


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


class DuneService:
    """Service for fetching on-chain data from Dune Analytics API."""

    BASE_URL = "https://api.dune.com/api/v1"
    TIMEOUT = 60.0
    MAX_POLL_ATTEMPTS = 30
    POLL_INTERVAL = 2.0

    def __init__(self):
        self.api_key = settings.dune_api_key

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

    async def get_token_holders(
        self,
        token_address: str,
        chain: str = "ethereum"
    ) -> Optional[DuneData]:
        """
        Get token holder distribution.
        Note: This requires a pre-created query on Dune with appropriate parameters.

        For production use, you would need to:
        1. Create a query on Dune that accepts token_address and chain parameters
        2. Store the query_id in config
        3. Call execute_query with those parameters

        This is a placeholder that demonstrates the pattern.
        """
        # Example query ID - you would need to create your own query on Dune
        # and replace this with the actual query ID
        HOLDER_QUERY_ID = None  # Set to your query ID

        if not HOLDER_QUERY_ID:
            logger.debug("Holder distribution query not configured")
            return None

        results = await self.execute_query(
            HOLDER_QUERY_ID,
            parameters={
                "token_address": token_address,
                "chain": chain
            }
        )

        if not results:
            return None

        rows = results.get("result", {}).get("rows", [])
        if not rows:
            return None

        # Parse results based on your query structure
        row = rows[0]
        return DuneData(
            token_address=token_address,
            chain=chain,
            holder_count=row.get("holder_count"),
            top_10_holder_percent=row.get("top_10_percent"),
            top_100_holder_percent=row.get("top_100_percent"),
        )

    async def get_token_activity(
        self,
        token_address: str,
        chain: str = "ethereum"
    ) -> Optional[dict]:
        """
        Get token activity metrics (transfers, active addresses).
        Similar to get_token_holders, requires a pre-created query.
        """
        # Example query ID - create your own query on Dune
        ACTIVITY_QUERY_ID = None  # Set to your query ID

        if not ACTIVITY_QUERY_ID:
            logger.debug("Activity query not configured")
            return None

        results = await self.execute_query(
            ACTIVITY_QUERY_ID,
            parameters={
                "token_address": token_address,
                "chain": chain
            }
        )

        if not results:
            return None

        rows = results.get("result", {}).get("rows", [])
        if rows:
            return rows[0]

        return None

    async def get_token_data(
        self,
        token_address: str,
        chain: str = "ethereum"
    ) -> Optional[DuneData]:
        """
        Get comprehensive token on-chain data.
        Combines holder and activity data.
        """
        if not self.is_configured():
            return DuneData(
                token_address=token_address,
                chain=chain
            )

        # In a full implementation, you would run both queries
        holder_data = await self.get_token_holders(token_address, chain)

        if holder_data:
            activity = await self.get_token_activity(token_address, chain)
            if activity:
                holder_data.active_addresses_7d = activity.get("active_addresses_7d")
                holder_data.active_addresses_30d = activity.get("active_addresses_30d")
                holder_data.transfer_count_7d = activity.get("transfer_count_7d")

            return holder_data

        return DuneData(
            token_address=token_address,
            chain=chain
        )


# Singleton instance
_instance: Optional[DuneService] = None


def get_dune_service() -> DuneService:
    """Get singleton instance of DuneService."""
    global _instance
    if _instance is None:
        _instance = DuneService()
    return _instance
