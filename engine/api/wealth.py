"""
Wealth Dashboard API routes.

Provides endpoints for portfolio management, holdings CRUD,
price fetching, asset search, and analytics.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from middleware.auth import get_current_user, AuthenticatedUser
from schemas import (
    # Portfolio
    PortfolioCreate,
    PortfolioUpdate,
    PortfolioResponse,
    PortfolioSummary,
    # Holdings
    HoldingCreate,
    HoldingUpdate,
    HoldingResponse,
    HoldingWithPrice,
    # Analytics
    AssetAllocation,
    GeographyAllocation,
    IncomeBreakdown,
    PortfolioAnalytics,
    AIInsights,
    # Assets & Prices
    AssetSearchResult,
    WealthPriceResponse,
    BatchPriceRequest,
    BatchPriceResponse,
    # Enums
    AssetClass,
)
from services.wealth import get_supabase_client, get_price_service

router = APIRouter(tags=["Wealth Dashboard"])


# =============================================================================
# PORTFOLIO ENDPOINTS
# =============================================================================


@router.post("/portfolios", response_model=PortfolioResponse)
async def create_portfolio(
    portfolio: PortfolioCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Create a new portfolio for the authenticated user."""
    try:
        client = get_supabase_client()
        result = await client.create_portfolio(
            user_id=user.id,
            name=portfolio.name,
            description=portfolio.description,
            is_default=portfolio.is_default,
        )
        return PortfolioResponse(**result)
    except Exception as e:
        logger.error(f"Error creating portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portfolios", response_model=list[PortfolioResponse])
