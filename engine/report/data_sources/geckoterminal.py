"""
GeckoTerminal API Data Source.

Provides DEX liquidity data, pool information, and trading metrics.
API Documentation: https://apiguide.geckoterminal.com/
"""
import httpx
from typing import Dict, Any, Optional, List
from loguru import logger


class GeckoTerminalDataSource:
    """
    GeckoTerminal API client for DEX liquidity data.

    Free API, no authentication required.
    Rate limit: 10 calls/min on free tier.
    """

    BASE_URL = "https://api.geckoterminal.com/api/v2"

    # Map common chain names to GeckoTerminal network IDs
    CHAIN_TO_NETWORK = {
        "ethereum": "eth",
        "polygon": "polygon_pos",
        "arbitrum": "arbitrum",
        "optimism": "optimism",
        "bnb": "bsc",
        "base": "base",
        "avalanche": "avax",
        "fantom": "ftm",
        "solana": "solana",
    }

    async def fetch(self, contract_address: str, chain: str) -> Dict[str, Any]:
        """
        Fetch DEX liquidity data for a token.

        Args:
            contract_address: Token contract address
            chain: Chain name (e.g., "ethereum", "polygon")

        Returns:
            Dict with liquidity metrics
        """
        data = {
            "has_dex_data": False,
            "total_liquidity_usd": None,
            "total_volume_24h": None,
            "pool_count": 0,
            "top_pool_name": None,
            "top_pool_liquidity": None,
            "top_pool_volume_24h": None,
            "top_pool_dex": None,
            "price_change_24h": None,
            "buy_sell_ratio": None,
            "liquidity_depth_rating": "unknown",
            "pools": [],
        }

        if not contract_address:
            logger.debug("No contract address provided for GeckoTerminal")
            return data

        network = self.CHAIN_TO_NETWORK.get(chain.lower())
        if not network:
            logger.debug(f"Unsupported chain for GeckoTerminal: {chain}")
            return data

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Fetch token pools
                pools_data = await self._fetch_token_pools(client, network, contract_address)

                if pools_data:
                    data["has_dex_data"] = True
                    data.update(pools_data)

                    # Calculate liquidity depth rating
                    total_liq = data.get("total_liquidity_usd") or 0
                    if total_liq >= 10_000_000:  # $10M+
                        data["liquidity_depth_rating"] = "excellent"
                    elif total_liq >= 1_000_000:  # $1M+
                        data["liquidity_depth_rating"] = "good"
                    elif total_liq >= 100_000:  # $100K+
                        data["liquidity_depth_rating"] = "moderate"
                    elif total_liq >= 10_000:  # $10K+
                        data["liquidity_depth_rating"] = "low"
                    else:
                        data["liquidity_depth_rating"] = "very_low"

                    logger.info(f"GeckoTerminal: {data['pool_count']} pools, ${total_liq:,.0f} liquidity")

        except Exception as e:
            logger.warning(f"GeckoTerminal fetch failed: {e}")

        return data

    async def _fetch_token_pools(
        self,
        client: httpx.AsyncClient,
        network: str,
        contract_address: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch pools for a token on a specific network."""
        try:
            # Get top pools for this token
            url = f"{self.BASE_URL}/networks/{network}/tokens/{contract_address}/pools"
            params = {
                "page": 1,
            }

            response = await client.get(url, params=params)

            if response.status_code == 404:
                logger.debug(f"Token not found on GeckoTerminal: {network}/{contract_address}")
                return None

            response.raise_for_status()
            pools_json = response.json()

            pools = pools_json.get("data", [])
            if not pools:
                return None

            # Aggregate metrics
            total_liquidity = 0
            total_volume_24h = 0
            total_buys = 0
            total_sells = 0
            pool_details = []

            for pool in pools[:20]:  # Process top 20 pools
                attrs = pool.get("attributes", {})

                # Get liquidity
                reserve_usd = float(attrs.get("reserve_in_usd") or 0)
                total_liquidity += reserve_usd

                # Get volume
                volume_24h = float(attrs.get("volume_usd", {}).get("h24") or 0)
                total_volume_24h += volume_24h

                # Get buy/sell counts
                buys_24h = int(attrs.get("transactions", {}).get("h24", {}).get("buys") or 0)
                sells_24h = int(attrs.get("transactions", {}).get("h24", {}).get("sells") or 0)
                total_buys += buys_24h
                total_sells += sells_24h

                # Store pool details
                pool_details.append({
                    "name": attrs.get("name", "Unknown"),
                    "dex": attrs.get("dex_id", "unknown"),
                    "liquidity_usd": reserve_usd,
                    "volume_24h": volume_24h,
                    "price_change_24h": float(attrs.get("price_change_percentage", {}).get("h24") or 0),
                })

            # Sort pools by liquidity
            pool_details.sort(key=lambda x: x["liquidity_usd"], reverse=True)

            # Calculate buy/sell ratio
            buy_sell_ratio = None
            if total_buys + total_sells > 0:
                buy_sell_ratio = round(total_buys / (total_buys + total_sells) * 100, 1)

            result = {
                "total_liquidity_usd": total_liquidity,
                "total_volume_24h": total_volume_24h,
                "pool_count": len(pools),
                "buy_sell_ratio": buy_sell_ratio,
                "pools": pool_details[:5],  # Top 5 pools
            }

            # Set top pool data
            if pool_details:
                top_pool = pool_details[0]
                result["top_pool_name"] = top_pool["name"]
                result["top_pool_liquidity"] = top_pool["liquidity_usd"]
                result["top_pool_volume_24h"] = top_pool["volume_24h"]
                result["top_pool_dex"] = top_pool["dex"]
                result["price_change_24h"] = top_pool["price_change_24h"]

            return result

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.warning("GeckoTerminal rate limit exceeded")
            else:
                logger.warning(f"GeckoTerminal HTTP error: {e}")
            return None
        except Exception as e:
            logger.warning(f"GeckoTerminal pools fetch failed: {e}")
            return None

    async def fetch_by_ticker(self, ticker: str, chain: str = "ethereum") -> Dict[str, Any]:
        """
        Fetch DEX data by searching for token by ticker.

        This is a fallback when we don't have the contract address.
        Uses GeckoTerminal's search functionality.
        """
        data = {
            "has_dex_data": False,
            "total_liquidity_usd": None,
            "pool_count": 0,
            "liquidity_depth_rating": "unknown",
        }

        network = self.CHAIN_TO_NETWORK.get(chain.lower(), "eth")

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Search for token
                url = f"{self.BASE_URL}/search/pools"
                params = {"query": ticker, "network": network}

                response = await client.get(url, params=params)
                response.raise_for_status()
                search_json = response.json()

                pools = search_json.get("data", [])
                if not pools:
                    return data

                # Find the most liquid pool matching the ticker
                best_pool = None
                for pool in pools:
                    attrs = pool.get("attributes", {})
                    name = attrs.get("name", "").upper()
                    if ticker.upper() in name:
                        if best_pool is None:
                            best_pool = pool
                        else:
                            # Compare liquidity
                            current_liq = float(attrs.get("reserve_in_usd") or 0)
                            best_liq = float(best_pool.get("attributes", {}).get("reserve_in_usd") or 0)
                            if current_liq > best_liq:
                                best_pool = pool

                if best_pool:
                    attrs = best_pool.get("attributes", {})
                    liquidity = float(attrs.get("reserve_in_usd") or 0)

                    data["has_dex_data"] = True
                    data["total_liquidity_usd"] = liquidity
                    data["pool_count"] = 1
                    data["top_pool_name"] = attrs.get("name")
                    data["top_pool_dex"] = attrs.get("dex_id")

                    # Rating
                    if liquidity >= 1_000_000:
                        data["liquidity_depth_rating"] = "good"
                    elif liquidity >= 100_000:
                        data["liquidity_depth_rating"] = "moderate"
                    else:
                        data["liquidity_depth_rating"] = "low"

        except Exception as e:
            logger.warning(f"GeckoTerminal search failed for {ticker}: {e}")

        return data


# Singleton
_geckoterminal_source: Optional[GeckoTerminalDataSource] = None


def get_geckoterminal_source() -> GeckoTerminalDataSource:
    """Get or create GeckoTerminal data source singleton."""
    global _geckoterminal_source
    if _geckoterminal_source is None:
        _geckoterminal_source = GeckoTerminalDataSource()
    return _geckoterminal_source
