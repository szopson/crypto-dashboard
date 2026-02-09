"""
SQLAlchemy ORM models for Trading Command Center.
"""
from datetime import datetime
from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class BiasRecord(Base):
    """
    Historical bias records for each timeframe.
    Stores structural bias, SS level, and RADAR metrics.
    """
    __tablename__ = "bias_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)  # 1H, 4H, 1D, etc.
    asset: Mapped[str] = mapped_column(String(20), default="BTC")

    # Structural bias
    structural_bias: Mapped[str] = mapped_column(String(20), nullable=False)  # BULLISH, BEARISH, NEUTRAL
    secondary_swing_level: Mapped[float] = mapped_column(Float, nullable=True)
    ss_distance_pct: Mapped[float] = mapped_column(Float, nullable=True)
    last_swing_high: Mapped[float] = mapped_column(Float, nullable=True)
    last_swing_low: Mapped[float] = mapped_column(Float, nullable=True)
    swing_structure: Mapped[str] = mapped_column(String(20), nullable=True)  # HH_HL, LH_LL, etc.

    # RADAR metrics (for 1D, 1W, 1M)
    radar_score: Mapped[float] = mapped_column(Float, nullable=True)
    bbwp_value: Mapped[float] = mapped_column(Float, nullable=True)
    bbwp_signal: Mapped[str] = mapped_column(String(20), nullable=True)
    gaussian_signal: Mapped[str] = mapped_column(String(20), nullable=True)
    wvf_signal: Mapped[str] = mapped_column(String(20), nullable=True)
    funding_rate: Mapped[float] = mapped_column(Float, nullable=True)
    funding_signal: Mapped[str] = mapped_column(String(20), nullable=True)

    # Combined
    combined_bias: Mapped[str] = mapped_column(String(20), nullable=True)
    confidence: Mapped[str] = mapped_column(String(20), nullable=True)  # HIGH, MEDIUM, LOW

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RadarSnapshot(Base):
    """
    RADAR metrics snapshot for each calculation.
    Stores full RADAR analysis results.
    """
    __tablename__ = "radar_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    asset: Mapped[str] = mapped_column(String(20), default="BTC")

    # RADAR score
    radar_score: Mapped[float] = mapped_column(Float, nullable=False)
    classification: Mapped[str] = mapped_column(String(20), nullable=False)  # ACCUMULATE, NEUTRAL, SELL_THE_RALLY

    # Individual metrics
    bbwp_value: Mapped[float] = mapped_column(Float, nullable=True)
    bbwp_signal: Mapped[str] = mapped_column(String(20), nullable=True)
    gaussian_signal: Mapped[str] = mapped_column(String(20), nullable=True)
    gaussian_position: Mapped[float] = mapped_column(Float, nullable=True)
    wvf_value: Mapped[float] = mapped_column(Float, nullable=True)
    wvf_signal: Mapped[str] = mapped_column(String(20), nullable=True)
    funding_rate: Mapped[float] = mapped_column(Float, nullable=True)
    funding_signal: Mapped[str] = mapped_column(String(20), nullable=True)

    # Full metrics JSON
    metrics_json: Mapped[dict] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PriceSnapshot(Base):
    """
    Price snapshots for tracking.
    """
    __tablename__ = "price_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    asset: Mapped[str] = mapped_column(String(20), default="BTC")
    price: Mapped[float] = mapped_column(Float, nullable=False)
    change_24h: Mapped[float] = mapped_column(Float, nullable=True)
    volume_24h: Mapped[float] = mapped_column(Float, nullable=True)
    funding_rate: Mapped[float] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TradingViewAlert(Base):
    """
    TradingView webhook alerts.
    Stores incoming alerts from TradingView for processing.
    """
    __tablename__ = "tradingview_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Alert info
    alert_name: Mapped[str] = mapped_column(String(100), nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=True)
    action: Mapped[str] = mapped_column(String(20), nullable=True)  # BUY, SELL, ALERT

    # Price info
    price: Mapped[float] = mapped_column(Float, nullable=True)
    close: Mapped[float] = mapped_column(Float, nullable=True)
    open: Mapped[float] = mapped_column(Float, nullable=True)
    high: Mapped[float] = mapped_column(Float, nullable=True)
    low: Mapped[float] = mapped_column(Float, nullable=True)
    volume: Mapped[float] = mapped_column(Float, nullable=True)

    # Custom message
    message: Mapped[str] = mapped_column(Text, nullable=True)

    # Full payload
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Processing status
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Trade(Base):
    """
    Trade journal entries.
    Stores all trade information for tracking and analysis.
    """
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Trade identification
    symbol: Mapped[str] = mapped_column(String(50), default="BTC/USDT:USDT")
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # LONG, SHORT
    status: Mapped[str] = mapped_column(String(20), default="OPEN")  # OPEN, CLOSED, CANCELLED

    # Entry
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    entry_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    entry_zone_type: Mapped[str] = mapped_column(String(30), nullable=True)  # BULLISH_OB, FVG, etc.

    # Position sizing
    position_size: Mapped[float] = mapped_column(Float, nullable=True)  # Size in USD or contracts
    position_size_pct: Mapped[float] = mapped_column(Float, nullable=True)  # % of account
    leverage: Mapped[float] = mapped_column(Float, default=1.0)

    # Risk management
    stop_loss: Mapped[float] = mapped_column(Float, nullable=True)
    take_profit_1: Mapped[float] = mapped_column(Float, nullable=True)
    take_profit_2: Mapped[float] = mapped_column(Float, nullable=True)
    take_profit_3: Mapped[float] = mapped_column(Float, nullable=True)
    risk_reward: Mapped[float] = mapped_column(Float, nullable=True)

    # Exit
    exit_price: Mapped[float] = mapped_column(Float, nullable=True)
    exit_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    exit_reason: Mapped[str] = mapped_column(String(50), nullable=True)  # TP1, TP2, TP3, SL, MANUAL, TRAILING

    # P&L
    realized_pnl: Mapped[float] = mapped_column(Float, nullable=True)  # In USD
    realized_pnl_pct: Mapped[float] = mapped_column(Float, nullable=True)  # % return
    fees: Mapped[float] = mapped_column(Float, nullable=True)

    # Context at entry
    confluence_score: Mapped[float] = mapped_column(Float, nullable=True)
    radar_score: Mapped[float] = mapped_column(Float, nullable=True)
    radar_classification: Mapped[str] = mapped_column(String(30), nullable=True)
    structural_bias: Mapped[str] = mapped_column(String(20), nullable=True)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=True)

    # Notes and tags
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    tags: Mapped[str] = mapped_column(String(200), nullable=True)  # Comma-separated: "swing,trend,ob"
    screenshot_url: Mapped[str] = mapped_column(String(500), nullable=True)

    # Trade result
    outcome: Mapped[str] = mapped_column(String(20), nullable=True)  # WIN, LOSS, BREAKEVEN

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TradeStats(Base):
    """
    Aggregated trade statistics.
    Updated periodically for quick dashboard access.
    """
    __tablename__ = "trade_stats"

    id: Mapped[int] = mapped_column(primary_key=True)
    period: Mapped[str] = mapped_column(String(20), nullable=False)  # ALL, DAILY, WEEKLY, MONTHLY
    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Trade counts
    total_trades: Mapped[int] = mapped_column(Integer, default=0)
    winning_trades: Mapped[int] = mapped_column(Integer, default=0)
    losing_trades: Mapped[int] = mapped_column(Integer, default=0)
    breakeven_trades: Mapped[int] = mapped_column(Integer, default=0)

    # Win rate
    win_rate: Mapped[float] = mapped_column(Float, nullable=True)  # Percentage

    # P&L
    total_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    avg_win: Mapped[float] = mapped_column(Float, nullable=True)
    avg_loss: Mapped[float] = mapped_column(Float, nullable=True)
    largest_win: Mapped[float] = mapped_column(Float, nullable=True)
    largest_loss: Mapped[float] = mapped_column(Float, nullable=True)

    # Risk metrics
    profit_factor: Mapped[float] = mapped_column(Float, nullable=True)  # Gross profit / Gross loss
    avg_risk_reward: Mapped[float] = mapped_column(Float, nullable=True)
    expectancy: Mapped[float] = mapped_column(Float, nullable=True)  # (Win% * AvgWin) - (Loss% * AvgLoss)

    # Streaks
    current_streak: Mapped[int] = mapped_column(Integer, default=0)  # Positive = wins, negative = losses
    max_win_streak: Mapped[int] = mapped_column(Integer, default=0)
    max_loss_streak: Mapped[int] = mapped_column(Integer, default=0)

    # Direction breakdown
    long_trades: Mapped[int] = mapped_column(Integer, default=0)
    short_trades: Mapped[int] = mapped_column(Integer, default=0)
    long_win_rate: Mapped[float] = mapped_column(Float, nullable=True)
    short_win_rate: Mapped[float] = mapped_column(Float, nullable=True)

    # Metadata
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AlertConfig(Base):
    """
    Custom alert configurations.
    Allows users to define their own alert thresholds and conditions.
    """
    __tablename__ = "alert_configs"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Alert identification
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), default="BTC/USDT:USDT")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Alert type
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Types: PRICE_ABOVE, PRICE_BELOW, RADAR_SCORE, FUNDING_RATE, FEAR_GREED, CONFLUENCE_SCORE, CUSTOM

    # Condition parameters
    threshold_value: Mapped[float] = mapped_column(Float, nullable=True)
    threshold_operator: Mapped[str] = mapped_column(String(10), default=">=")  # >=, <=, ==, >, <
    timeframe: Mapped[str] = mapped_column(String(10), nullable=True)  # For timeframe-specific alerts

    # Additional conditions (JSON for flexibility)
    conditions: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Notification settings
    notify_telegram: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_once: Mapped[bool] = mapped_column(Boolean, default=False)  # Only trigger once until reset
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=60)  # Minimum time between alerts

    # State tracking
    last_triggered: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    trigger_count: Mapped[int] = mapped_column(Integer, default=0)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
