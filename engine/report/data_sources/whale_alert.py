"""
Whale Alert API Data Source.

Provides large transaction tracking and whale movement data.
API Documentation: https://developer.whale-alert.io/documentation/

IMPORTANT: This is a PAID service ($29.95/month).
If WHALE_ALERT_API_KEY is not configured, this data source will be skipped gracefully.
"""
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from loguru import logger

from config import settings


class WhaleAlertDataSource:
    """
    Whale Alert API client for whale transaction tracking.

    Requires PAID API key ($29.95/month). See: https://whale-alert.io/pricing
    """

    BASE_URL = "https://api.whale-alert.io/v1"

    # Map tickers to blockchain names used by Whale Alert
    TICKER_TO_BLOCKCHAIN = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "XRP": "ripple",
        "USDT": "ethereum",  # Tether on ETH
        "USDC": "ethereum",  # USDC on ETH
        "SOL": "solana",
        "DOGE": "dogecoin",
        "LTC": "litecoin",
        "LINK": "ethereum",
        "UNI": "ethereum",
        "AAVE": "ethereum",
        "MKR": "ethereum",
        "CRV": "ethereum",
        "LDO": "ethereum",
        "ARB": "arbitrum",
        "OP": "optimism",
        "MATIC": "polygon",
    }

    # Known exchange addresses (simplified)
    EXCHANGE_KEYWORDS = [
        "binance", "coinbase", "kraken", "bitfinex", "huobi",
        "okex", "ftx", "bybit", "kucoin", "gate.io", "gemini",
        "bitstamp", "bittrex", "poloniex", "exchange",
    ]

    def __init__(self):
        self.api_key = getattr(settings, 'whale_alert_api_key', None)

    def is_configured(self) -> bool:
        """Check if Whale Alert API key is configured."""
        return bool(self.api_key)

    async def fetch(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch whale transaction data for a token.

        Args:
            ticker: Token symbol (e.g., "BTC", "ETH")

        Returns:
            Dict with whale activity metrics
        """
        data = {
            "has_whale_data": False,
            "whale_tx_count_7d": 0,
            "whale_largest_tx": None,
            "whale_largest_tx_usd": None,
            "whale_net_flow": None,
            "whale_flow_direction": "neutral",
            "whale_exchange_inflow": 0,
            "whale_exchange_outflow": 0,
            "whale_transactions": [],
        }

        if not self.is_configured():
            logger.debug("Whale Alert API key not configured")
            return data

        blockchain = self.TICKER_TO_BLOCKCHAIN.get(ticker.upper())
        if not blockchain:
            logger.debug(f"Unsupported token for Whale Alert: {ticker}")
            return data

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Fetch recent large transactions
                transactions = await self._fetch_transactions(
                    client,
                    blockchain=blockchain,
                    symbol=ticker.lower(),
                    min_value_usd=1_000_000,  # $1M minimum
                    days=7,
                )

                if transactions:
                    data["has_whale_data"] = True
                    data["whale_tx_count_7d"] = len(transactions)

                    # Find largest transaction
                    largest = max(transactions, key=lambda x: x.get("amount_usd", 0))
                    data["whale_largest_tx"] = f"{largest.get('amount', 0):,.0f} {ticker.upper()}"
                    data["whale_largest_tx_usd"] = largest.get("amount_usd", 0)

                    # Calculate exchange flows
                    inflow, outflow = self._calculate_exchange_flows(transactions)
                    data["whale_exchange_inflow"] = inflow
                    data["whale_exchange_outflow"] = outflow

                    # Net flow
                    net_flow = outflow - inflow  # Positive = leaving exchanges
                    data["whale_net_flow"] = net_flow

                    # Determine flow direction
                    if net_flow > 1_000_000:  # >$1M net outflow
                        data["whale_flow_direction"] = "accumulating"
                    elif net_flow < -1_000_000:  # >$1M net inflow
                        data["whale_flow_direction"] = "distributing"
                    else:
                        data["whale_flow_direction"] = "neutral"

                    # Store top 5 transactions
                    sorted_txs = sorted(transactions, key=lambda x: x.get("amount_usd", 0), reverse=True)
                    data["whale_transactions"] = [
                        {
                            "amount": tx.get("amount", 0),
                            "amount_usd": tx.get("amount_usd", 0),
                            "from": tx.get("from_owner", "Unknown"),
                            "to": tx.get("to_owner", "Unknown"),
                            "timestamp": tx.get("timestamp"),
                        }
                        for tx in sorted_txs[:5]
                    ]

                    logger.info(f"Whale Alert: {len(transactions)} txs, net_flow=${net_flow:,.0f} ({data['whale_flow_direction']})")

        except Exception as e:
            logger.warning(f"Whale Alert fetch failed for {ticker}: {e}")

        return data

    async def _fetch_transactions(
        self,
        client: httpx.AsyncClient,
        blockchain: str,
        symbol: str,
        min_value_usd: int = 1_000_000,
        days: int = 7,
    ) -> List[Dict[str, Any]]:
        """Fetch large transactions from Whale Alert API."""
        now = datetime.utcnow()
        start = now - timedelta(days=days)

        try:
            url = f"{self.BASE_URL}/transactions"
            params = {
                "api_key": self.api_key,
                "blockchain": blockchain,
                "symbol": symbol,
                "min_value": min_value_usd,
                "start": int(start.timestamp()),
                "limit": 100,
            }

            response = await client.get(url, params=params)

            if response.status_code == 401:
                logger.warning("Whale Alert API key invalid or expired")
                return []

            if response.status_code == 429:
                logger.warning("Whale Alert rate limit exceeded")
                return []

            response.raise_for_status()
            result = response.json()

            transactions = result.get("transactions", [])
            return transactions

        except httpx.HTTPStatusError as e:
            logger.warning(f"Whale Alert HTTP error: {e}")
            return []
        except Exception as e:
            logger.warning(f"Whale Alert fetch failed: {e}")
            return []

    def _calculate_exchange_flows(
        self,
        transactions: List[Dict[str, Any]],
    ) -> tuple:
        """
        Calculate exchange inflows and outflows from transactions.

        Returns:
            Tuple of (inflow_usd, outflow_usd)
        """
        inflow = 0
        outflow = 0

        for tx in transactions:
            amount_usd = tx.get("amount_usd", 0)
            from_owner = (tx.get("from", {}).get("owner", "") or "").lower()
            to_owner = (tx.get("to", {}).get("owner", "") or "").lower()

            # Check if sending TO an exchange
            is_to_exchange = any(kw in to_owner for kw in self.EXCHANGE_KEYWORDS)
            # Check if sending FROM an exchange
            is_from_exchange = any(kw in from_owner for kw in self.EXCHANGE_KEYWORDS)

            if is_to_exchange and not is_from_exchange:
                inflow += amount_usd
            elif is_from_exchange and not is_to_exchange:
                outflow += amount_usd

        return inflow, outflow


# Singleton
_whale_alert_source: Optional[WhaleAlertDataSource] = None


def get_whale_alert_source() -> WhaleAlertDataSource:
    """Get or create Whale Alert data source singleton."""
    global _whale_alert_source
    if _whale_alert_source is None:
        _whale_alert_source = WhaleAlertDataSource()
    return _whale_alert_source
