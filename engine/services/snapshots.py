"""
Hourly RADAR/bias history snapshots.

Seeds the previously writer-less RadarSnapshot/BiasRecord tables so history
surfaces (Overview sparkline, future analytics) have data to render. Budget:
per hour = len(available_symbols) × (len(radar_timeframes) RadarSnapshot rows
+ len(timeframes) BiasRecord rows) — with defaults 10 × (2 + 4) = 60 rows/hour,
~130k rows over the 90-day retention window (a few MB in SQLite).

Guarantees:
- per-symbol failure isolation (one dead symbol never blocks the rest),
- dedup: at most one row per (asset, timeframe, table) per clock hour, so
  restarts/misfire coalescing can't double-write,
- retention: rows older than RETENTION_DAYS deleted in bounded batches.
"""
from datetime import datetime, timedelta

from loguru import logger
from sqlalchemy import delete, func, select

from calculations.radar import calculate_full_radar
from calculations.structure import analyze_structure
from config import settings
from data.exchange import get_exchange_client
from database import async_session_maker
from models import BiasRecord, RadarSnapshot

RETENTION_DAYS = 90
RETENTION_BATCH = 1000


async def take_history_snapshots() -> dict:
    """Snapshot RADAR + bias for every configured symbol. Returns counters."""
    exchange = get_exchange_client()
    now = datetime.utcnow()
    hour_start = now.replace(minute=0, second=0, microsecond=0)
    radar_written = 0
    bias_written = 0
    failed_symbols: list[str] = []

    async with async_session_maker() as session:
        for symbol in settings.available_symbols:
            try:
                funding_rate = (
                    exchange.fetch_funding_rate(symbol).get("funding_rate", 0) or 0
                )

                # RADAR snapshots on the macro timeframes
                for tf in settings.radar_timeframes:
                    display_tf = exchange.get_display_timeframe(tf)
                    exists = await session.scalar(
                        select(func.count())
                        .select_from(RadarSnapshot)
                        .where(
                            RadarSnapshot.asset == symbol,
                            RadarSnapshot.timeframe == display_tf,
                            RadarSnapshot.timestamp >= hour_start,
                        )
                    )
                    if exists:
                        continue
                    ohlcv = exchange.fetch_ohlcv(symbol=symbol, timeframe=tf, limit=300)
                    radar = calculate_full_radar(ohlcv, funding_rate)
                    if radar.get("error"):
                        continue
                    metrics = radar.get("metrics", {}) or {}
                    session.add(
                        RadarSnapshot(
                            timestamp=now,
                            timeframe=display_tf,
                            asset=symbol,
                            radar_score=radar.get("score", 3.0),
                            classification=radar.get("classification", "NEUTRAL"),
                            bbwp_value=(metrics.get("bbwp") or {}).get("bbwp"),
                            bbwp_signal=(metrics.get("bbwp") or {}).get("signal"),
                            gaussian_signal=(metrics.get("gaussian") or {}).get("signal"),
                            gaussian_position=(metrics.get("gaussian") or {}).get(
                                "position_pct"
                            ),
                            wvf_value=(metrics.get("wvf") or {}).get("wvf"),
                            wvf_signal=(metrics.get("wvf") or {}).get("signal"),
                            funding_rate=funding_rate,
                            funding_signal=(metrics.get("funding") or {}).get("signal"),
                        )
                    )
                    radar_written += 1

                # Structural bias on the trading timeframes
                current_price = (
                    exchange.get_current_price(symbol).get("price", 0) or 0
                )
                for tf in settings.timeframes:
                    display_tf = exchange.get_display_timeframe(tf)
                    exists = await session.scalar(
                        select(func.count())
                        .select_from(BiasRecord)
                        .where(
                            BiasRecord.asset == symbol,
                            BiasRecord.timeframe == display_tf,
                            BiasRecord.timestamp >= hour_start,
                        )
                    )
                    if exists:
                        continue
                    ohlcv = exchange.fetch_ohlcv(symbol=symbol, timeframe=tf, limit=300)
                    structure = analyze_structure(ohlcv, tf, current_price)
                    ss = structure.get("secondary_swing", {}) or {}
                    session.add(
                        BiasRecord(
                            timestamp=now,
                            timeframe=display_tf,
                            asset=symbol,
                            structural_bias=structure.get("bias", "NEUTRAL"),
                            secondary_swing_level=ss.get("price"),
                            ss_distance_pct=ss.get("distance_pct"),
                            last_swing_high=structure.get("last_swing_high"),
                            last_swing_low=structure.get("last_swing_low"),
                            swing_structure=structure.get("structure"),
                        )
                    )
                    bias_written += 1

                await session.commit()
            except Exception as e:
                await session.rollback()
                failed_symbols.append(symbol)
                logger.warning(f"History snapshot failed for {symbol}: {e}")

        # Retention — bounded batches so one pass never locks the DB for long.
        cutoff = now - timedelta(days=RETENTION_DAYS)
        deleted = 0
        try:
            for model in (RadarSnapshot, BiasRecord):
                while True:
                    old_ids = (
                        await session.scalars(
                            select(model.id)
                            .where(model.timestamp < cutoff)
                            .limit(RETENTION_BATCH)
                        )
                    ).all()
                    if not old_ids:
                        break
                    await session.execute(delete(model).where(model.id.in_(old_ids)))
                    await session.commit()
                    deleted += len(old_ids)
                    if len(old_ids) < RETENTION_BATCH:
                        break
        except Exception as e:
            await session.rollback()
            logger.warning(f"Snapshot retention pass failed: {e}")

    result = {
        "radar_written": radar_written,
        "bias_written": bias_written,
        "failed_symbols": failed_symbols,
        "deleted": deleted,
    }
    logger.info(f"History snapshots: {result}")
    return result
