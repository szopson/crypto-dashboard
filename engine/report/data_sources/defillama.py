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
    Includes TVL, fees, and revenue data.
    """

    BASE_URL = "https://api.llama.fi"
    FEES_URL = "https://api.llama.fi/summary/fees"
    REVENUE_URL = "https://api.llama.fi/summary/revenue"

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
            Dict with TVL, protocol data, chain data, fees, and revenue
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
            # New: Fees and revenue data
            "daily_fees": None,
            "daily_revenue": None,
            "monthly_fees": None,
            "monthly_revenue": None,
            "fees_change_7d": None,
            "total_fees_all_time": None,
            "total_revenue_all_time": None,
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

                # Fetch fees and revenue data
                fees_data = await self._fetch_fees_data(client, ticker)
                if fees_data:
                    data.update(fees_data)

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

    async def _fetch_fees_data(
        self,
        client: httpx.AsyncClient,
        ticker: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch protocol fees and revenue data from DefiLlama.

        Uses the /summary/fees/{protocol} endpoint.
        """
        slug = self.TICKER_MAP.get(ticker.upper(), ticker.lower())

        try:
            # Try to fetch fees data
            response = await client.get(f"{self.FEES_URL}/{slug}")
            if response.status_code == 200:
                fees_json = response.json()

                result = {
                    "daily_fees": fees_json.get("total24h"),
                    "monthly_fees": fees_json.get("total30d"),
                    "total_fees_all_time": fees_json.get("totalAllTime"),
                    "fees_change_7d": fees_json.get("change_7d"),
                }

                # Try to fetch revenue data separately
                try:
                    rev_response = await client.get(f"{self.REVENUE_URL}/{slug}")
                    if rev_response.status_code == 200:
                        rev_json = rev_response.json()
                        result["daily_revenue"] = rev_json.get("total24h")
                        result["monthly_revenue"] = rev_json.get("total30d")
                        result["total_revenue_all_time"] = rev_json.get("totalAllTime")
                except Exception:
                    # Revenue endpoint might not exist for all protocols
                    # Estimate revenue as ~10-30% of fees (protocol dependent)
                    if result.get("daily_fees"):
                        result["daily_revenue"] = result["daily_fees"] * 0.2  # Conservative estimate
                    if result.get("monthly_fees"):
                        result["monthly_revenue"] = result["monthly_fees"] * 0.2

                logger.debug(f"DefiLlama fees fetched for {ticker}: daily_fees={result.get('daily_fees')}")
                return result

            return None

        except Exception as e:
            logger.warning(f"DefiLlama fees fetch failed for {ticker}: {e}")
            return None

    async def get_chains_tvl(self) -> Dict[str, float]:
        """
        Fetch TVL for all chains from DefiLlama.

        Returns:
            Dict mapping chain name (lowercase) to TVL in USD
        """
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.BASE_URL}/v2/chains")
                response.raise_for_status()
                chains = response.json()

                result = {}
                for chain in chains:
                    chain_name = chain.get("name", "").lower()
                    tvl = chain.get("tvl", 0)
                    if chain_name and tvl:
                        result[chain_name] = tvl

                logger.debug(f"Fetched TVL for {len(result)} chains")
                return result

        except Exception as e:
            logger.warning(f"Failed to fetch chains TVL: {e}")
            return {}

    async def fetch_competitor_data(
        self,
        tickers: list,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetch data for multiple protocols for comparison.

        Args:
            tickers: List of protocol tickers to compare

        Returns:
            Dict mapping ticker to its data
        """
        results = {}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                for ticker in tickers:
                    data = {
                        "tvl": None,
                        "tvl_change_7d": None,
                        "daily_fees": None,
                        "daily_revenue": None,
                        "monthly_fees": None,
                    }

                    # Fetch protocol data
                    protocol_data = await self._fetch_protocol_data(client, ticker)
                    if protocol_data:
                        data["tvl"] = protocol_data.get("tvl")
                        data["tvl_change_7d"] = protocol_data.get("change_7d")

                    # Fetch fees
                    fees_data = await self._fetch_fees_data(client, ticker)
                    if fees_data:
                        data["daily_fees"] = fees_data.get("daily_fees")
                        data["daily_revenue"] = fees_data.get("daily_revenue")
                        data["monthly_fees"] = fees_data.get("monthly_fees")

                    results[ticker] = data

        except Exception as e:
            logger.error(f"DefiLlama competitor fetch error: {e}")

        return results

    async def fetch_unlocks(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch token unlock schedule from DefiLlama.

        Args:
            ticker: Token symbol (e.g., "ARB", "OP")

        Returns:
            Dict with unlock schedule data
        """
        from datetime import datetime, timedelta

        data = {
            "has_unlocks": False,
            "next_unlock_date": None,
            "next_unlock_amount": None,
            "next_unlock_usd": None,
            "next_unlock_percent": None,
            "unlocks_30d_total": None,
            "unlocks_30d_percent": None,
            "unlock_risk_level": "low",
            "total_locked": None,
            "total_unlocked": None,
            "unlock_events": [],
        }

        slug = self.TICKER_MAP.get(ticker.upper(), ticker.lower())

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.BASE_URL}/unlocks/{slug}")

                if response.status_code != 200:
                    logger.debug(f"No unlock data for {ticker}")
                    return data

                unlocks_json = response.json()

                # Check if we have unlock events
                events = unlocks_json.get("events", [])
                if not events:
                    logger.debug(f"No unlock events for {ticker}")
                    return data

                data["has_unlocks"] = True
                now = datetime.utcnow()
                thirty_days_later = now + timedelta(days=30)

                # Get token metadata
                token_price = unlocks_json.get("tokenPrice", {}).get("price", 0)
                max_supply = unlocks_json.get("maxSupply", 0)

                # Find next unlock and calculate 30-day totals
                next_unlock = None
                unlocks_30d_amount = 0

                for event in events:
                    # Parse timestamp (milliseconds)
                    timestamp_ms = event.get("timestamp", 0)
                    if not timestamp_ms:
                        continue

                    event_date = datetime.utcfromtimestamp(timestamp_ms / 1000)
                    amount = event.get("noOfTokens", 0)

                    # Is this the next upcoming unlock?
                    if event_date > now:
                        if next_unlock is None or event_date < datetime.utcfromtimestamp(next_unlock["timestamp"] / 1000):
                            next_unlock = event

                        # Is it within 30 days?
                        if event_date <= thirty_days_later:
                            unlocks_30d_amount += amount

                # Process next unlock
                if next_unlock:
                    next_date = datetime.utcfromtimestamp(next_unlock["timestamp"] / 1000)
                    next_amount = next_unlock.get("noOfTokens", 0)
                    next_usd = next_amount * token_price if token_price else 0
                    next_percent = (next_amount / max_supply * 100) if max_supply else 0

                    data["next_unlock_date"] = next_date.strftime("%Y-%m-%d")
                    data["next_unlock_amount"] = next_amount
                    data["next_unlock_usd"] = next_usd
                    data["next_unlock_percent"] = round(next_percent, 2)

                    # Add top unlock events (next 5)
                    upcoming = [e for e in events if e.get("timestamp", 0) > now.timestamp() * 1000]
                    upcoming.sort(key=lambda x: x.get("timestamp", 0))
                    data["unlock_events"] = [
                        {
                            "date": datetime.utcfromtimestamp(e["timestamp"] / 1000).strftime("%Y-%m-%d"),
                            "amount": e.get("noOfTokens", 0),
                            "description": e.get("description", ""),
                        }
                        for e in upcoming[:5]
                    ]

                # Process 30-day totals
                if unlocks_30d_amount > 0:
                    unlocks_30d_usd = unlocks_30d_amount * token_price if token_price else 0
                    unlocks_30d_percent = (unlocks_30d_amount / max_supply * 100) if max_supply else 0

                    data["unlocks_30d_total"] = unlocks_30d_usd
                    data["unlocks_30d_percent"] = round(unlocks_30d_percent, 2)

                    # Determine risk level based on 30-day unlock percentage
                    if unlocks_30d_percent >= 5:
                        data["unlock_risk_level"] = "high"
                    elif unlocks_30d_percent >= 2:
                        data["unlock_risk_level"] = "medium"
                    else:
                        data["unlock_risk_level"] = "low"

                # Get locked/unlocked totals if available
                data["total_locked"] = unlocks_json.get("totalLocked")
                data["total_unlocked"] = unlocks_json.get("totalUnlocked")

                logger.info(f"DefiLlama unlocks fetched for {ticker}: next={data['next_unlock_date']}, 30d_total=${data.get('unlocks_30d_total', 0):,.0f}")

        except Exception as e:
            logger.warning(f"DefiLlama unlocks fetch failed for {ticker}: {e}")

        return data


# Singleton
_defillama_source: Optional[DefiLlamaDataSource] = None


def get_defillama_source() -> DefiLlamaDataSource:
    """Get or create DefiLlama data source singleton."""
    global _defillama_source
    if _defillama_source is None:
        _defillama_source = DefiLlamaDataSource()
    return _defillama_source
