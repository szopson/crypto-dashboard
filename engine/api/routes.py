"""
FastAPI routes for Trading Command Center API.
"""
import csv
import io
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from config import settings, TIMEFRAME_MAP, TIMEFRAME_MAP_REVERSE
from database import get_session
from sqlalchemy import select, desc
from schemas import (
    HealthResponse, PriceResponse, RadarResponse,
    RadarCurrentResponse, BiasCurrentResponse, BiasTimeframe,
    StructureResponse, StructureCurrentResponse, SecondarySwing, SwingPoint,
    ZonesResponse, ZonesCurrentResponse, Zone, NearbyZone,
    TradingViewWebhook, AlertResponse, AlertsListResponse,
    SniperResponse, ConfluenceResult, ConfluenceComponent, TradeSetupResponse,
    ChatRequest, ChatResponse, AnalysisResponse, BriefingResponse,
    TelegramMessageRequest, TelegramAlertRequest, TelegramResponse,
    TradeCreate, TradeUpdate, TradeResponse, TradeListResponse, TradeStatsResponse,
    TradeImportRequest, TradeImportItem, EquityCurveResponse, EquityPoint,
    PerformanceByTagResponse, SentimentResponse,
    AlertConfigCreate, AlertConfigUpdate, AlertConfigResponse, AlertConfigListResponse,
    ProjectAnalysisRequest, ProjectReportResponse,
)
from models import TradingViewAlert, Trade, TradeStats, AlertConfig
from data.exchange import get_exchange_client, ExchangeClient
from calculations.radar import calculate_full_radar
from calculations.structure import analyze_structure, get_lookback_for_timeframe
from calculations.zones import analyze_zones
from calculations.sniper import analyze_sniper
from services.llm import get_llm_service
from services.telegram import get_telegram_service
from services.alerts import get_alert_monitor
from services.scheduler import get_scheduler_service
from services.sentiment import get_sentiment_service
from services.backtest import get_backtest_service
from services.project_analysis import get_project_analysis_service
from services.pdf_report import generate_pdf_report


router = APIRouter()


# === Health Check ===
@router.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }


def get_exchange() -> ExchangeClient:
    """Dependency for exchange client."""
    return get_exchange_client()


