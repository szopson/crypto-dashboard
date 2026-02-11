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

    # Token address mappings for top 100+ tokens by market cap
    # Format: ticker -> (contract_address, chain)
    # Addresses are checksummed where applicable
    TOKEN_ADDRESSES: Dict[str, tuple] = {
        # === Stablecoins ===
        "USDT": ("0xdAC17F958D2ee523a2206206994597C13D831ec7", "ethereum"),
        "USDC": ("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "ethereum"),
        "DAI": ("0x6B175474E89094C44Da98b954EescdecG1cE7D64", "ethereum"),
        "FRAX": ("0x853d955aCEf822Db058eb8505911ED77F175b99e", "ethereum"),
        "TUSD": ("0x0000000000085d4780B73119b644AE5ecd22b376", "ethereum"),
        "USDD": ("0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c6", "ethereum"),
        "GUSD": ("0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd", "ethereum"),
        "LUSD": ("0x5f98805A4E8be255a32880FDeC7F6728C6568bA0", "ethereum"),
        "PYUSD": ("0x6c3ea9036406852006290770BEdFcAbA0e23A0e8", "ethereum"),
        "CRVUSD": ("0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", "ethereum"),
        "GHO": ("0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f", "ethereum"),

        # === DeFi Blue Chips ===
        "AAVE": ("0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", "ethereum"),
        "UNI": ("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "ethereum"),
        "LINK": ("0x514910771AF9Ca656af840dff83E8264EcF986CA", "ethereum"),
        "MKR": ("0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", "ethereum"),
        "LDO": ("0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", "ethereum"),
        "CRV": ("0xD533a949740bb3306d119CC777fa900bA034cd52", "ethereum"),
        "COMP": ("0xc00e94Cb662C3520282E6f5717214004A7f26888", "ethereum"),
        "SNX": ("0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F", "ethereum"),
        "SUSHI": ("0x6B3595068778DD592e39A122f4f5a5cF09C90fE2", "ethereum"),
        "YFI": ("0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e", "ethereum"),
        "1INCH": ("0x111111111117dC0aa78b770fA6A738034120C302", "ethereum"),
        "BAL": ("0xba100000625a3754423978a60c9317c58a424e3D", "ethereum"),
        "DYDX": ("0x92D6C1e31e14520e676a687F0a93788B716BEff5", "ethereum"),
        "RPL": ("0xD33526068D116cE69F19A9ee46F0bd304F21A51f", "ethereum"),
        "FXS": ("0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0", "ethereum"),
        "CVX": ("0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B", "ethereum"),
        "SPELL": ("0x090185f2135308BaD17527004364eBcC2D37e5F6", "ethereum"),
        "ALCX": ("0xdBdb4d16EdA451D0503b854CF79D55697F90c8DF", "ethereum"),
        "LQTY": ("0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D", "ethereum"),
        "MIM": ("0x99D8a9C45b2ecA8864373A26D1459e3Dff1e17F3", "ethereum"),
        "RBN": ("0x6123B0049F904d730dB3C36a31167D9d4121fA6B", "ethereum"),
        "TRIBE": ("0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B", "ethereum"),
        "INST": ("0x6f40d4A6237C257fff2dB00FA0510DeEECd303eb", "ethereum"),

        # === Layer 2 & Scaling ===
        "MATIC": ("0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", "ethereum"),
        "ARB": ("0x912CE59144191C1204E64559FE8253a0e49E6548", "arbitrum"),
        "OP": ("0x4200000000000000000000000000000000000042", "optimism"),
        "IMX": ("0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF", "ethereum"),
        "LRC": ("0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD", "ethereum"),
        "STRK": ("0xCa14007Eff0dB1f8135f4C25B34De49AB0d42766", "ethereum"),
        "ZK": ("0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E", "ethereum"),
        "METIS": ("0x9E32b13ce7f2E80A01932B42553652E053D6ed8e", "ethereum"),
        "MANTA": ("0x95CeF13441Be50d20cA4558CC0a27B601aC544E5", "ethereum"),
        "BLAST": ("0x3ed643e9032230f01c6c36060e305ab53ad3b482", "ethereum"),

        # === Gaming & Metaverse ===
        "APE": ("0x4d224452801ACEd8B2F0aebE155379bb5D594381", "ethereum"),
        "SAND": ("0x3845badAde8e6dFF049820680d1F14bD3903a5d0", "ethereum"),
        "MANA": ("0x0F5D2fB29fb7d3CFeE444a200298f468908cC942", "ethereum"),
        "AXS": ("0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b", "ethereum"),
        "GALA": ("0xd1d2Eb1B1e90B638588728b4130137D262C87cae", "ethereum"),
        "ENJ": ("0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c", "ethereum"),
        "ILV": ("0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E", "ethereum"),
        "MAGIC": ("0xB0c7a3Ba49C7a6EaBa6cD4a96C55a1391070Ac9A", "arbitrum"),
        "IMX": ("0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF", "ethereum"),
        "GODS": ("0xccC8cb5229B0ac8069C51fd58367Fd1e622aFD97", "ethereum"),
        "PYR": ("0x430EF9263E76DAE63c84292C3409D61c598E9682", "ethereum"),
        "PRIME": ("0xb23d80f5FefcDDaa212212F028021B41DEd428CF", "ethereum"),

        # === AI & Data ===
        "RNDR": ("0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24", "ethereum"),
        "FET": ("0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85", "ethereum"),
        "AGIX": ("0x5B7533812759B45C2B44C19e320ba2cD2681b542", "ethereum"),
        "OCEAN": ("0x967da4048cD07aB37855c090aAF366e4ce1b9F48", "ethereum"),
        "GRT": ("0xc944E90C64B2c07662A292be6244BDf05Cda44a7", "ethereum"),
        "ARKM": ("0x6E2a43be0B1d33b726f0CA3b8de60b3482b8b050", "ethereum"),
        "WLD": ("0x163f8C2467924be0ae7B5347228CABF260318753", "ethereum"),
        "TAO": ("0x77E06c9eCCf2E797fd462A92B6D7642EF85b0A44", "ethereum"),

        # === Infrastructure & Oracles ===
        "PYTH": ("0xefC1ba1ed25d99406EB1ab3f4aF4b5E0EC7E3146", "ethereum"),
        "API3": ("0x0b38210ea11411557c13457D4dA7dC6ea731B88a", "ethereum"),
        "BAND": ("0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55", "ethereum"),
        "TRB": ("0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0", "ethereum"),
        "UMA": ("0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828", "ethereum"),

        # === Liquid Staking ===
        "STETH": ("0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", "ethereum"),
        "RETH": ("0xae78736Cd615f374D3085123A210448E74Fc6393", "ethereum"),
        "CBETH": ("0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", "ethereum"),
        "WSTETH": ("0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", "ethereum"),
        "SFRXETH": ("0xac3E018457B222d93114458476f3E3416Abbe38F", "ethereum"),
        "ANKR": ("0x8290333ceF9e6D528dD5618Fb97a76f268f3EDD4", "ethereum"),
        "SD": ("0x30D20208d987713f46DFD34EF128Bb16C404D10f", "ethereum"),

        # === Memecoins (for completeness) ===
        "SHIB": ("0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", "ethereum"),
        "PEPE": ("0x6982508145454Ce325dDbE47a25d4ec3d2311933", "ethereum"),
        "FLOKI": ("0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E", "ethereum"),
        "BONE": ("0x9813037ee2218799597d83D4a5B6F3b6778218d9", "ethereum"),
        "LEASH": ("0x27C70Cd1946795B66be9d954418546998b546634", "ethereum"),

        # === Exchange Tokens ===
        "BNB": ("0xB8c77482e45F1F44dE1745F52C74426C631bDD52", "ethereum"),
        "LEO": ("0x2AF5D2aD76741191D15Dfe7bF6aC92d4Bd912Ca3", "ethereum"),
        "CRO": ("0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b", "ethereum"),
        "OKB": ("0x75231F58b43240C9718Dd58B4967c5114342a86c", "ethereum"),
        "HT": ("0x6f259637dcD74C767781E37Bc6133cd6A68aa161", "ethereum"),
        "KCS": ("0xf34960d9d60be18cC1D5Afc1A6F012A723a28811", "ethereum"),
        "GT": ("0xE66747a101bFF2dBA3697199DCcE5b743b454759", "ethereum"),
        "MX": ("0x11eeF04c884E24d9B7B4760e7476D06ddF797f36", "ethereum"),

        # === Governance & DAOs ===
        "ENS": ("0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72", "ethereum"),
        "SAFE": ("0x5aFE3855358E112B5647B952709E6165e1c1eEEe", "ethereum"),
        "GNO": ("0x6810e776880C02933D47DB1b9fc05908e5386b96", "ethereum"),
        "COW": ("0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB", "ethereum"),
        "BIT": ("0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5", "ethereum"),

        # === Perpetuals & Derivatives ===
        "GMX": ("0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", "arbitrum"),
        "PENDLE": ("0x808507121B80c02388fAd14726482e061B8da827", "ethereum"),
        "VELO": ("0x3c8B650257cFb5f272f799F5e2b4e65093a11a05", "optimism"),
        "SNX": ("0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F", "ethereum"),
        "PERP": ("0xbC396689893D065F41bc2C6EcbeE5e0085233447", "ethereum"),
        "KWENTA": ("0x920Cf626a271321C151D027030D5d08aF699456b", "optimism"),

        # === NFT & Marketplaces ===
        "BLUR": ("0x5283D291DBCF85356A21bA090E6db59121208b44", "ethereum"),
        "LOOKS": ("0xf4d2888d29D722226FafA5d9B24F9164c092421E", "ethereum"),
        "X2Y2": ("0x1E4EDE388cbc9F4b5c79681B7f94d36a11ABEBC9", "ethereum"),
        "RARE": ("0xba5BDe662c17e2aDFF1075610382B9B691296350", "ethereum"),

        # === RWA & Institutional ===
        "ONDO": ("0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3", "ethereum"),
        "MPL": ("0x33349B282065b0284d756F0577FB39c158F935e6", "ethereum"),
        "CFG": ("0xc221b7E65FfC80DE234bbB6667aBDd46593D34F0", "ethereum"),
        "TRU": ("0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784", "ethereum"),

        # === Privacy ===
        "TORN": ("0x77777FeDdddFfC19Ff86DB637967013e6C6A116C", "ethereum"),

        # === Bridges ===
        "STG": ("0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6", "ethereum"),
        "SYNAPSE": ("0x0f2D719407FdBeFF09D87557AbB7232601FD9F29", "ethereum"),
        "HOP": ("0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC", "ethereum"),
        "CELR": ("0x4F9254C83EB525f9FCf346490bbb3ed28a81C667", "ethereum"),

        # === Wrapped Assets ===
        "WETH": ("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "ethereum"),
        "WBTC": ("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", "ethereum"),
        "RENBTC": ("0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D", "ethereum"),

        # === Storage & Computing ===
        "FIL": ("0x6e1A19F235bE7ED8E3369eF73b196C07257494DE", "ethereum"),
        "AR": ("0x4fadc7a98f2dc96510e42dd1a74141eeae0c1543", "ethereum"),
        "STORJ": ("0xB64ef51C888972c908CFacf59B47C1AfBC0Ab8aC", "ethereum"),
        "LPT": ("0x58b6A8A3302369DAEc383334672404Ee733aB239", "ethereum"),

        # === BSC Tokens ===
        "CAKE": ("0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", "bnb"),
        "XVS": ("0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", "bnb"),
        "ALPACA": ("0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F", "bnb"),
        "BAKE": ("0xE02dF9e3e622DeBdD69fb838bB799E3F168902c5", "bnb"),
        "BURGER": ("0xAe9269f27437f0fcBC232d39Ec814844a51d6b8f", "bnb"),
        "AUTO": ("0xa184088a740c695E156F91f5cC086a06bb78b827", "bnb"),

        # === Polygon Tokens ===
        "QUICK": ("0xB5C064F955D8e7F38fE0460C556a72987494eE17", "polygon"),
        "GHST": ("0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7", "polygon"),

        # === Arbitrum Tokens ===
        "RDNT": ("0x3082CC23568eA640225c2467653dB90e9250AaA0", "arbitrum"),
        "GRAIL": ("0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8", "arbitrum"),
        "JONES": ("0x10393c20975cF177a3513071bC110f7962CD67da", "arbitrum"),
        "DPX": ("0x6C2C06790b3E3E3c38e12Ee22F8183b37a13EE55", "arbitrum"),
        "SILO": ("0x0341C0C0ec423328621788d4854119B97f44E391", "arbitrum"),
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