async def list_portfolios(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List all portfolios for the authenticated user."""
    try:
        client = get_supabase_client()
        portfolios = await client.get_portfolios(user_id=user.id)
        return [PortfolioResponse(**p) for p in portfolios]
    except Exception as e:
        logger.error(f"Error listing portfolios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portfolios/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(
    portfolio_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get a specific portfolio by ID."""
    try:
        client = get_supabase_client()
        portfolio = await client.get_portfolio(
            portfolio_id=portfolio_id,
            user_id=user.id,
        )
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        return PortfolioResponse(**portfolio)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/portfolios/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: str,
    updates: PortfolioUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Update a portfolio."""
    try:
        client = get_supabase_client()
        result = await client.update_portfolio(
            portfolio_id=portfolio_id,
            user_id=user.id,
            name=updates.name,
            description=updates.description,
            is_default=updates.is_default,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        return PortfolioResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/portfolios/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Delete a portfolio and all its holdings."""
    try:
        client = get_supabase_client()
        deleted = await client.delete_portfolio(
            portfolio_id=portfolio_id,
            user_id=user.id,
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        return {"status": "deleted", "portfolio_id": portfolio_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portfolios/{portfolio_id}/summary", response_model=PortfolioSummary)
async def get_portfolio_summary(
    portfolio_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get portfolio summary with total values and performance."""
    try:
        client = get_supabase_client()
        price_service = get_price_service()

        # Verify portfolio ownership
        portfolio = await client.get_portfolio(
            portfolio_id=portfolio_id,
            user_id=user.id,
        )
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        # Get holdings
        holdings = await client.get_holdings(
            user_id=user.id,
            portfolio_id=portfolio_id,
        )

        if not holdings:
            return PortfolioSummary(
                portfolio_id=portfolio_id,
                portfolio_name=portfolio["name"],
                total_value_usd=0.0,
                total_cost_basis_usd=0.0,
                total_gain_loss_usd=0.0,
                total_gain_loss_pct=0.0,
                change_24h_usd=0.0,
                change_24h_pct=0.0,
                holdings_count=0,
                last_updated=datetime.utcnow(),
            )

        # Fetch all prices concurrently
        assets_to_fetch = [
            {"asset_class": h["asset_class"], "ticker": h["ticker"]}
            for h in holdings
        ]
        prices_dict, _ = await price_service.get_batch_prices(
            assets=assets_to_fetch,
            supabase_client=client,
        )

        # Calculate summary
        total_value = 0.0
        total_cost_basis = 0.0
        total_prev_value = 0.0  # For 24h change calculation

        for holding in holdings:
            asset_class = holding["asset_class"]
            ticker = holding["ticker"]
            quantity = float(holding.get("quantity", 0))
            key = f"{asset_class}:{ticker}"

            # Get price (use manual_price as fallback)
            price_data = prices_dict.get(key)
            if price_data:
                current_price = price_data.get("price_usd", 0)
                change_24h_pct = price_data.get("change_24h_pct", 0) or 0
            else:
                current_price = float(holding.get("manual_price") or 0)
                change_24h_pct = 0

            # Calculate values
            current_value = current_price * quantity
            total_value += current_value

            # Calculate previous value (24h ago)
            if change_24h_pct != 0:
                prev_price = current_price / (1 + change_24h_pct / 100)
                total_prev_value += prev_price * quantity
            else:
                total_prev_value += current_value

            # Cost basis
            cost_basis = holding.get("cost_basis")
            if cost_basis:
                total_cost_basis += float(cost_basis) * quantity

        # Calculate totals
        total_gain_loss = total_value - total_cost_basis
        total_gain_loss_pct = (
            (total_gain_loss / total_cost_basis * 100)
            if total_cost_basis > 0
            else 0
        )
        change_24h_usd = total_value - total_prev_value
        change_24h_pct = (
            (change_24h_usd / total_prev_value * 100)
            if total_prev_value > 0
            else 0
        )

        return PortfolioSummary(
            portfolio_id=portfolio_id,
            portfolio_name=portfolio["name"],
            total_value_usd=total_value,
            total_cost_basis_usd=total_cost_basis,
            total_gain_loss_usd=total_gain_loss,
            total_gain_loss_pct=total_gain_loss_pct,
            change_24h_usd=change_24h_usd,
            change_24h_pct=change_24h_pct,
            holdings_count=len(holdings),
            last_updated=datetime.utcnow(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting portfolio summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# HOLDINGS ENDPOINTS
# =============================================================================


@router.post("/holdings", response_model=HoldingResponse)
async def create_holding(
    holding: HoldingCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Add a new holding to a portfolio."""
    try:
        client = get_supabase_client()

        # Verify portfolio ownership
        portfolio = await client.get_portfolio(
            portfolio_id=holding.portfolio_id,
            user_id=user.id,
        )
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        result = await client.create_holding(
            user_id=user.id,
            portfolio_id=holding.portfolio_id,
            asset_class=holding.asset_class.value,
            ticker=holding.ticker,
            name=holding.name,
            quantity=holding.quantity,
            cost_basis=holding.cost_basis,
            purchase_date=holding.purchase_date.isoformat() if holding.purchase_date else None,
            manual_price=holding.manual_price,
            annual_yield_pct=holding.annual_yield_pct,
            dividend_frequency=holding.dividend_frequency.value if holding.dividend_frequency else None,
            country_code=holding.country_code,
            notes=holding.notes,
            tags=holding.tags,
        )
        return HoldingResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating holding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/holdings", response_model=list[HoldingResponse])
async def list_holdings(
    portfolio_id: Optional[str] = Query(None, description="Filter by portfolio"),
    asset_class: Optional[AssetClass] = Query(None, description="Filter by asset class"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List holdings for the authenticated user."""
    try:
        client = get_supabase_client()
        holdings = await client.get_holdings(
            user_id=user.id,
            portfolio_id=portfolio_id,
            asset_class=asset_class.value if asset_class else None,
        )
        return [HoldingResponse(**h) for h in holdings]
    except Exception as e:
        logger.error(f"Error listing holdings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/holdings/{holding_id}", response_model=HoldingResponse)
async def get_holding(
    holding_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get a specific holding by ID."""
    try:
        client = get_supabase_client()
        holding = await client.get_holding(
            holding_id=holding_id,
            user_id=user.id,
        )
        if not holding:
            raise HTTPException(status_code=404, detail="Holding not found")
        return HoldingResponse(**holding)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting holding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/holdings/{holding_id}", response_model=HoldingResponse)
async def update_holding(
    holding_id: str,
    updates: HoldingUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Update a holding."""
    try:
        client = get_supabase_client()
        result = await client.update_holding(
            holding_id=holding_id,
            user_id=user.id,
            quantity=updates.quantity,
            cost_basis=updates.cost_basis,
            purchase_date=updates.purchase_date.isoformat() if updates.purchase_date else None,
            manual_price=updates.manual_price,
            annual_yield_pct=updates.annual_yield_pct,
            dividend_frequency=updates.dividend_frequency.value if updates.dividend_frequency else None,
            country_code=updates.country_code,
            notes=updates.notes,
            tags=updates.tags,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Holding not found")
        return HoldingResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating holding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/holdings/{holding_id}")
async def delete_holding(
    holding_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Delete a holding."""
    try:
        client = get_supabase_client()
        deleted = await client.delete_holding(
            holding_id=holding_id,
            user_id=user.id,
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="Holding not found")
        return {"status": "deleted", "holding_id": holding_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting holding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PRICE ENDPOINTS (Placeholder - Full implementation in Phase 3)
# =============================================================================


@router.get("/prices/{asset_class}/{ticker}", response_model=WealthPriceResponse)
async def get_price(
    asset_class: AssetClass,
    ticker: str,
    refresh: bool = Query(False, description="Force refresh from provider"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Get current price for an asset.

    Prices are cached and fetched from various providers:
    - crypto: CoinGecko (free, ~30 req/min)
    - stock/etf: yfinance (free, ~2000 req/day)
    - commodity: GoldAPI.io (free 100/month)
    - cash: Fixed at 1 USD
    - real_estate/bond: Manual prices only
    """
    try:
        client = get_supabase_client()
        price_service = get_price_service()

        # Fetch price (uses cache unless refresh=True)
        price_data = await price_service.get_price(
            asset_class=asset_class.value,
            ticker=ticker.upper(),
            supabase_client=client,
            force_refresh=refresh,
        )

        if not price_data:
            # For manual assets, check if there's a manual price in holdings
            if asset_class in (AssetClass.REAL_ESTATE, AssetClass.BOND):
                raise HTTPException(
                    status_code=404,
                    detail=f"No price available for {asset_class.value}:{ticker}. "
                    "This asset type requires manual price input."
                )
            raise HTTPException(
                status_code=404,
                detail=f"Price not found for {asset_class.value}:{ticker}"
            )

        return WealthPriceResponse(
            asset_class=asset_class,
            ticker=ticker.upper(),
            price_usd=price_data["price_usd"],
            change_24h_pct=price_data.get("change_24h_pct"),
            market_cap=price_data.get("market_cap"),
            volume_24h=price_data.get("volume_24h"),
            source=price_data.get("source", "unknown"),
            fetched_at=datetime.fromisoformat(price_data["fetched_at"])
            if isinstance(price_data.get("fetched_at"), str)
            else price_data.get("fetched_at", datetime.utcnow()),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting price: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prices/batch", response_model=BatchPriceResponse)
async def get_batch_prices(
    request: BatchPriceRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Fetch prices for multiple assets in a single request.

    More efficient than individual calls for portfolio valuation.
    Fetches all prices concurrently.
    """
    client = get_supabase_client()
    price_service = get_price_service()

    prices_dict, errors_dict = await price_service.get_batch_prices(
        assets=request.assets,
        supabase_client=client,
    )

    # Convert to WealthPriceResponse objects
    prices = {}
    for key, price_data in prices_dict.items():
        asset_class, ticker = key.split(":", 1)
        prices[key] = WealthPriceResponse(
            asset_class=AssetClass(asset_class),
            ticker=ticker,
            price_usd=price_data["price_usd"],
            change_24h_pct=price_data.get("change_24h_pct"),
            market_cap=price_data.get("market_cap"),
            volume_24h=price_data.get("volume_24h"),
            source=price_data.get("source", "unknown"),
            fetched_at=datetime.fromisoformat(price_data["fetched_at"])
            if isinstance(price_data.get("fetched_at"), str)
            else price_data.get("fetched_at", datetime.utcnow()),
        )

    return BatchPriceResponse(prices=prices, errors=errors_dict)


# =============================================================================
# ASSET SEARCH ENDPOINTS
# =============================================================================


@router.get("/assets/search", response_model=list[AssetSearchResult])
async def search_assets(
    q: str = Query(..., min_length=1, description="Search query"),
    asset_class: Optional[AssetClass] = Query(None, description="Filter by asset class"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Search for assets by ticker or name.

    Returns matching assets for autocomplete in the holdings form.
    """
    try:
        client = get_supabase_client()
        results = await client.search_assets(
            query=q,
            asset_class=asset_class.value if asset_class else None,
            limit=limit,
        )
        return [AssetSearchResult(**r) for r in results]
    except Exception as e:
        logger.error(f"Error searching assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assets/{asset_class}", response_model=list[AssetSearchResult])
async def list_assets_by_class(
    asset_class: AssetClass,
    limit: int = Query(100, ge=1, le=500, description="Max results"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    List all assets for an asset class.

    Useful for browsing available assets.
    """
    try:
        client = get_supabase_client()
        results = await client.get_assets_by_class(
            asset_class=asset_class.value,
            limit=limit,
        )
        return [AssetSearchResult(**r) for r in results]
    except Exception as e:
        logger.error(f"Error listing assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ANALYTICS ENDPOINTS (Placeholder - Full implementation in Phase 5)
# =============================================================================


@router.get("/analytics/summary")
async def get_analytics_summary(
    portfolio_id: Optional[str] = Query(None, description="Portfolio ID (all if not specified)"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Get complete portfolio analytics including allocations and income.

    Returns summary, asset allocation, geographic allocation, and income breakdown.
    """
    # Placeholder - will be fully implemented in Phase 5
    return {
        "message": "Analytics endpoint - full implementation coming in Phase 5",
        "portfolio_id": portfolio_id,
        "user_id": user.id,
    }


@router.post("/analytics/ai-narrative", response_model=AIInsights)
async def generate_ai_insights(
    portfolio_id: Optional[str] = Query(None, description="Portfolio ID (all if not specified)"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Generate AI-powered insights for the portfolio.

    Uses Claude to analyze the portfolio and provide:
    - Summary narrative
    - Highlights
    - Concerns
    - Opportunities
    """
    # Placeholder - will be fully implemented in Phase 6
    return AIInsights(
        summary="AI insights coming in Phase 6",
        highlights=["Portfolio analysis will be available soon"],
        concerns=[],
        opportunities=[],
        generated_at=datetime.utcnow(),
    )