@router.get("/symbols")
async def get_available_symbols():
    """
    Get list of available trading symbols.
    """
    return {
        "symbols": settings.available_symbols,
        "default": settings.default_symbol,
        "exchange": settings.exchange_id,
    }


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        exchange=settings.exchange_id,
        symbol=settings.default_symbol,
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/price", response_model=PriceResponse)
async def get_current_price(
    symbol: str = None,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """Get current price for a symbol."""
    try:
        price_data = exchange.get_current_price(symbol)
        return PriceResponse(**price_data)
    except Exception as e:
        logger.error(f"Error fetching price: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/radar/current", response_model=RadarCurrentResponse)
async def get_current_radar(
    symbol: str = None,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get current RADAR metrics for all radar timeframes (1D, 1W).
    """
    try:
        radars = {}

        for tf in settings.radar_timeframes:
            # Fetch OHLCV data
            ohlcv_data = exchange.fetch_ohlcv(symbol=symbol, timeframe=tf, limit=300)

            # Fetch funding rate
            funding_data = exchange.fetch_funding_rate(symbol)
            funding_rate = funding_data.get("funding_rate", 0)

            # Calculate RADAR
            radar_result = calculate_full_radar(ohlcv_data, funding_rate)

            # Convert to response format
            display_tf = exchange.get_display_timeframe(tf)
            radars[display_tf] = RadarResponse(
                score=radar_result.get("score", 3.0),
                raw_score=radar_result.get("raw_score"),
                classification=radar_result.get("classification", "NEUTRAL"),
                color=radar_result.get("color", "yellow"),
                components=radar_result.get("components", []),
                metrics=radar_result.get("metrics"),
                timestamp=radar_result.get("timestamp", datetime.utcnow().isoformat()),
                timeframe=display_tf,
            )

        return RadarCurrentResponse(
            timestamp=datetime.utcnow().isoformat(),
            radars=radars,
        )

    except Exception as e:
        logger.error(f"Error calculating RADAR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/radar/{timeframe}", response_model=RadarResponse)
async def get_radar_for_timeframe(
    timeframe: str,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get RADAR metrics for a specific timeframe.
    """
    # Map display timeframe to CCXT format
    tf_map = {"1D": "1d", "1W": "1w", "1M": "1M"}
    ccxt_tf = tf_map.get(timeframe.upper(), "1d")

    try:
        # Fetch data
        ohlcv_data = exchange.fetch_ohlcv(timeframe=ccxt_tf, limit=300)
        funding_data = exchange.fetch_funding_rate()
        funding_rate = funding_data.get("funding_rate", 0)

        # Calculate RADAR
        radar_result = calculate_full_radar(ohlcv_data, funding_rate)

        return RadarResponse(
            score=radar_result.get("score", 3.0),
            raw_score=radar_result.get("raw_score"),
            classification=radar_result.get("classification", "NEUTRAL"),
            color=radar_result.get("color", "yellow"),
            components=radar_result.get("components", []),
            metrics=radar_result.get("metrics"),
            timestamp=radar_result.get("timestamp", datetime.utcnow().isoformat()),
            timeframe=timeframe.upper(),
        )

    except Exception as e:
        logger.error(f"Error calculating RADAR for {timeframe}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/radar/recalculate")
async def recalculate_radar(
    exchange: ExchangeClient = Depends(get_exchange)
):
    """Force recalculation of RADAR metrics."""
    try:
        # Trigger recalculation
        radars = {}
        for tf in settings.radar_timeframes:
            ohlcv_data = exchange.fetch_ohlcv(timeframe=tf, limit=300)
            funding_data = exchange.fetch_funding_rate()
            radar_result = calculate_full_radar(ohlcv_data, funding_data.get("funding_rate", 0))

            display_tf = exchange.get_display_timeframe(tf)
            radars[display_tf] = {
                "score": radar_result.get("score"),
                "classification": radar_result.get("classification"),
            }

        return {
            "success": True,
            "message": "RADAR recalculated",
            "results": radars,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error recalculating RADAR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bias/current", response_model=BiasCurrentResponse)
async def get_current_bias(
    symbol: str = None,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get current structural bias for all timeframes.
    Uses real swing detection and secondary swing analysis.
    """
    try:
        # Get current price
        price_data = exchange.get_current_price(symbol)
        current_price = price_data.get("price", 0)

        # Get funding rate for RADAR calculations
        funding_data = exchange.fetch_funding_rate(symbol)
        funding_rate = funding_data.get("funding_rate", 0)

        biases = {}
        key_levels = []

        for tf in settings.timeframes:
            # Fetch OHLCV data
            ohlcv_data = exchange.fetch_ohlcv(symbol=symbol, timeframe=tf, limit=300)

            # Analyze structure
            structure_result = analyze_structure(ohlcv_data, tf, current_price)

            # Get RADAR score for macro timeframes
            radar_score = None
            display_tf = exchange.get_display_timeframe(tf)
            if tf in settings.radar_timeframes:
                radar_result = calculate_full_radar(ohlcv_data, funding_rate)
                radar_score = radar_result.get("score")

            # Map choppy to neutral for bias
            structural_bias = structure_result.get("bias", "NEUTRAL")
            if structural_bias == "CHOPPY":
                structural_bias = "NEUTRAL"

            ss = structure_result.get("secondary_swing", {})

            biases[display_tf] = BiasTimeframe(
                timeframe=display_tf,
                structural_bias=structural_bias,
                secondary_swing_level=ss.get("price"),
                ss_distance_pct=ss.get("distance_pct"),
                last_swing_high=structure_result.get("last_swing_high"),
                last_swing_low=structure_result.get("last_swing_low"),
                swing_structure=structure_result.get("structure"),
                radar_score=radar_score,
                confidence="HIGH" if structure_result.get("structure") in ["HH_HL", "LH_LL"] else "MEDIUM",
            )

            # Add key levels from secondary swings
            if ss.get("price"):
                key_levels.append({
                    "price": ss.get("price"),
                    "type": f"SS_{ss.get('type', 'UNKNOWN')}",
                    "timeframe": display_tf,
                    "description": structure_result.get("reason", ""),
                })

        # Determine overall bias (weighted by timeframe)
        tf_weights = {"1H": 1, "4H": 2, "1D": 3, "3D": 3, "1W": 4, "1M": 4}
        bullish_weight = sum(
            tf_weights.get(tf, 1)
            for tf, b in biases.items()
            if b.structural_bias == "BULLISH"
        )
        bearish_weight = sum(
            tf_weights.get(tf, 1)
            for tf, b in biases.items()
            if b.structural_bias == "BEARISH"
        )

        if bullish_weight > bearish_weight * 1.2:
            overall_bias = "BULLISH"
        elif bearish_weight > bullish_weight * 1.2:
            overall_bias = "BEARISH"
        else:
            overall_bias = "NEUTRAL"

        return BiasCurrentResponse(
            timestamp=datetime.utcnow().isoformat(),
            current_price=current_price,
            biases=biases,
            overall_bias=overall_bias,
            key_levels=sorted(key_levels, key=lambda x: abs(x["price"] - current_price)),
        )

    except Exception as e:
        logger.error(f"Error getting bias: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/funding")
async def get_funding_rate(
    symbol: str = None,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """Get current funding rate."""
    try:
        funding_data = exchange.fetch_funding_rate(symbol)
        return funding_data
    except Exception as e:
        logger.error(f"Error fetching funding rate: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Sentiment Endpoints ===

@router.get("/sentiment", response_model=SentimentResponse)
async def get_market_sentiment(
    symbol: str = None,
):
    """
    Get comprehensive market sentiment data.

    Aggregates:
    - Fear & Greed Index (from alternative.me)
    - Funding rate
    - Long/Short ratio
    - Open Interest
    - Price change

    Returns overall sentiment score (-100 to +100) and classification.
    """
    try:
        sentiment_service = get_sentiment_service()
        sentiment_data = await sentiment_service.get_market_sentiment(symbol)
        return SentimentResponse(**sentiment_data)

    except Exception as e:
        logger.error(f"Error fetching sentiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/fear-greed")
async def get_fear_greed_index():
    """
    Get Fear & Greed Index only.
    """
    try:
        sentiment_service = get_sentiment_service()
        fg_data = await sentiment_service.fetch_fear_greed_index()
        return fg_data

    except Exception as e:
        logger.error(f"Error fetching Fear & Greed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Structure Endpoints ===

@router.get("/structure/{timeframe}", response_model=StructureResponse)
async def get_structure_for_timeframe(
    timeframe: str,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get structural analysis for a specific timeframe.
    Returns swing points, bias, and secondary swing level.
    """
    # Map display timeframe to CCXT format
    tf_upper = timeframe.upper()
    ccxt_tf = TIMEFRAME_MAP_REVERSE.get(tf_upper, timeframe.lower())

    try:
        # Get current price
        price_data = exchange.get_current_price()
        current_price = price_data.get("price", 0)

        # Fetch OHLCV data
        ohlcv_data = exchange.fetch_ohlcv(timeframe=ccxt_tf, limit=300)

        # Analyze structure
        structure_result = analyze_structure(ohlcv_data, ccxt_tf, current_price)

        # Convert swings to response format
        swings = [
            SwingPoint(
                type=s["type"],
                price=s["price"],
                label=s["label"],
                index=s["index"],
                timestamp=s.get("timestamp"),
            )
            for s in structure_result.get("swings", [])
        ]

        ss = structure_result.get("secondary_swing", {})

        return StructureResponse(
            timeframe=tf_upper,
            bias=structure_result.get("bias", "NEUTRAL"),
            structure=structure_result.get("structure", "UNKNOWN"),
            secondary_swing=SecondarySwing(
                price=ss.get("price"),
                type=ss.get("type"),
                distance_pct=ss.get("distance_pct"),
            ),
            last_swing_high=structure_result.get("last_swing_high"),
            last_swing_low=structure_result.get("last_swing_low"),
            reason=structure_result.get("reason", ""),
            swings=swings,
            current_price=current_price,
        )

    except Exception as e:
        logger.error(f"Error analyzing structure for {timeframe}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/structure/current", response_model=StructureCurrentResponse)
async def get_current_structure(
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get structural analysis for all timeframes.
    """
    try:
        # Get current price
        price_data = exchange.get_current_price()
        current_price = price_data.get("price", 0)

        structures = {}

        for tf in settings.timeframes:
            # Fetch OHLCV data
            ohlcv_data = exchange.fetch_ohlcv(timeframe=tf, limit=300)

            # Analyze structure
            structure_result = analyze_structure(ohlcv_data, tf, current_price)

            # Convert swings to response format
            swings = [
                SwingPoint(
                    type=s["type"],
                    price=s["price"],
                    label=s["label"],
                    index=s["index"],
                    timestamp=s.get("timestamp"),
                )
                for s in structure_result.get("swings", [])
            ]

            ss = structure_result.get("secondary_swing", {})
            display_tf = exchange.get_display_timeframe(tf)

            structures[display_tf] = StructureResponse(
                timeframe=display_tf,
                bias=structure_result.get("bias", "NEUTRAL"),
                structure=structure_result.get("structure", "UNKNOWN"),
                secondary_swing=SecondarySwing(
                    price=ss.get("price"),
                    type=ss.get("type"),
                    distance_pct=ss.get("distance_pct"),
                ),
                last_swing_high=structure_result.get("last_swing_high"),
                last_swing_low=structure_result.get("last_swing_low"),
                reason=structure_result.get("reason", ""),
                swings=swings,
                current_price=current_price,
            )

        return StructureCurrentResponse(
            timestamp=datetime.utcnow().isoformat(),
            current_price=current_price,
            structures=structures,
        )

    except Exception as e:
        logger.error(f"Error getting current structure: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Zones Endpoints ===

@router.get("/zones/{timeframe}", response_model=ZonesResponse)
async def get_zones_for_timeframe(
    timeframe: str,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get Order Blocks and Fair Value Gaps for a specific timeframe.
    """
    # Map display timeframe to CCXT format
    tf_upper = timeframe.upper()
    ccxt_tf = TIMEFRAME_MAP_REVERSE.get(tf_upper, timeframe.lower())

    try:
        # Get current price
        price_data = exchange.get_current_price()
        current_price = price_data.get("price", 0)

        # Fetch OHLCV data
        ohlcv_data = exchange.fetch_ohlcv(timeframe=ccxt_tf, limit=300)

        # Analyze zones
        zones_result = analyze_zones(ohlcv_data, current_price)

        # Convert to response format
        fvgs = [
            Zone(
                type=z["type"],
                high=z["high"],
                low=z["low"],
                formed_at=z.get("formed_at"),
                is_active=z.get("is_active", True),
            )
            for z in zones_result.get("fvgs", [])
        ]

        obs = [
            Zone(
                type=z["type"],
                high=z["high"],
                low=z["low"],
                formed_at=z.get("formed_at"),
                is_active=z.get("is_active", True),
            )
            for z in zones_result.get("order_blocks", [])
        ]

        nearby = [
            NearbyZone(
                type=z["type"],
                high=z["high"],
                low=z["low"],
                mid=z["mid"],
                distance_pct=z["distance_pct"],
                formed_at=z.get("formed_at"),
                direction=z["direction"],
            )
            for z in zones_result.get("nearby_zones", [])
        ]

        return ZonesResponse(
            timeframe=tf_upper,
            fvgs=fvgs,
            order_blocks=obs,
            nearby_zones=nearby,
            current_price=current_price,
        )

    except Exception as e:
        logger.error(f"Error analyzing zones for {timeframe}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones/current", response_model=ZonesCurrentResponse)
async def get_current_zones(
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get Order Blocks and Fair Value Gaps for all timeframes.
    """
    try:
        # Get current price
        price_data = exchange.get_current_price()
        current_price = price_data.get("price", 0)

        zones = {}

        for tf in settings.timeframes:
            # Fetch OHLCV data
            ohlcv_data = exchange.fetch_ohlcv(timeframe=tf, limit=300)

            # Analyze zones
            zones_result = analyze_zones(ohlcv_data, current_price)

            display_tf = exchange.get_display_timeframe(tf)

            # Convert to response format
            fvgs = [
                Zone(
                    type=z["type"],
                    high=z["high"],
                    low=z["low"],
                    formed_at=z.get("formed_at"),
                    is_active=z.get("is_active", True),
                )
                for z in zones_result.get("fvgs", [])
            ]

            obs = [
                Zone(
                    type=z["type"],
                    high=z["high"],
                    low=z["low"],
                    formed_at=z.get("formed_at"),
                    is_active=z.get("is_active", True),
                )
                for z in zones_result.get("order_blocks", [])
            ]

            nearby = [
                NearbyZone(
                    type=z["type"],
                    high=z["high"],
                    low=z["low"],
                    mid=z["mid"],
                    distance_pct=z["distance_pct"],
                    formed_at=z.get("formed_at"),
                    direction=z["direction"],
                )
                for z in zones_result.get("nearby_zones", [])
            ]

            zones[display_tf] = ZonesResponse(
                timeframe=display_tf,
                fvgs=fvgs,
                order_blocks=obs,
                nearby_zones=nearby,
                current_price=current_price,
            )

        return ZonesCurrentResponse(
            timestamp=datetime.utcnow().isoformat(),
            current_price=current_price,
            zones=zones,
        )

    except Exception as e:
        logger.error(f"Error getting current zones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === SNIPER Endpoints ===

@router.get("/sniper/analyze", response_model=SniperResponse)
async def get_sniper_analysis(
    symbol: str = None,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get SNIPER analysis with confluence scoring and trade setups.

    Returns:
    - Confluence score (0-5)
    - Trade signal (STRONG_LONG, LONG, NEUTRAL, SHORT, STRONG_SHORT)
    - Potential trade setups with entry, stop, targets
    - Position sizing recommendation
    """
    try:
        # Get current price
        price_data = exchange.get_current_price(symbol=symbol)
        current_price = price_data.get("price", 0)

        # Get funding rate
        funding_data = exchange.fetch_funding_rate(symbol=symbol)
        funding_rate = funding_data.get("funding_rate", 0)

        # Fetch OHLCV for all timeframes
        ohlcv_data_by_tf = {}
        for tf in settings.timeframes:
            ohlcv_data = exchange.fetch_ohlcv(symbol=symbol, timeframe=tf, limit=300)
            ohlcv_data_by_tf[tf] = ohlcv_data

        # Run SNIPER analysis
        sniper_result = analyze_sniper(ohlcv_data_by_tf, current_price, funding_rate)

        # Convert to response format
        confluence = sniper_result.get("confluence", {})
        components = [
            ConfluenceComponent(
                name=c["name"],
                points=c["points"],
                max=c["max"],
                note=c["note"],
            )
            for c in confluence.get("components", [])
        ]

        setups = [
            TradeSetupResponse(
                direction=s["direction"],
                entry_zone_type=s["entry_zone_type"],
                entry_zone=s["entry_zone"],
                entry_price=s["entry_price"],
                stop_loss=s["stop_loss"],
                take_profits=s["take_profits"],
                risk_reward=s["risk_reward"],
                confluence_score=s["confluence_score"],
                position_size_pct=s["position_size_pct"],
                timeframe=s["timeframe"],
                notes=s["notes"],
            )
            for s in sniper_result.get("setups", [])
        ]

        return SniperResponse(
            timestamp=sniper_result.get("timestamp", datetime.utcnow().isoformat()),
            current_price=current_price,
            confluence=ConfluenceResult(
                score=confluence.get("score", 0),
                max_score=confluence.get("max_score", 5.0),
                signal=confluence.get("signal", "NEUTRAL"),
                recommendation=confluence.get("recommendation", ""),
                components=components,
            ),
            setups=setups,
            radar_score=sniper_result.get("radar_score"),
            radar_classification=sniper_result.get("radar_classification"),
        )

    except Exception as e:
        logger.error(f"Error in SNIPER analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === TradingView Webhook Endpoints ===

@router.post("/webhook/tradingview")
async def receive_tradingview_webhook(
    payload: TradingViewWebhook,
    session: AsyncSession = Depends(get_session)
):
    """
    Receive webhook alerts from TradingView.

    TradingView Alert Message format example:
    {
        "symbol": "{{ticker}}",
        "action": "{{strategy.order.action}}",
        "price": {{close}},
        "timeframe": "{{interval}}",
        "time": "{{time}}",
        "alert_name": "My Alert",
        "message": "Custom message here"
    }
    """
    try:
        logger.info(f"Received TradingView webhook: {payload.symbol} - {payload.action}")

        # Create alert record
        alert = TradingViewAlert(
            timestamp=datetime.utcnow(),
            alert_name=payload.alert_name,
            symbol=payload.symbol or "UNKNOWN",
            timeframe=payload.timeframe,
            action=payload.action or payload.strategy_order_action,
            price=payload.price or payload.close or payload.strategy_order_price,
            close=payload.close,
            open=payload.open,
            high=payload.high,
            low=payload.low,
            volume=payload.volume,
            message=payload.message or payload.alert_message,
            raw_payload=payload.model_dump(exclude_none=True),
            processed=False,
        )

        session.add(alert)
        await session.commit()
        await session.refresh(alert)

        logger.info(f"Saved alert ID: {alert.id}")

        return {
            "success": True,
            "message": "Alert received",
            "alert_id": alert.id,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts", response_model=AlertsListResponse)
async def get_alerts(
    limit: int = 20,
    session: AsyncSession = Depends(get_session)
):
    """
    Get recent TradingView alerts.
    """
    try:
        result = await session.execute(
            select(TradingViewAlert)
            .order_by(desc(TradingViewAlert.timestamp))
            .limit(limit)
        )
        alerts = result.scalars().all()

        alert_responses = [
            AlertResponse(
                id=a.id,
                timestamp=a.timestamp.isoformat(),
                symbol=a.symbol,
                action=a.action,
                price=a.price,
                message=a.message,
                timeframe=a.timeframe,
                processed=a.processed,
            )
            for a in alerts
        ]

        return AlertsListResponse(
            timestamp=datetime.utcnow().isoformat(),
            count=len(alert_responses),
            alerts=alert_responses,
        )

    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete a specific alert.
    """
    try:
        result = await session.execute(
            select(TradingViewAlert).where(TradingViewAlert.id == alert_id)
        )
        alert = result.scalar_one_or_none()

        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        await session.delete(alert)
        await session.commit()

        return {
            "success": True,
            "message": f"Alert {alert_id} deleted",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === LLM Endpoints ===

@router.post("/chat", response_model=ChatResponse)
async def chat_with_copilot(
    request: ChatRequest,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Chat with the trading copilot (Claude).
    Optionally includes current market data for context.
    """
    try:
        llm = get_llm_service()

        if not llm.is_available():
            return ChatResponse(
                success=False,
                error="LLM service not configured. Set ANTHROPIC_API_KEY environment variable.",
                timestamp=datetime.utcnow().isoformat(),
            )

        market_data = None
        if request.include_market_data:
            # Gather market data
            price_data = exchange.get_current_price()
            funding_data = exchange.fetch_funding_rate()

            # Get bias data
            ohlcv_1d = exchange.fetch_ohlcv(timeframe="1d", limit=300)
            radar_result = calculate_full_radar(ohlcv_1d, funding_data.get("funding_rate", 0))

            # Get structure for multiple TFs
            biases = {}
            for tf in ["1h", "4h", "1d", "1w"]:
                ohlcv = exchange.fetch_ohlcv(timeframe=tf, limit=300)
                structure = analyze_structure(ohlcv, tf, price_data["price"])
                biases[tf.upper()] = {
                    "structural_bias": structure.get("bias", "NEUTRAL"),
                    "secondary_swing_level": structure.get("secondary_swing", {}).get("price"),
                }

            market_data = {
                "price": price_data,
                "radar": radar_result,
                "bias": {
                    "overall_bias": "BULLISH" if sum(1 for b in biases.values() if b["structural_bias"] == "BULLISH") > 2 else "BEARISH",
                    "biases": biases,
                },
            }

        result = await llm.chat(request.message, market_data)

        return ChatResponse(
            success=result.get("success", False),
            response=result.get("response"),
            error=result.get("error"),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(
            success=False,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )


@router.get("/analysis", response_model=AnalysisResponse)
async def get_market_analysis(
    question: str = None,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Get AI-powered market analysis.
    Optional question parameter for specific queries.
    """
    try:
        llm = get_llm_service()

        if not llm.is_available():
            return AnalysisResponse(
                success=False,
                error="LLM service not configured. Set ANTHROPIC_API_KEY.",
                timestamp=datetime.utcnow().isoformat(),
            )

        # Gather comprehensive market data
        price_data = exchange.get_current_price()
        funding_data = exchange.fetch_funding_rate()
        current_price = price_data.get("price", 0)

        # RADAR
        ohlcv_1d = exchange.fetch_ohlcv(timeframe="1d", limit=300)
        radar_result = calculate_full_radar(ohlcv_1d, funding_data.get("funding_rate", 0))

        # Bias and structure
        biases = {}
        for tf in settings.timeframes:
            ohlcv = exchange.fetch_ohlcv(timeframe=tf, limit=300)
            structure = analyze_structure(ohlcv, tf, current_price)
            display_tf = exchange.get_display_timeframe(tf)
            biases[display_tf] = {
                "structural_bias": structure.get("bias", "NEUTRAL"),
                "secondary_swing_level": structure.get("secondary_swing", {}).get("price"),
                "structure": structure.get("structure"),
            }

        # Zones
        ohlcv_4h = exchange.fetch_ohlcv(timeframe="4h", limit=300)
        zones_result = analyze_zones(ohlcv_4h, current_price)

        # SNIPER
        ohlcv_by_tf = {tf: exchange.fetch_ohlcv(timeframe=tf, limit=300) for tf in settings.timeframes}
        sniper_result = analyze_sniper(ohlcv_by_tf, current_price, funding_data.get("funding_rate", 0))

        # Build market data
        market_data = {
            "price": price_data,
            "radar": radar_result,
            "bias": {
                "overall_bias": "BULLISH" if sum(1 for b in biases.values() if b["structural_bias"] == "BULLISH") > len(biases) / 2 else "BEARISH",
                "biases": biases,
            },
            "zones": zones_result,
            "sniper": sniper_result,
        }

        result = await llm.analyze_market(market_data, question)

        return AnalysisResponse(
            success=result.get("success", False),
            analysis=result.get("analysis"),
            error=result.get("error"),
            model=result.get("model"),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return AnalysisResponse(
            success=False,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )


@router.get("/briefing", response_model=BriefingResponse)
async def get_daily_briefing(
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Generate daily market briefing using Claude.
    """
    try:
        llm = get_llm_service()

        if not llm.is_available():
            return BriefingResponse(
                success=False,
                error="LLM service not configured. Set ANTHROPIC_API_KEY.",
                timestamp=datetime.utcnow().isoformat(),
            )

        # Gather comprehensive market data
        price_data = exchange.get_current_price()
        funding_data = exchange.fetch_funding_rate()
        current_price = price_data.get("price", 0)

        # RADAR
        ohlcv_1d = exchange.fetch_ohlcv(timeframe="1d", limit=300)
        radar_result = calculate_full_radar(ohlcv_1d, funding_data.get("funding_rate", 0))

        # Bias
        biases = {}
        for tf in settings.timeframes:
            ohlcv = exchange.fetch_ohlcv(timeframe=tf, limit=300)
            structure = analyze_structure(ohlcv, tf, current_price)
            display_tf = exchange.get_display_timeframe(tf)
            biases[display_tf] = {
                "structural_bias": structure.get("bias", "NEUTRAL"),
                "secondary_swing_level": structure.get("secondary_swing", {}).get("price"),
            }

        # SNIPER
        ohlcv_by_tf = {tf: exchange.fetch_ohlcv(timeframe=tf, limit=300) for tf in settings.timeframes}
        sniper_result = analyze_sniper(ohlcv_by_tf, current_price, funding_data.get("funding_rate", 0))

        market_data = {
            "price": price_data,
            "radar": radar_result,
            "bias": {
                "overall_bias": "BULLISH" if sum(1 for b in biases.values() if b["structural_bias"] == "BULLISH") > len(biases) / 2 else "BEARISH",
                "biases": biases,
            },
            "sniper": sniper_result,
        }

        result = await llm.generate_daily_briefing(market_data)

        return BriefingResponse(
            success=result.get("success", False),
            briefing=result.get("briefing"),
            error=result.get("error"),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Briefing error: {e}")
        return BriefingResponse(
            success=False,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )


# === Telegram Endpoints ===

@router.post("/telegram/send", response_model=TelegramResponse)
async def send_telegram_message(request: TelegramMessageRequest):
    """
    Send a message to Telegram.
    """
    try:
        telegram = get_telegram_service()

        if not telegram.is_available():
            return TelegramResponse(
                success=False,
                error="Telegram bot not configured. Set TELEGRAM_BOT_TOKEN.",
                timestamp=datetime.utcnow().isoformat(),
            )

        result = await telegram.send_message(request.message, request.chat_id)

        return TelegramResponse(
            success=result.get("success", False),
            error=result.get("error"),
            message_id=result.get("message_id"),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return TelegramResponse(
            success=False,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )


@router.post("/telegram/alert", response_model=TelegramResponse)
async def send_telegram_alert(
    request: TelegramAlertRequest,
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Send a formatted trading alert to Telegram.
    """
    try:
        telegram = get_telegram_service()

        if not telegram.is_available():
            return TelegramResponse(
                success=False,
                error="Telegram bot not configured",
                timestamp=datetime.utcnow().isoformat(),
            )

        # Get current price if not provided
        price = request.price
        if price is None:
            price_data = exchange.get_current_price()
            price = price_data.get("price")

        result = await telegram.send_alert(
            alert_type=request.alert_type,
            symbol=request.symbol,
            message=request.message,
            price=price,
            chat_id=request.chat_id,
        )

        return TelegramResponse(
            success=result.get("success", False),
            error=result.get("error"),
            message_id=result.get("message_id"),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Telegram alert error: {e}")
        return TelegramResponse(
            success=False,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )


@router.post("/telegram/briefing", response_model=TelegramResponse)
async def send_telegram_briefing(
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Generate and send daily briefing to Telegram.
    """
    try:
        telegram = get_telegram_service()
        llm = get_llm_service()

        if not telegram.is_available():
            return TelegramResponse(
                success=False,
                error="Telegram bot not configured",
                timestamp=datetime.utcnow().isoformat(),
            )

        if not llm.is_available():
            return TelegramResponse(
                success=False,
                error="LLM service not configured",
                timestamp=datetime.utcnow().isoformat(),
            )

        # Generate briefing
        price_data = exchange.get_current_price()
        funding_data = exchange.fetch_funding_rate()
        current_price = price_data.get("price", 0)

        ohlcv_1d = exchange.fetch_ohlcv(timeframe="1d", limit=300)
        radar_result = calculate_full_radar(ohlcv_1d, funding_data.get("funding_rate", 0))

        biases = {}
        for tf in settings.timeframes:
            ohlcv = exchange.fetch_ohlcv(timeframe=tf, limit=300)
            structure = analyze_structure(ohlcv, tf, current_price)
            display_tf = exchange.get_display_timeframe(tf)
            biases[display_tf] = {
                "structural_bias": structure.get("bias", "NEUTRAL"),
                "secondary_swing_level": structure.get("secondary_swing", {}).get("price"),
            }

        ohlcv_by_tf = {tf: exchange.fetch_ohlcv(timeframe=tf, limit=300) for tf in settings.timeframes}
        sniper_result = analyze_sniper(ohlcv_by_tf, current_price, funding_data.get("funding_rate", 0))

        market_data = {
            "price": price_data,
            "radar": radar_result,
            "bias": {"overall_bias": "BULLISH" if sum(1 for b in biases.values() if b["structural_bias"] == "BULLISH") > len(biases) / 2 else "BEARISH", "biases": biases},
            "sniper": sniper_result,
        }

        briefing_result = await llm.generate_daily_briefing(market_data)

        if not briefing_result.get("success"):
            return TelegramResponse(
                success=False,
                error=briefing_result.get("error", "Failed to generate briefing"),
                timestamp=datetime.utcnow().isoformat(),
            )

        # Send to Telegram
        result = await telegram.send_daily_briefing(briefing_result["briefing"])

        return TelegramResponse(
            success=result.get("success", False),
            error=result.get("error"),
            message_id=result.get("message_id"),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Telegram briefing error: {e}")
        return TelegramResponse(
            success=False,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )


@router.post("/telegram/sniper-setup", response_model=TelegramResponse)
async def send_sniper_setup_telegram(
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Send current SNIPER setup to Telegram.
    """
    try:
        telegram = get_telegram_service()

        if not telegram.is_available():
            return TelegramResponse(
                success=False,
                error="Telegram bot not configured",
                timestamp=datetime.utcnow().isoformat(),
            )

        # Get SNIPER analysis
        price_data = exchange.get_current_price()
        current_price = price_data.get("price", 0)
        funding_data = exchange.fetch_funding_rate()

        ohlcv_by_tf = {tf: exchange.fetch_ohlcv(timeframe=tf, limit=300) for tf in settings.timeframes}
        sniper_result = analyze_sniper(ohlcv_by_tf, current_price, funding_data.get("funding_rate", 0))

        setups = sniper_result.get("setups", [])

        if not setups:
            return TelegramResponse(
                success=False,
                error="No SNIPER setups available",
                timestamp=datetime.utcnow().isoformat(),
            )

        # Send first setup
        result = await telegram.send_sniper_setup(setups[0])

        return TelegramResponse(
            success=result.get("success", False),
            error=result.get("error"),
            message_id=result.get("message_id"),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Telegram SNIPER setup error: {e}")
        return TelegramResponse(
            success=False,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )


# === Trade Journal Endpoints ===

@router.post("/trades", response_model=TradeResponse)
async def create_trade(
    trade: TradeCreate,
    session: AsyncSession = Depends(get_session),
    exchange: ExchangeClient = Depends(get_exchange)
):
    """
    Create a new trade entry.
    Automatically captures current RADAR and structure context if not provided.
    """
    try:
        # Parse entry time
        entry_time = datetime.fromisoformat(trade.entry_time) if trade.entry_time else datetime.utcnow()

        # Auto-capture context if not provided
        radar_score = trade.radar_score
        radar_classification = trade.radar_classification
        structural_bias = trade.structural_bias
        confluence_score = trade.confluence_score

        if radar_score is None or structural_bias is None:
            # Get current context
            funding_data = exchange.fetch_funding_rate()
            ohlcv_1d = exchange.fetch_ohlcv(timeframe="1d", limit=300)
            radar_result = calculate_full_radar(ohlcv_1d, funding_data.get("funding_rate", 0))

            if radar_score is None:
                radar_score = radar_result.get("score")
            if radar_classification is None:
                radar_classification = radar_result.get("classification")

            if structural_bias is None:
                ohlcv_4h = exchange.fetch_ohlcv(timeframe="4h", limit=300)
                structure = analyze_structure(ohlcv_4h, "4h", trade.entry_price)
                structural_bias = structure.get("bias", "NEUTRAL")

        # Calculate risk/reward if possible
        risk_reward = trade.risk_reward
        if risk_reward is None and trade.stop_loss and trade.take_profit_1:
            entry = trade.entry_price
            sl = trade.stop_loss
            tp1 = trade.take_profit_1
            if trade.direction == "LONG":
                risk = entry - sl
                reward = tp1 - entry
            else:
                risk = sl - entry
                reward = entry - tp1
            if risk > 0:
                risk_reward = round(reward / risk, 2)

        # Create trade record
        new_trade = Trade(
            symbol=trade.symbol,
            direction=trade.direction,
            status="OPEN",
            entry_price=trade.entry_price,
            entry_time=entry_time,
            entry_zone_type=trade.entry_zone_type,
            position_size=trade.position_size,
            position_size_pct=trade.position_size_pct,
            leverage=trade.leverage,
            stop_loss=trade.stop_loss,
            take_profit_1=trade.take_profit_1,
            take_profit_2=trade.take_profit_2,
            take_profit_3=trade.take_profit_3,
            risk_reward=risk_reward,
            confluence_score=confluence_score,
            radar_score=radar_score,
            radar_classification=radar_classification,
            structural_bias=structural_bias,
            timeframe=trade.timeframe,
            notes=trade.notes,
            tags=trade.tags,
            screenshot_url=trade.screenshot_url,
        )

        session.add(new_trade)
        await session.commit()
        await session.refresh(new_trade)

        logger.info(f"Created trade ID: {new_trade.id} - {trade.direction} @ {trade.entry_price}")

        return TradeResponse(
            id=new_trade.id,
            symbol=new_trade.symbol,
            direction=new_trade.direction,
            status=new_trade.status,
            entry_price=new_trade.entry_price,
            entry_time=new_trade.entry_time.isoformat(),
            entry_zone_type=new_trade.entry_zone_type,
            position_size=new_trade.position_size,
            position_size_pct=new_trade.position_size_pct,
            leverage=new_trade.leverage,
            stop_loss=new_trade.stop_loss,
            take_profit_1=new_trade.take_profit_1,
            take_profit_2=new_trade.take_profit_2,
            take_profit_3=new_trade.take_profit_3,
            risk_reward=new_trade.risk_reward,
            exit_price=new_trade.exit_price,
            exit_time=new_trade.exit_time.isoformat() if new_trade.exit_time else None,
            exit_reason=new_trade.exit_reason,
            realized_pnl=new_trade.realized_pnl,
            realized_pnl_pct=new_trade.realized_pnl_pct,
            fees=new_trade.fees,
            confluence_score=new_trade.confluence_score,
            radar_score=new_trade.radar_score,
            radar_classification=new_trade.radar_classification,
            structural_bias=new_trade.structural_bias,
            timeframe=new_trade.timeframe,
            notes=new_trade.notes,
            tags=new_trade.tags,
            screenshot_url=new_trade.screenshot_url,
            outcome=new_trade.outcome,
            created_at=new_trade.created_at.isoformat(),
            updated_at=new_trade.updated_at.isoformat(),
        )

    except Exception as e:
        logger.error(f"Error creating trade: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trades", response_model=TradeListResponse)
async def get_trades(
    status: str = None,
    direction: str = None,
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session)
):
    """
    Get trade journal entries.
    Filter by status (OPEN, CLOSED, CANCELLED) or direction (LONG, SHORT).
    """
    try:
        query = select(Trade).order_by(desc(Trade.entry_time))

        if status:
            query = query.where(Trade.status == status.upper())
        if direction:
            query = query.where(Trade.direction == direction.upper())

        query = query.offset(offset).limit(limit)
        result = await session.execute(query)
        trades = result.scalars().all()

        trade_responses = [
            TradeResponse(
                id=t.id,
                symbol=t.symbol,
                direction=t.direction,
                status=t.status,
                entry_price=t.entry_price,
                entry_time=t.entry_time.isoformat(),
                entry_zone_type=t.entry_zone_type,
                position_size=t.position_size,
                position_size_pct=t.position_size_pct,
                leverage=t.leverage,
                stop_loss=t.stop_loss,
                take_profit_1=t.take_profit_1,
                take_profit_2=t.take_profit_2,
                take_profit_3=t.take_profit_3,
                risk_reward=t.risk_reward,
                exit_price=t.exit_price,
                exit_time=t.exit_time.isoformat() if t.exit_time else None,
                exit_reason=t.exit_reason,
                realized_pnl=t.realized_pnl,
                realized_pnl_pct=t.realized_pnl_pct,
                fees=t.fees,
                confluence_score=t.confluence_score,
                radar_score=t.radar_score,
                radar_classification=t.radar_classification,
                structural_bias=t.structural_bias,
                timeframe=t.timeframe,
                notes=t.notes,
                tags=t.tags,
                screenshot_url=t.screenshot_url,
                outcome=t.outcome,
                created_at=t.created_at.isoformat(),
                updated_at=t.updated_at.isoformat(),
            )
            for t in trades
        ]

        return TradeListResponse(
            timestamp=datetime.utcnow().isoformat(),
            count=len(trade_responses),
            trades=trade_responses,
        )

    except Exception as e:
        logger.error(f"Error fetching trades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Trade Stats & Analytics (must be before {trade_id} routes) ===

@router.get("/trades/stats/summary", response_model=TradeStatsResponse)
async def get_trade_stats(
    period: str = "ALL",
    session: AsyncSession = Depends(get_session)
):
    """
    Get aggregated trade statistics.
    Period can be: ALL, DAILY, WEEKLY, MONTHLY
    """
    try:
        # Get all closed trades for calculation
        query = select(Trade).where(Trade.status == "CLOSED")

        # Apply period filter
        now = datetime.utcnow()
        start_date = None

        if period.upper() == "DAILY":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period.upper() == "WEEKLY":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = start_date.replace(day=now.day - now.weekday())
        elif period.upper() == "MONTHLY":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        if start_date:
            query = query.where(Trade.exit_time >= start_date)

        result = await session.execute(query)
        trades = result.scalars().all()

        # Calculate stats
        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t.outcome == "WIN")
        losing_trades = sum(1 for t in trades if t.outcome == "LOSS")
        breakeven_trades = sum(1 for t in trades if t.outcome == "BREAKEVEN")

        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else None

        wins = [t.realized_pnl for t in trades if t.outcome == "WIN" and t.realized_pnl]
        losses = [t.realized_pnl for t in trades if t.outcome == "LOSS" and t.realized_pnl]

        total_pnl = sum(t.realized_pnl or 0 for t in trades)
        avg_win = sum(wins) / len(wins) if wins else None
        avg_loss = sum(losses) / len(losses) if losses else None
        largest_win = max(wins) if wins else None
        largest_loss = min(losses) if losses else None

        # Profit factor
        gross_profit = sum(wins) if wins else 0
        gross_loss = abs(sum(losses)) if losses else 0
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else None

        # Expectancy
        expectancy = None
        if win_rate is not None and avg_win and avg_loss:
            expectancy = (win_rate / 100 * avg_win) + ((1 - win_rate / 100) * avg_loss)

        # Average R:R
        rrs = [t.risk_reward for t in trades if t.risk_reward]
        avg_rr = sum(rrs) / len(rrs) if rrs else None

        # Streaks
        current_streak = 0
        max_win_streak = 0
        max_loss_streak = 0
        temp_win = 0
        temp_loss = 0

        sorted_trades = sorted(trades, key=lambda x: x.exit_time or datetime.min)
        for t in sorted_trades:
            if t.outcome == "WIN":
                temp_win += 1
                temp_loss = 0
                max_win_streak = max(max_win_streak, temp_win)
                current_streak = temp_win
            elif t.outcome == "LOSS":
                temp_loss += 1
                temp_win = 0
                max_loss_streak = max(max_loss_streak, temp_loss)
                current_streak = -temp_loss
            else:
                temp_win = 0
                temp_loss = 0
                current_streak = 0

        # Direction breakdown
        long_trades = [t for t in trades if t.direction == "LONG"]
        short_trades = [t for t in trades if t.direction == "SHORT"]
        long_wins = sum(1 for t in long_trades if t.outcome == "WIN")
        short_wins = sum(1 for t in short_trades if t.outcome == "WIN")
        long_win_rate = (long_wins / len(long_trades) * 100) if long_trades else None
        short_win_rate = (short_wins / len(short_trades) * 100) if short_trades else None

        return TradeStatsResponse(
            period=period.upper(),
            start_date=start_date.isoformat() if start_date else None,
            end_date=now.isoformat(),
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            breakeven_trades=breakeven_trades,
            win_rate=round(win_rate, 1) if win_rate else None,
            total_pnl=round(total_pnl, 2),
            avg_win=round(avg_win, 2) if avg_win else None,
            avg_loss=round(avg_loss, 2) if avg_loss else None,
            largest_win=round(largest_win, 2) if largest_win else None,
            largest_loss=round(largest_loss, 2) if largest_loss else None,
            profit_factor=round(profit_factor, 2) if profit_factor else None,
            avg_risk_reward=round(avg_rr, 2) if avg_rr else None,
            expectancy=round(expectancy, 2) if expectancy else None,
            current_streak=current_streak,
            max_win_streak=max_win_streak,
            max_loss_streak=max_loss_streak,
            long_trades=len(long_trades),
            short_trades=len(short_trades),
            long_win_rate=round(long_win_rate, 1) if long_win_rate else None,
            short_win_rate=round(short_win_rate, 1) if short_win_rate else None,
            calculated_at=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Error calculating trade stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trades/export")
async def export_trades(
    format: str = "json",
    status: str = None,
    session: AsyncSession = Depends(get_session)
):
    """
    Export trades to CSV or JSON.
    """
    try:
        query = select(Trade).order_by(desc(Trade.entry_time))

        if status:
            query = query.where(Trade.status == status.upper())

        result = await session.execute(query)
        trades = result.scalars().all()

        if format.lower() == "csv":
            # Generate CSV
            output = io.StringIO()
            writer = csv.writer(output)

            # Header
            writer.writerow([
                "id", "direction", "status", "entry_price", "entry_time",
                "exit_price", "exit_time", "exit_reason", "stop_loss",
                "take_profit_1", "position_size", "leverage", "realized_pnl",
                "realized_pnl_pct", "outcome", "radar_score", "structural_bias",
                "confluence_score", "timeframe", "notes", "tags"
            ])

            # Data
            for t in trades:
                writer.writerow([
                    t.id, t.direction, t.status, t.entry_price,
                    t.entry_time.isoformat() if t.entry_time else "",
                    t.exit_price or "", t.exit_time.isoformat() if t.exit_time else "",
                    t.exit_reason or "", t.stop_loss or "", t.take_profit_1 or "",
                    t.position_size or "", t.leverage, t.realized_pnl or "",
                    t.realized_pnl_pct or "", t.outcome or "", t.radar_score or "",
                    t.structural_bias or "", t.confluence_score or "",
                    t.timeframe or "", t.notes or "", t.tags or ""
                ])

            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=trades_export.csv"}
            )

        else:
            # JSON export
            trades_data = [
                {
                    "id": t.id,
                    "direction": t.direction,
                    "status": t.status,
                    "entry_price": t.entry_price,
                    "entry_time": t.entry_time.isoformat() if t.entry_time else None,
                    "exit_price": t.exit_price,
                    "exit_time": t.exit_time.isoformat() if t.exit_time else None,
                    "exit_reason": t.exit_reason,
                    "stop_loss": t.stop_loss,
                    "take_profit_1": t.take_profit_1,
                    "take_profit_2": t.take_profit_2,
                    "take_profit_3": t.take_profit_3,
                    "position_size": t.position_size,
                    "leverage": t.leverage,
                    "realized_pnl": t.realized_pnl,
                    "realized_pnl_pct": t.realized_pnl_pct,
                    "outcome": t.outcome,
                    "radar_score": t.radar_score,
                    "radar_classification": t.radar_classification,
                    "structural_bias": t.structural_bias,
                    "confluence_score": t.confluence_score,
                    "timeframe": t.timeframe,
                    "notes": t.notes,
                    "tags": t.tags,
                }
                for t in trades
            ]

            return {
                "timestamp": datetime.utcnow().isoformat(),
                "count": len(trades_data),
                "trades": trades_data,
            }

    except Exception as e:
        logger.error(f"Error exporting trades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trades/import")
async def import_trades(
    request: TradeImportRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Import trades from JSON.
    """
    try:
        imported = 0
        errors = []

        for i, trade_data in enumerate(request.trades):
            try:
                # Parse entry time
                entry_time = datetime.fromisoformat(trade_data.entry_time)
                exit_time = datetime.fromisoformat(trade_data.exit_time) if trade_data.exit_time else None

                # Create trade
                trade = Trade(
                    direction=trade_data.direction,
                    status=trade_data.status,
                    entry_price=trade_data.entry_price,
                    entry_time=entry_time,
                    exit_price=trade_data.exit_price,
                    exit_time=exit_time,
                    exit_reason=trade_data.exit_reason,
                    stop_loss=trade_data.stop_loss,
                    take_profit_1=trade_data.take_profit_1,
                    position_size=trade_data.position_size,
                    realized_pnl=trade_data.realized_pnl,
                    realized_pnl_pct=trade_data.realized_pnl_pct,
                    outcome=trade_data.outcome,
                    notes=trade_data.notes,
                    tags=trade_data.tags,
                )

                session.add(trade)
                imported += 1

            except Exception as e:
                errors.append(f"Trade {i+1}: {str(e)}")

        await session.commit()

        return {
            "success": True,
            "imported": imported,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error importing trades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trades/equity-curve", response_model=EquityCurveResponse)
async def get_equity_curve(
    starting_equity: float = 10000,
    session: AsyncSession = Depends(get_session)
):
    """
    Calculate equity curve from closed trades.
    """
    try:
        # Get closed trades ordered by exit time
        result = await session.execute(
            select(Trade)
            .where(Trade.status == "CLOSED")
            .order_by(Trade.exit_time)
        )
        trades = result.scalars().all()

        # Build equity curve
        equity = starting_equity
        peak_equity = starting_equity
        max_drawdown = 0
        max_drawdown_pct = 0

        curve = []
        equity_by_date = {}

        for trade in trades:
            if not trade.exit_time or trade.realized_pnl is None:
                continue

            date_str = trade.exit_time.strftime("%Y-%m-%d")

            # Add P&L to equity
            equity += trade.realized_pnl

            # Track peak and drawdown
            if equity > peak_equity:
                peak_equity = equity

            drawdown = peak_equity - equity
            drawdown_pct = (drawdown / peak_equity * 100) if peak_equity > 0 else 0

            if drawdown > max_drawdown:
                max_drawdown = drawdown
                max_drawdown_pct = drawdown_pct

            # Aggregate by date
            if date_str not in equity_by_date:
                equity_by_date[date_str] = {
                    "equity": equity,
                    "drawdown": drawdown,
                    "drawdown_pct": drawdown_pct,
                    "trade_count": 1,
                }
            else:
                equity_by_date[date_str]["equity"] = equity
                equity_by_date[date_str]["drawdown"] = drawdown
                equity_by_date[date_str]["drawdown_pct"] = drawdown_pct
                equity_by_date[date_str]["trade_count"] += 1

        # Convert to list
        for date_str, data in sorted(equity_by_date.items()):
            curve.append(EquityPoint(
                date=date_str,
                equity=round(data["equity"], 2),
                drawdown=round(data["drawdown"], 2),
                drawdown_pct=round(data["drawdown_pct"], 2),
                trade_count=data["trade_count"],
            ))

        return EquityCurveResponse(
            timestamp=datetime.utcnow().isoformat(),
            starting_equity=starting_equity,
            current_equity=round(equity, 2),
            peak_equity=round(peak_equity, 2),
            max_drawdown=round(max_drawdown, 2),
            max_drawdown_pct=round(max_drawdown_pct, 2),
            curve=curve,
        )

    except Exception as e:
        logger.error(f"Error calculating equity curve: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trades/performance/by-tag", response_model=PerformanceByTagResponse)
async def get_performance_by_tag(
    session: AsyncSession = Depends(get_session)
):
    """
    Get performance breakdown by tag.
    """
    try:
        result = await session.execute(
            select(Trade).where(Trade.status == "CLOSED")
        )
        trades = result.scalars().all()

        # Aggregate by tag
        tag_stats = {}

        for trade in trades:
            if not trade.tags:
                continue

            # Split tags
            tags = [t.strip().lower() for t in trade.tags.split(",") if t.strip()]

            for tag in tags:
                if tag not in tag_stats:
                    tag_stats[tag] = {
                        "total": 0,
                        "wins": 0,
                        "losses": 0,
                        "total_pnl": 0,
                        "trades": [],
                    }

                tag_stats[tag]["total"] += 1
                tag_stats[tag]["total_pnl"] += trade.realized_pnl or 0

                if trade.outcome == "WIN":
                    tag_stats[tag]["wins"] += 1
                elif trade.outcome == "LOSS":
                    tag_stats[tag]["losses"] += 1

        # Calculate win rates
        result_stats = {}
        for tag, stats in tag_stats.items():
            win_rate = (stats["wins"] / stats["total"] * 100) if stats["total"] > 0 else 0
            result_stats[tag] = {
                "total_trades": stats["total"],
                "wins": stats["wins"],
                "losses": stats["losses"],
                "win_rate": round(win_rate, 1),
                "total_pnl": round(stats["total_pnl"], 2),
            }

        return PerformanceByTagResponse(
            timestamp=datetime.utcnow().isoformat(),
            tags=result_stats,
        )

    except Exception as e:
        logger.error(f"Error calculating performance by tag: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Trade CRUD with {trade_id} ===

@router.get("/trades/{trade_id}", response_model=TradeResponse)
async def get_trade(
    trade_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Get a specific trade by ID.
    """
    try:
        result = await session.execute(
            select(Trade).where(Trade.id == trade_id)
        )
        trade = result.scalar_one_or_none()

        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")

        return TradeResponse(
            id=trade.id,
            symbol=trade.symbol,
            direction=trade.direction,
            status=trade.status,
            entry_price=trade.entry_price,
            entry_time=trade.entry_time.isoformat(),
            entry_zone_type=trade.entry_zone_type,
            position_size=trade.position_size,
            position_size_pct=trade.position_size_pct,
            leverage=trade.leverage,
            stop_loss=trade.stop_loss,
            take_profit_1=trade.take_profit_1,
            take_profit_2=trade.take_profit_2,
            take_profit_3=trade.take_profit_3,
            risk_reward=trade.risk_reward,
            exit_price=trade.exit_price,
            exit_time=trade.exit_time.isoformat() if trade.exit_time else None,
            exit_reason=trade.exit_reason,
            realized_pnl=trade.realized_pnl,
            realized_pnl_pct=trade.realized_pnl_pct,
            fees=trade.fees,
            confluence_score=trade.confluence_score,
            radar_score=trade.radar_score,
            radar_classification=trade.radar_classification,
            structural_bias=trade.structural_bias,
            timeframe=trade.timeframe,
            notes=trade.notes,
            tags=trade.tags,
            screenshot_url=trade.screenshot_url,
            outcome=trade.outcome,
            created_at=trade.created_at.isoformat(),
            updated_at=trade.updated_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching trade: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/trades/{trade_id}", response_model=TradeResponse)
async def update_trade(
    trade_id: int,
    update: TradeUpdate,
    session: AsyncSession = Depends(get_session)
):
    """
    Update a trade entry.
    Use this to close trades, update stop/targets, or add notes.
    """
    try:
        result = await session.execute(
            select(Trade).where(Trade.id == trade_id)
        )
        trade = result.scalar_one_or_none()

        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")

        # Update fields if provided
        update_data = update.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "exit_time" and value:
                value = datetime.fromisoformat(value)
            setattr(trade, field, value)

        # Auto-calculate P&L if closing trade
        if update.status == "CLOSED" and update.exit_price:
            entry = trade.entry_price
            exit_price = update.exit_price
            size = trade.position_size or 1

            if trade.direction == "LONG":
                pnl_pct = ((exit_price - entry) / entry) * 100 * trade.leverage
            else:
                pnl_pct = ((entry - exit_price) / entry) * 100 * trade.leverage

            trade.realized_pnl_pct = round(pnl_pct, 2)
            trade.realized_pnl = round((pnl_pct / 100) * size, 2)

            # Determine outcome
            if pnl_pct > 0.1:
                trade.outcome = "WIN"
            elif pnl_pct < -0.1:
                trade.outcome = "LOSS"
            else:
                trade.outcome = "BREAKEVEN"

            if not trade.exit_time:
                trade.exit_time = datetime.utcnow()

        await session.commit()
        await session.refresh(trade)

        logger.info(f"Updated trade ID: {trade_id}")

        return TradeResponse(
            id=trade.id,
            symbol=trade.symbol,
            direction=trade.direction,
            status=trade.status,
            entry_price=trade.entry_price,
            entry_time=trade.entry_time.isoformat(),
            entry_zone_type=trade.entry_zone_type,
            position_size=trade.position_size,
            position_size_pct=trade.position_size_pct,
            leverage=trade.leverage,
            stop_loss=trade.stop_loss,
            take_profit_1=trade.take_profit_1,
            take_profit_2=trade.take_profit_2,
            take_profit_3=trade.take_profit_3,
            risk_reward=trade.risk_reward,
            exit_price=trade.exit_price,
            exit_time=trade.exit_time.isoformat() if trade.exit_time else None,
            exit_reason=trade.exit_reason,
            realized_pnl=trade.realized_pnl,
            realized_pnl_pct=trade.realized_pnl_pct,
            fees=trade.fees,
            confluence_score=trade.confluence_score,
            radar_score=trade.radar_score,
            radar_classification=trade.radar_classification,
            structural_bias=trade.structural_bias,
            timeframe=trade.timeframe,
            notes=trade.notes,
            tags=trade.tags,
            screenshot_url=trade.screenshot_url,
            outcome=trade.outcome,
            created_at=trade.created_at.isoformat(),
            updated_at=trade.updated_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating trade: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trades/{trade_id}/close", response_model=TradeResponse)
async def close_trade(
    trade_id: int,
    exit_price: float,
    exit_reason: str = "MANUAL",
    session: AsyncSession = Depends(get_session)
):
    """
    Close a trade with given exit price.
    Automatically calculates P&L and outcome.
    """
    update = TradeUpdate(
        status="CLOSED",
        exit_price=exit_price,
        exit_reason=exit_reason,
    )
    return await update_trade(trade_id, update, session)


@router.delete("/trades/{trade_id}")
async def delete_trade(
    trade_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete a trade entry.
    """
    try:
        result = await session.execute(
            select(Trade).where(Trade.id == trade_id)
        )
        trade = result.scalar_one_or_none()

        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")

        await session.delete(trade)
        await session.commit()

        return {
            "success": True,
            "message": f"Trade {trade_id} deleted",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting trade: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Alert Monitor Endpoints ===

@router.post("/alerts/monitor/start")
async def start_alert_monitor():
    """
    Start the background alert monitor.
    Monitors RADAR changes and SNIPER setups.
    """
    try:
        monitor = get_alert_monitor()
        await monitor.start()

        return {
            "success": True,
            "message": "Alert monitor started",
            "interval_seconds": monitor.check_interval,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error starting alert monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/monitor/stop")
async def stop_alert_monitor():
    """
    Stop the background alert monitor.
    """
    try:
        monitor = get_alert_monitor()
        await monitor.stop()

        return {
            "success": True,
            "message": "Alert monitor stopped",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error stopping alert monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/monitor/status")
async def get_alert_monitor_status():
    """
    Get alert monitor status.
    """
    try:
        monitor = get_alert_monitor()

        return {
            "running": monitor.running,
            "check_interval_seconds": monitor.check_interval,
            "radar_alert_enabled": monitor.radar_alert_enabled,
            "sniper_alert_enabled": monitor.sniper_alert_enabled,
            "sniper_min_confluence": monitor.sniper_min_confluence,
            "last_check": monitor.state.last_check.isoformat() if monitor.state.last_check else None,
            "last_radar_state": monitor.state.radar_classification,
            "last_sniper_signal": monitor.state.last_sniper_signal,
            "last_sniper_score": monitor.state.last_sniper_score,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting alert monitor status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/monitor/check")
async def force_alert_check():
    """
    Force an immediate alert check (for testing).
    """
    try:
        monitor = get_alert_monitor()

        if not monitor.running:
            # Capture initial state if not running
            await monitor._capture_initial_state()

        await monitor.force_check()

        return {
            "success": True,
            "message": "Alert check completed",
            "last_radar_state": monitor.state.radar_classification,
            "last_sniper_signal": monitor.state.last_sniper_signal,
            "last_sniper_score": monitor.state.last_sniper_score,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error forcing alert check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/monitor/config")
async def configure_alert_monitor(
    check_interval: int = None,
    radar_enabled: bool = None,
    sniper_enabled: bool = None,
    sniper_min_confluence: float = None,
):
    """
    Configure alert monitor settings.
    """
    try:
        monitor = get_alert_monitor()

        if check_interval is not None:
            monitor.check_interval = max(60, check_interval)  # Min 60 seconds
        if radar_enabled is not None:
            monitor.radar_alert_enabled = radar_enabled
        if sniper_enabled is not None:
            monitor.sniper_alert_enabled = sniper_enabled
        if sniper_min_confluence is not None:
            monitor.sniper_min_confluence = max(0, min(5, sniper_min_confluence))

        return {
            "success": True,
            "message": "Alert monitor configured",
            "config": {
                "check_interval_seconds": monitor.check_interval,
                "radar_alert_enabled": monitor.radar_alert_enabled,
                "sniper_alert_enabled": monitor.sniper_alert_enabled,
                "sniper_min_confluence": monitor.sniper_min_confluence,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error configuring alert monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Scheduler Endpoints ===

@router.get("/scheduler/status")
async def get_scheduler_status():
    """
    Get scheduler status and scheduled jobs.
    """
    try:
        scheduler = get_scheduler_service()

        return {
            "running": scheduler.is_running,
            "jobs": scheduler.get_jobs(),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting scheduler status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduler/briefing/schedule")
async def schedule_daily_briefing(
    hour: int = 8,
    minute: int = 0,
    timezone: str = "Europe/Warsaw",
):
    """
    Schedule daily briefing at specified time.

    Args:
        hour: Hour (0-23) in specified timezone
        minute: Minute (0-59)
        timezone: Timezone name (e.g., 'Europe/Warsaw', 'UTC')
    """
    try:
        scheduler = get_scheduler_service()

        if not scheduler.is_running:
            scheduler.start()

        scheduler.add_daily_briefing(hour=hour, minute=minute, timezone=timezone)

        jobs = scheduler.get_jobs()
        briefing_job = next((j for j in jobs if j["id"] == "daily_briefing"), None)

        return {
            "success": True,
            "message": f"Daily briefing scheduled for {hour:02d}:{minute:02d} {timezone}",
            "next_run": briefing_job["next_run"] if briefing_job else None,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error scheduling briefing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scheduler/briefing")
async def remove_daily_briefing():
    """
    Remove scheduled daily briefing.
    """
    try:
        scheduler = get_scheduler_service()
        scheduler.remove_daily_briefing()

        return {
            "success": True,
            "message": "Daily briefing removed",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error removing briefing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduler/briefing/send-now")
async def send_briefing_now():
    """
    Send daily briefing immediately (for testing).
    """
    try:
        scheduler = get_scheduler_service()
        await scheduler.send_briefing_now()

        return {
            "success": True,
            "message": "Briefing sent",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error sending briefing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Custom Alert Config Endpoints ===

@router.get("/alerts/configs", response_model=AlertConfigListResponse)
async def get_alert_configs(
    symbol: str = None,
    enabled_only: bool = False,
    session: AsyncSession = Depends(get_session)
):
    """
    Get all custom alert configurations.
    """
    try:
        query = select(AlertConfig).order_by(desc(AlertConfig.created_at))

        if symbol:
            query = query.where(AlertConfig.symbol == symbol)
        if enabled_only:
            query = query.where(AlertConfig.enabled == True)

        result = await session.execute(query)
        configs = result.scalars().all()

        return AlertConfigListResponse(
            timestamp=datetime.utcnow().isoformat(),
            count=len(configs),
            alerts=[
                AlertConfigResponse(
                    id=c.id,
                    name=c.name,
                    description=c.description,
                    symbol=c.symbol,
                    enabled=c.enabled,
                    alert_type=c.alert_type,
                    threshold_value=c.threshold_value,
                    threshold_operator=c.threshold_operator,
                    timeframe=c.timeframe,
                    conditions=c.conditions,
                    notify_telegram=c.notify_telegram,
                    notify_once=c.notify_once,
                    cooldown_minutes=c.cooldown_minutes,
                    last_triggered=c.last_triggered.isoformat() if c.last_triggered else None,
                    trigger_count=c.trigger_count,
                    created_at=c.created_at.isoformat(),
                    updated_at=c.updated_at.isoformat(),
                )
                for c in configs
            ],
        )

    except Exception as e:
        logger.error(f"Error fetching alert configs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/configs", response_model=AlertConfigResponse)
async def create_alert_config(
    config: AlertConfigCreate,
    session: AsyncSession = Depends(get_session)
):
    """
    Create a new custom alert configuration.
    """
    try:
        alert_config = AlertConfig(
            name=config.name,
            description=config.description,
            symbol=config.symbol,
            alert_type=config.alert_type,
            threshold_value=config.threshold_value,
            threshold_operator=config.threshold_operator,
            timeframe=config.timeframe,
            conditions=config.conditions,
            notify_telegram=config.notify_telegram,
            notify_once=config.notify_once,
            cooldown_minutes=config.cooldown_minutes,
        )

        session.add(alert_config)
        await session.commit()
        await session.refresh(alert_config)

        logger.info(f"Created alert config: {alert_config.name}")

        return AlertConfigResponse(
            id=alert_config.id,
            name=alert_config.name,
            description=alert_config.description,
            symbol=alert_config.symbol,
            enabled=alert_config.enabled,
            alert_type=alert_config.alert_type,
            threshold_value=alert_config.threshold_value,
            threshold_operator=alert_config.threshold_operator,
            timeframe=alert_config.timeframe,
            conditions=alert_config.conditions,
            notify_telegram=alert_config.notify_telegram,
            notify_once=alert_config.notify_once,
            cooldown_minutes=alert_config.cooldown_minutes,
            last_triggered=None,
            trigger_count=0,
            created_at=alert_config.created_at.isoformat(),
            updated_at=alert_config.updated_at.isoformat(),
        )

    except Exception as e:
        logger.error(f"Error creating alert config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/configs/{config_id}", response_model=AlertConfigResponse)
async def get_alert_config(
    config_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Get a specific alert configuration.
    """
    try:
        result = await session.execute(
            select(AlertConfig).where(AlertConfig.id == config_id)
        )
        config = result.scalar_one_or_none()

        if not config:
            raise HTTPException(status_code=404, detail="Alert config not found")

        return AlertConfigResponse(
            id=config.id,
            name=config.name,
            description=config.description,
            symbol=config.symbol,
            enabled=config.enabled,
            alert_type=config.alert_type,
            threshold_value=config.threshold_value,
            threshold_operator=config.threshold_operator,
            timeframe=config.timeframe,
            conditions=config.conditions,
            notify_telegram=config.notify_telegram,
            notify_once=config.notify_once,
            cooldown_minutes=config.cooldown_minutes,
            last_triggered=config.last_triggered.isoformat() if config.last_triggered else None,
            trigger_count=config.trigger_count,
            created_at=config.created_at.isoformat(),
            updated_at=config.updated_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching alert config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/alerts/configs/{config_id}", response_model=AlertConfigResponse)
async def update_alert_config(
    config_id: int,
    update: AlertConfigUpdate,
    session: AsyncSession = Depends(get_session)
):
    """
    Update an alert configuration.
    """
    try:
        result = await session.execute(
            select(AlertConfig).where(AlertConfig.id == config_id)
        )
        config = result.scalar_one_or_none()

        if not config:
            raise HTTPException(status_code=404, detail="Alert config not found")

        # Update fields
        update_data = update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(config, field, value)

        await session.commit()
        await session.refresh(config)

        logger.info(f"Updated alert config: {config.name}")

        return AlertConfigResponse(
            id=config.id,
            name=config.name,
            description=config.description,
            symbol=config.symbol,
            enabled=config.enabled,
            alert_type=config.alert_type,
            threshold_value=config.threshold_value,
            threshold_operator=config.threshold_operator,
            timeframe=config.timeframe,
            conditions=config.conditions,
            notify_telegram=config.notify_telegram,
            notify_once=config.notify_once,
            cooldown_minutes=config.cooldown_minutes,
            last_triggered=config.last_triggered.isoformat() if config.last_triggered else None,
            trigger_count=config.trigger_count,
            created_at=config.created_at.isoformat(),
            updated_at=config.updated_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating alert config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/alerts/configs/{config_id}")
async def delete_alert_config(
    config_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete an alert configuration.
    """
    try:
        result = await session.execute(
            select(AlertConfig).where(AlertConfig.id == config_id)
        )
        config = result.scalar_one_or_none()

        if not config:
            raise HTTPException(status_code=404, detail="Alert config not found")

        await session.delete(config)
        await session.commit()

        logger.info(f"Deleted alert config: {config_id}")

        return {
            "success": True,
            "message": f"Alert config {config_id} deleted",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting alert config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/configs/{config_id}/toggle")
async def toggle_alert_config(
    config_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Toggle an alert configuration's enabled status.
    """
    try:
        result = await session.execute(
            select(AlertConfig).where(AlertConfig.id == config_id)
        )
        config = result.scalar_one_or_none()

        if not config:
            raise HTTPException(status_code=404, detail="Alert config not found")

        config.enabled = not config.enabled
        await session.commit()

        return {
            "success": True,
            "id": config.id,
            "enabled": config.enabled,
            "message": f"Alert '{config.name}' {'enabled' if config.enabled else 'disabled'}",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling alert config: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# === Backtesting Endpoints ===

@router.post("/backtest/run")
async def run_backtest(
    symbol: str = None,
    timeframe: str = "1d",
    lookback_days: int = 365,
    initial_capital: float = 10000,
    entry_radar_min: float = 5.0,
    entry_radar_max: float = 6.0,
    take_profit_pct: float = 5.0,
    stop_loss_pct: float = 2.0,
    direction: str = "LONG",
):
    """
    Run a simple RADAR-based backtest.

    Parameters:
    - symbol: Trading pair (default: BTC/USDT:USDT)
    - timeframe: Candle timeframe (1d, 4h, 1h)
    - lookback_days: How many days of history to test
    - initial_capital: Starting capital in USD
    - entry_radar_min/max: RADAR score range for entry (5-6 = ACCUMULATE)
    - take_profit_pct: Take profit percentage
    - stop_loss_pct: Stop loss percentage
    - direction: LONG, SHORT, or BOTH
    """
    try:
        backtest_service = get_backtest_service()

        result = backtest_service.run_backtest(
            symbol=symbol,
            timeframe=timeframe,
            lookback_days=lookback_days,
            initial_capital=initial_capital,
            entry_radar_min=entry_radar_min,
            entry_radar_max=entry_radar_max,
            take_profit_pct=take_profit_pct,
            stop_loss_pct=stop_loss_pct,
            direction=direction,
        )

        # Convert to dict for JSON response
        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "config": {
                "symbol": result.symbol,
                "timeframe": result.timeframe,
                "start_date": result.start_date,
                "end_date": result.end_date,
                "initial_capital": result.initial_capital,
                "strategy": result.strategy_name,
                "entry_radar_range": [result.entry_radar_min, result.entry_radar_max],
                "take_profit_pct": result.take_profit_pct,
                "stop_loss_pct": result.stop_loss_pct,
                "direction": result.direction,
            },
            "results": {
                "total_trades": result.total_trades,
                "winning_trades": result.winning_trades,
                "losing_trades": result.losing_trades,
                "win_rate": round(result.win_rate, 2),
                "total_pnl": round(result.total_pnl, 2),
                "total_pnl_pct": round(result.total_pnl_pct, 2),
                "final_capital": round(result.final_capital, 2),
                "max_drawdown": round(result.max_drawdown, 2),
                "max_drawdown_pct": round(result.max_drawdown_pct, 2),
                "profit_factor": round(result.profit_factor, 2) if result.profit_factor else None,
                "avg_trade_pnl": round(result.avg_trade_pnl, 2),
                "avg_win": round(result.avg_win, 2) if result.avg_win else None,
                "avg_loss": round(result.avg_loss, 2) if result.avg_loss else None,
            },
            "trades": [
                {
                    "entry_time": t.entry_time,
                    "entry_price": t.entry_price,
                    "direction": t.direction,
                    "entry_reason": t.entry_reason,
                    "exit_time": t.exit_time,
                    "exit_price": t.exit_price,
                    "exit_reason": t.exit_reason,
                    "pnl": round(t.pnl, 2) if t.pnl else None,
                    "pnl_pct": round(t.pnl_pct, 2) if t.pnl_pct else None,
                    "radar_score": t.radar_score,
                }
                for t in result.trades[-50:]  # Last 50 trades
            ],
            "equity_curve": [
                {"date": p["date"], "equity": round(p["equity"], 2)}
                for p in result.equity_curve[-100:]  # Last 100 points
            ],
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error running backtest: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Project Analysis Endpoints ===

@router.post("/project/analyze", response_model=ProjectReportResponse)
async def analyze_project(request: ProjectAnalysisRequest):
    """
    Analyze a crypto project for investment due diligence.

    Provide either a ticker symbol (e.g., "SOL", "ETH") or a project website URL.
    The analysis includes:
    - Team & founders assessment
    - Product/technology evaluation
    - Market & niche analysis
    - Competition landscape
    - Community sentiment
    - Tokenomics review
    - Risk assessment
    - Investment recommendation

    This endpoint uses Perplexity API for research and LLM for synthesis.
    Analysis may take 30-60 seconds to complete.
    """
    if not request.ticker and not request.website:
        raise HTTPException(
            status_code=400,
            detail="Either ticker or website must be provided"
        )

    try:
        analysis_service = get_project_analysis_service()
        report = await analysis_service.analyze_project(
            ticker=request.ticker,
            website=request.website,
            send_alert=getattr(request, 'send_alert', False),
        )

        # Convert dataclass to dict for Pydantic response
        report_dict = analysis_service.report_to_dict(report)
        return ProjectReportResponse(**report_dict)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error analyzing project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/project/analyze/{ticker}", response_model=ProjectReportResponse)
async def analyze_project_by_ticker(ticker: str, send_alert: bool = False):
    """
    Analyze a crypto project by ticker symbol.

    Shortcut endpoint for ticker-based analysis.
    Example: GET /api/project/analyze/SOL
    Add ?send_alert=true to send notification to n8n
    """
    try:
        analysis_service = get_project_analysis_service()
        report = await analysis_service.analyze_project(
            ticker=ticker,
            send_alert=send_alert,
        )

        report_dict = analysis_service.report_to_dict(report)
        return ProjectReportResponse(**report_dict)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error analyzing project {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/project/analyze/pdf")
async def analyze_project_pdf(request: ProjectAnalysisRequest):
    """
    Analyze a crypto project and return a PDF report.

    Same as /project/analyze but returns a downloadable PDF file.
    """
    if not request.ticker and not request.website:
        raise HTTPException(
            status_code=400,
            detail="Either ticker or website must be provided"
        )

    try:
        analysis_service = get_project_analysis_service()
        report = await analysis_service.analyze_project(
            ticker=request.ticker,
            website=request.website,
        )

        # Generate PDF
        pdf_bytes = generate_pdf_report(report)

        # Return PDF as downloadable file
        filename = f"{report.ticker}_analysis_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating PDF report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/project/report/{ticker}/pdf")
async def get_project_pdf_by_ticker(ticker: str):
    """
    Analyze a crypto project by ticker and download PDF report.

    Example: GET /api/project/report/SOL/pdf
    """
    try:
        analysis_service = get_project_analysis_service()
        report = await analysis_service.analyze_project(ticker=ticker)

        # Generate PDF
        pdf_bytes = generate_pdf_report(report)

        # Return PDF as downloadable file
        filename = f"{report.ticker}_analysis_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating PDF report for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === n8n Webhook Integration ===

@router.post("/webhook/n8n/analyze")
async def n8n_analyze_project(
    ticker: str = None,
    website: str = None,
    send_alert: bool = True,
):
    """
    Webhook endpoint for n8n automation.

    Accepts project ticker or website and returns analysis report.
    Designed for integration with n8n workflows.

    Example n8n HTTP Request node configuration:
    - Method: POST
    - URL: http://your-server:8000/api/webhook/n8n/analyze?ticker=SOL
    - Or with body: {"ticker": "SOL"} or {"website": "https://solana.com"}

    By default, sends an alert to the configured n8n alert webhook.
    """
    if not ticker and not website:
        raise HTTPException(
            status_code=400,
            detail="Either ticker or website query parameter must be provided"
        )

    try:
        analysis_service = get_project_analysis_service()
        report = await analysis_service.analyze_project(
            ticker=ticker,
            website=website,
            send_alert=send_alert,
        )

        report_dict = analysis_service.report_to_dict(report)

        # Return formatted response for n8n
        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "project": {
                "ticker": report.ticker,
                "name": report.name,
                "overall_score": report.overall_score,
                "recommendation": report.recommendation.recommendation,
                "confidence": report.recommendation.confidence,
            },
            "summary": report.recommendation.summary,
            "key_catalysts": report.recommendation.key_catalysts,
            "key_concerns": report.recommendation.key_concerns,
            "full_report": report_dict,
        }

    except ValueError as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"n8n webhook error: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.post("/webhook/n8n/quick-score")
async def n8n_quick_score(ticker: str):
    """
    Quick project score for n8n automation.

    Returns only the essential scoring data without full analysis.
    Faster response for quick filtering in n8n workflows.
    """
    try:
        analysis_service = get_project_analysis_service()

        # Get CoinGecko data for quick assessment
        cg_data = await analysis_service.get_coingecko_data(ticker)

        if "error" in cg_data:
            return {
                "success": False,
                "ticker": ticker,
                "error": cg_data["error"],
                "timestamp": datetime.utcnow().isoformat(),
            }

        market_data = cg_data.get("market_data", {})
        community = cg_data.get("community_data", {})
        developer = cg_data.get("developer_data", {})

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "ticker": ticker.upper(),
            "name": cg_data.get("name"),
            "price": market_data.get("current_price"),
            "market_cap": market_data.get("market_cap"),
            "price_change_24h": market_data.get("price_change_24h"),
            "price_change_7d": market_data.get("price_change_7d"),
            "price_change_30d": market_data.get("price_change_30d"),
            "ath_change_pct": market_data.get("ath_change_percentage"),
            "twitter_followers": community.get("twitter_followers"),
            "github_commits_4w": developer.get("commit_count_4_weeks"),
            "sentiment_up": cg_data.get("sentiment_votes_up"),
            "categories": cg_data.get("categories", []),
        }

    except Exception as e:
        logger.error(f"Quick score error for {ticker}: {e}")
        return {
            "success": False,
            "ticker": ticker,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


# =============================================================================
# ICT SIGNAL ENDPOINTS
# =============================================================================


@router.get("/ict/signals")
async def get_ict_signals(
    symbol: str = Query(default=None, description="Trading symbol"),
    ltf: str = Query(default="15m", description="Lower timeframe"),
    htf: str = Query(default="4h", description="Higher timeframe"),
):
    """
    Get current ICT trading signals.

    Analyzes the market using ICT methodology:
    - HTF bias from 4H structure
    - Liquidity sweep detection
    - Displacement confirmation
    - AMD pattern recognition
    - Entry zones (FVG/OB/IFVG)

    Returns actionable signals with entry, stop loss, and take profit levels.
    """
    try:
        from calculations.ict_signals import analyze_ict_setup

        # Get symbol
        target_symbol = symbol or settings.default_symbol
        exchange = get_exchange_client()

        # Fetch LTF data
        ltf_data = await exchange.fetch_ohlcv(target_symbol, ltf, limit=200)

        # Fetch HTF data
        htf_data = await exchange.fetch_ohlcv(target_symbol, htf, limit=100)

        # Get current price
        price_data = await exchange.fetch_current_price(target_symbol)
        current_price = price_data.get("last", ltf_data[-1]["close"] if ltf_data else 0)

        # Analyze ICT setup
        result = analyze_ict_setup(
            ltf_ohlcv=ltf_data,
            htf_ohlcv=htf_data,
            current_price=current_price,
            timeframe=ltf,
        )

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": target_symbol,
            "timeframes": {"ltf": ltf, "htf": htf},
            **result,
        }

    except Exception as e:
        logger.error(f"ICT signals error: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get("/ict/amd")
async def get_amd_pattern(
    symbol: str = Query(default=None, description="Trading symbol"),
    timeframe: str = Query(default="15m", description="Timeframe"),
):
    """
    Get current AMD (Accumulation-Manipulation-Distribution) pattern state.

    Returns the current phase of the AMD cycle:
    - ACCUMULATION: Consolidation, waiting for manipulation
    - MANIPULATION: Liquidity sweep in progress
    - DISTRIBUTION: Reversal confirmed, entry opportunity
    - NONE: No pattern detected
    """
    try:
        from calculations.amd import analyze_amd
        from calculations.structure import analyze_structure
        from calculations.zones import analyze_zones, Zone

        target_symbol = symbol or settings.default_symbol
        exchange = get_exchange_client()

        # Fetch data
        ohlcv_data = await exchange.fetch_ohlcv(target_symbol, timeframe, limit=200)

        # Get HTF bias
        htf_data = await exchange.fetch_ohlcv(target_symbol, "4h", limit=100)
        htf_structure = analyze_structure(htf_data, "4h")
        htf_bias = htf_structure.get("bias", "NEUTRAL")

        # Get HTF zones
        htf_zones = []
        htf_zone_analysis = analyze_zones(htf_data)
        for z in htf_zone_analysis.get("fvgs", []) + htf_zone_analysis.get("order_blocks", []):
            htf_zones.append(Zone(
                zone_type=z["type"],
                high=z["high"],
                low=z["low"],
                formed_at=datetime.utcnow(),
                formed_index=0,
            ))

        # Get current price
        price_data = await exchange.fetch_current_price(target_symbol)
        current_price = price_data.get("last", ohlcv_data[-1]["close"])

        # Analyze AMD
        result = analyze_amd(ohlcv_data, htf_bias, htf_zones, current_price)

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": target_symbol,
            "timeframe": timeframe,
            **result,
        }

    except Exception as e:
        logger.error(f"AMD pattern error: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get("/ict/liquidity")
async def get_liquidity_analysis(
    symbol: str = Query(default=None, description="Trading symbol"),
    timeframe: str = Query(default="15m", description="Timeframe"),
):
    """
    Get liquidity analysis.

    Returns:
    - Recent liquidity sweeps (price taking out stops and rejecting)
    - Untouched liquidity pools (potential targets)
    """
    try:
        from calculations.liquidity import analyze_liquidity

        target_symbol = symbol or settings.default_symbol
        exchange = get_exchange_client()

        # Fetch data
        ohlcv_data = await exchange.fetch_ohlcv(target_symbol, timeframe, limit=200)

        # Get current price
        price_data = await exchange.fetch_current_price(target_symbol)
        current_price = price_data.get("last", ohlcv_data[-1]["close"])

        # Analyze liquidity
        result = analyze_liquidity(ohlcv_data, current_price)

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": target_symbol,
            "timeframe": timeframe,
            **result,
        }

    except Exception as e:
        logger.error(f"Liquidity analysis error: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get("/ict/displacement")
async def get_displacement_analysis(
    symbol: str = Query(default=None, description="Trading symbol"),
    timeframe: str = Query(default="15m", description="Timeframe"),
):
    """
    Get displacement candle analysis.

    Displacement candles indicate strong momentum:
    - Large body relative to range (>70%)
    - Unusual range (>1.5x ATR)
    - Often creates FVG
    """
    try:
        from calculations.displacement import analyze_displacement

        target_symbol = symbol or settings.default_symbol
        exchange = get_exchange_client()

        # Fetch data
        ohlcv_data = await exchange.fetch_ohlcv(target_symbol, timeframe, limit=200)

        # Get current price
        price_data = await exchange.fetch_current_price(target_symbol)
        current_price = price_data.get("last", ohlcv_data[-1]["close"])

        # Analyze displacement
        result = analyze_displacement(ohlcv_data, current_price)

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": target_symbol,
            "timeframe": timeframe,
            **result,
        }

    except Exception as e:
        logger.error(f"Displacement analysis error: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get("/ict/session")
async def get_session_info_endpoint():
    """
    Get current trading session information.

    Returns:
    - Current session (ASIAN, LONDON, NY, etc.)
    - Whether in a killzone (high probability window)
    - Next killzone timing
    """
    try:
        from calculations.sessions import get_session_info, get_next_killzone

        session = get_session_info()
        next_kz = get_next_killzone()

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            **session,
            "next_killzone": next_kz,
        }

    except Exception as e:
        logger.error(f"Session info error: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }
