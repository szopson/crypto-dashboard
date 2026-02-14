"""
Supabase Client for Wealth Dashboard backend operations.

Handles all database operations for portfolios, holdings, and price cache.
"""
from datetime import datetime
from typing import Optional
from decimal import Decimal
from loguru import logger

from config import settings

# Supabase import with fallback for when not configured
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None


class SupabaseClient:
    """
    Supabase client wrapper for wealth dashboard operations.

    Uses service role key for backend operations (bypasses RLS for admin tasks).
    For user-specific operations, we filter by user_id explicitly.
    """

    def __init__(self):
        self._client: Optional[Client] = None
        self._initialized = False

    def _ensure_client(self) -> Client:
        """Lazily initialize Supabase client."""
        if self._client is None:
            if not SUPABASE_AVAILABLE:
                raise RuntimeError("Supabase library not installed. Run: pip install supabase")

            if not settings.supabase_url or not settings.supabase_service_role_key:
                raise RuntimeError(
                    "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
                )

            self._client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key
            )
            self._initialized = True
            logger.info("Supabase client initialized")

        return self._client

    @property
    def client(self) -> Client:
        """Get the Supabase client instance."""
        return self._ensure_client()

    def is_configured(self) -> bool:
        """Check if Supabase is properly configured."""
        return bool(
            SUPABASE_AVAILABLE
            and settings.supabase_url
            and settings.supabase_service_role_key
        )

    # =========================================================================
    # PORTFOLIO OPERATIONS
    # =========================================================================

    async def create_portfolio(
        self,
        user_id: str,
        name: str,
        description: Optional[str] = None,
        is_default: bool = False,
    ) -> dict:
        """Create a new portfolio for a user."""
        data = {
            "user_id": user_id,
            "name": name,
            "description": description,
            "is_default": is_default,
        }

        result = self.client.table("portfolios").insert(data).execute()

        if result.data:
            logger.info(f"Created portfolio '{name}' for user {user_id}")
            return result.data[0]

        raise RuntimeError("Failed to create portfolio")

    async def get_portfolios(self, user_id: str) -> list[dict]:
        """Get all portfolios for a user."""
        result = (
            self.client.table("portfolios")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return result.data or []

    async def get_portfolio(self, portfolio_id: str, user_id: str) -> Optional[dict]:
        """Get a specific portfolio (with user ownership check)."""
        result = (
            self.client.table("portfolios")
            .select("*")
            .eq("id", portfolio_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return result.data

    async def update_portfolio(
        self,
        portfolio_id: str,
        user_id: str,
        **updates,
    ) -> Optional[dict]:
        """Update a portfolio."""
        # Filter out None values
        data = {k: v for k, v in updates.items() if v is not None}
        data["updated_at"] = datetime.utcnow().isoformat()

        result = (
            self.client.table("portfolios")
            .update(data)
            .eq("id", portfolio_id)
            .eq("user_id", user_id)
            .execute()
        )

        if result.data:
            return result.data[0]
        return None

    async def delete_portfolio(self, portfolio_id: str, user_id: str) -> bool:
        """Delete a portfolio (cascades to holdings)."""
        result = (
            self.client.table("portfolios")
            .delete()
            .eq("id", portfolio_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(result.data) > 0

    # =========================================================================
    # HOLDING OPERATIONS
    # =========================================================================

    async def create_holding(
        self,
        user_id: str,
        portfolio_id: str,
        asset_class: str,
        ticker: str,
        name: str,
        quantity: Decimal,
        cost_basis: Optional[Decimal] = None,
        purchase_date: Optional[str] = None,
        manual_price: Optional[Decimal] = None,
        annual_yield_pct: Optional[Decimal] = None,
        dividend_frequency: Optional[str] = None,
        country_code: str = "US",
        notes: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        """Create a new holding."""
        data = {
            "user_id": user_id,
            "portfolio_id": portfolio_id,
            "asset_class": asset_class,
            "ticker": ticker.upper(),
            "name": name,
            "quantity": float(quantity),
            "cost_basis": float(cost_basis) if cost_basis else None,
            "purchase_date": purchase_date,
            "manual_price": float(manual_price) if manual_price else None,
            "manual_price_updated_at": datetime.utcnow().isoformat() if manual_price else None,
            "annual_yield_pct": float(annual_yield_pct) if annual_yield_pct else None,
            "dividend_frequency": dividend_frequency,
            "country_code": country_code.upper(),
            "notes": notes,
            "tags": tags,
        }

        result = self.client.table("holdings").insert(data).execute()

        if result.data:
            logger.info(f"Created holding {ticker} for user {user_id}")
            return result.data[0]

        raise RuntimeError("Failed to create holding")

    async def get_holdings(
        self,
        user_id: str,
        portfolio_id: Optional[str] = None,
        asset_class: Optional[str] = None,
    ) -> list[dict]:
        """Get holdings for a user, optionally filtered by portfolio or asset class."""
        query = (
            self.client.table("holdings")
            .select("*")
            .eq("user_id", user_id)
        )

        if portfolio_id:
            query = query.eq("portfolio_id", portfolio_id)

        if asset_class:
            query = query.eq("asset_class", asset_class)

        result = query.order("created_at").execute()
        return result.data or []

    async def get_holding(self, holding_id: str, user_id: str) -> Optional[dict]:
        """Get a specific holding."""
        result = (
            self.client.table("holdings")
            .select("*")
            .eq("id", holding_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return result.data

    async def update_holding(
        self,
        holding_id: str,
        user_id: str,
        **updates,
    ) -> Optional[dict]:
        """Update a holding."""
        # Filter out None values
        data = {k: v for k, v in updates.items() if v is not None}

        # Convert Decimal to float
        for key in ["quantity", "cost_basis", "manual_price", "annual_yield_pct"]:
            if key in data and isinstance(data[key], Decimal):
                data[key] = float(data[key])

        # Update timestamp if manual_price changed
        if "manual_price" in data:
            data["manual_price_updated_at"] = datetime.utcnow().isoformat()

        data["updated_at"] = datetime.utcnow().isoformat()

        result = (
            self.client.table("holdings")
            .update(data)
            .eq("id", holding_id)
            .eq("user_id", user_id)
            .execute()
        )

        if result.data:
            return result.data[0]
        return None

    async def delete_holding(self, holding_id: str, user_id: str) -> bool:
        """Delete a holding."""
        result = (
            self.client.table("holdings")
            .delete()
            .eq("id", holding_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(result.data) > 0

    # =========================================================================
    # PRICE CACHE OPERATIONS
    # =========================================================================

    async def get_cached_price(
        self,
        asset_class: str,
        ticker: str,
    ) -> Optional[dict]:
        """Get cached price for an asset."""
        result = (
            self.client.table("price_cache")
            .select("*")
            .eq("asset_class", asset_class)
            .eq("ticker", ticker.upper())
            .single()
            .execute()
        )
        return result.data

    async def upsert_price_cache(
        self,
        asset_class: str,
        ticker: str,
        price_usd: float,
        change_24h_pct: Optional[float] = None,
        market_cap: Optional[float] = None,
        volume_24h: Optional[float] = None,
        source: str = "unknown",
    ) -> dict:
        """Insert or update price in cache."""
        data = {
            "asset_class": asset_class,
            "ticker": ticker.upper(),
            "price_usd": price_usd,
            "change_24h_pct": change_24h_pct,
            "market_cap": market_cap,
            "volume_24h": volume_24h,
            "source": source,
            "fetched_at": datetime.utcnow().isoformat(),
        }

        result = (
            self.client.table("price_cache")
            .upsert(data, on_conflict="asset_class,ticker")
            .execute()
        )

        if result.data:
            return result.data[0]
        return data

    # =========================================================================
    # ASSET LIST OPERATIONS
    # =========================================================================

    async def search_assets(
        self,
        query: str,
        asset_class: Optional[str] = None,
        limit: int = 20,
    ) -> list[dict]:
        """Search assets by ticker or name."""
        q = (
            self.client.table("asset_lists")
            .select("*")
            .eq("is_active", True)
        )

        if asset_class:
            q = q.eq("asset_class", asset_class)

        # Search by ticker (exact prefix) or name (contains)
        # Using OR filter
        q = q.or_(f"ticker.ilike.{query}%,name.ilike.%{query}%")

        result = (
            q.order("market_cap_rank", desc=False, nullsfirst=False)
            .limit(limit)
            .execute()
        )

        return result.data or []

    async def get_assets_by_class(
        self,
        asset_class: str,
        limit: int = 100,
    ) -> list[dict]:
        """Get all assets for an asset class, ordered by market cap rank."""
        result = (
            self.client.table("asset_lists")
            .select("*")
            .eq("asset_class", asset_class)
            .eq("is_active", True)
            .order("market_cap_rank", desc=False, nullsfirst=False)
            .limit(limit)
            .execute()
        )
        return result.data or []

    async def upsert_asset(
        self,
        asset_class: str,
        ticker: str,
        name: str,
        **extra_fields,
    ) -> dict:
        """Insert or update an asset in the asset list."""
        data = {
            "asset_class": asset_class,
            "ticker": ticker.upper(),
            "name": name,
            "updated_at": datetime.utcnow().isoformat(),
            **extra_fields,
        }

        result = (
            self.client.table("asset_lists")
            .upsert(data, on_conflict="asset_class,ticker")
            .execute()
        )

        if result.data:
            return result.data[0]
        return data


# Singleton
_supabase_client: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """Get or create Supabase client singleton."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client
