"""
Backtesting Service.

Simple backtesting engine for RADAR-based trading strategies.
Supports:
- Historical data replay
- RADAR-based entry signals
- Fixed take profit / stop loss
- Performance metrics calculation
"""
from datetime import datetime, timezone
from typing import Optional, List
from dataclasses import dataclass, field
from loguru import logger

from data.exchange import get_exchange_client
from calculations.radar import calculate_full_radar


@dataclass
class BacktestTrade:
    """Single backtest trade."""
    entry_time: str
    entry_price: float
    direction: str  # LONG or SHORT
    entry_reason: str

    exit_time: Optional[str] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None

    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None
    radar_score: Optional[float] = None


@dataclass
class BacktestResult:
    """Backtest results."""
    # Configuration
    symbol: str
    timeframe: str
    start_date: str
    end_date: str
    initial_capital: float

    # Strategy parameters
    strategy_name: str
    entry_radar_min: float  # Min RADAR score for entry
    entry_radar_max: float  # Max RADAR score for entry
    take_profit_pct: float
    stop_loss_pct: float
    direction: str  # LONG, SHORT, BOTH

    # Results
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0

    total_pnl: float = 0.0
    total_pnl_pct: float = 0.0
    final_capital: float = 0.0

    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0

    profit_factor: Optional[float] = None
    sharpe_ratio: Optional[float] = None

    avg_trade_pnl: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0

    trades: List[BacktestTrade] = field(default_factory=list)
    equity_curve: List[dict] = field(default_factory=list)


class BacktestService:
    """
    Simple backtesting service for RADAR-based strategies.
    """

    def __init__(self):
        self.exchange = get_exchange_client()

    def run_backtest(
        self,
        symbol: str = None,
        timeframe: str = "1d",
        lookback_days: int = 365,
        initial_capital: float = 10000,
        entry_radar_min: float = 5.0,  # ACCUMULATE zone
        entry_radar_max: float = 6.0,
        take_profit_pct: float = 5.0,
        stop_loss_pct: float = 2.0,
        direction: str = "LONG",  # LONG, SHORT, BOTH
    ) -> BacktestResult:
        """
        Run a simple backtest.

        Strategy: Enter when RADAR score is in specified range.
        Exit on take profit or stop loss.
        """
        symbol = symbol or self.exchange.symbol

        logger.info(f"Running backtest for {symbol} on {timeframe}")

        # Fetch historical data
        # For 1d timeframe, 365 days = 365 candles
        candle_limit = lookback_days if timeframe == "1d" else lookback_days * 24

        try:
            ohlcv_data = self.exchange.fetch_ohlcv(
                symbol=symbol,
                timeframe=timeframe,
                limit=min(candle_limit, 1000)  # API limit
            )
        except Exception as e:
            logger.error(f"Error fetching historical data: {e}")
            raise

        if len(ohlcv_data) < 100:
            raise ValueError("Not enough historical data for backtest")

        # Initialize result
        result = BacktestResult(
            symbol=symbol,
            timeframe=timeframe,
            start_date=ohlcv_data[0]['datetime'],
            end_date=ohlcv_data[-1]['datetime'],
            initial_capital=initial_capital,
            strategy_name=f"RADAR_{direction}",
            entry_radar_min=entry_radar_min,
            entry_radar_max=entry_radar_max,
            take_profit_pct=take_profit_pct,
            stop_loss_pct=stop_loss_pct,
            direction=direction,
            final_capital=initial_capital,
        )

        # Simulation state
        capital = initial_capital
        peak_capital = initial_capital
        position = None  # Current position
        equity_history = []

        # Minimum lookback for RADAR calculation
        radar_lookback = 200

        # Iterate through candles (skip first radar_lookback for warm-up)
        for i in range(radar_lookback, len(ohlcv_data)):
            candle = ohlcv_data[i]
            current_price = candle['close']
            current_time = candle['datetime']

            # Get historical slice for RADAR calculation
            historical = ohlcv_data[i - radar_lookback:i + 1]

            # Calculate RADAR (simplified - no funding rate in backtest)
            try:
                radar_result = calculate_full_radar(historical, funding_rate=0)
                radar_score = radar_result.get('score', 3.0)
            except:
                radar_score = 3.0  # Default to neutral

            # Track equity
            unrealized_pnl = 0
            if position:
                if position['direction'] == 'LONG':
                    unrealized_pnl = (current_price - position['entry_price']) / position['entry_price'] * 100
                else:
                    unrealized_pnl = (position['entry_price'] - current_price) / position['entry_price'] * 100

            current_equity = capital * (1 + unrealized_pnl / 100) if position else capital
            equity_history.append({
                'date': current_time,
                'equity': current_equity,
                'price': current_price,
            })

            # Track drawdown
            if current_equity > peak_capital:
                peak_capital = current_equity
            drawdown = (peak_capital - current_equity) / peak_capital * 100
            if drawdown > result.max_drawdown_pct:
                result.max_drawdown_pct = drawdown
                result.max_drawdown = peak_capital - current_equity

            # Check exit conditions if in position
            if position:
                pnl_pct = unrealized_pnl

                exit_reason = None
                if position['direction'] == 'LONG':
                    if pnl_pct >= take_profit_pct:
                        exit_reason = 'TP'
                    elif pnl_pct <= -stop_loss_pct:
                        exit_reason = 'SL'
                else:  # SHORT
                    if pnl_pct >= take_profit_pct:
                        exit_reason = 'TP'
                    elif pnl_pct <= -stop_loss_pct:
                        exit_reason = 'SL'

                if exit_reason:
                    # Close position
                    trade = BacktestTrade(
                        entry_time=position['entry_time'],
                        entry_price=position['entry_price'],
                        direction=position['direction'],
                        entry_reason=position['entry_reason'],
                        exit_time=current_time,
                        exit_price=current_price,
                        exit_reason=exit_reason,
                        pnl=capital * (pnl_pct / 100),
                        pnl_pct=pnl_pct,
                        radar_score=position['radar_score'],
                    )
                    result.trades.append(trade)

                    # Update capital
                    capital = capital * (1 + pnl_pct / 100)

                    # Update stats
                    if pnl_pct > 0:
                        result.winning_trades += 1
                    else:
                        result.losing_trades += 1

                    result.total_pnl += trade.pnl
                    position = None

            # Check entry conditions if not in position
            if not position:
                should_enter_long = (
                    direction in ['LONG', 'BOTH'] and
                    entry_radar_min <= radar_score <= entry_radar_max
                )
                should_enter_short = (
                    direction in ['SHORT', 'BOTH'] and
                    radar_score <= (6 - entry_radar_min)  # Inverse for shorts
                )

                if should_enter_long:
                    position = {
                        'direction': 'LONG',
                        'entry_price': current_price,
                        'entry_time': current_time,
                        'entry_reason': f'RADAR={radar_score:.1f}',
                        'radar_score': radar_score,
                    }
                elif should_enter_short:
                    position = {
                        'direction': 'SHORT',
                        'entry_price': current_price,
                        'entry_time': current_time,
                        'entry_reason': f'RADAR={radar_score:.1f}',
                        'radar_score': radar_score,
                    }

        # Close any remaining position at end
        if position:
            last_candle = ohlcv_data[-1]
            last_price = last_candle['close']
            if position['direction'] == 'LONG':
                pnl_pct = (last_price - position['entry_price']) / position['entry_price'] * 100
            else:
                pnl_pct = (position['entry_price'] - last_price) / position['entry_price'] * 100

            trade = BacktestTrade(
                entry_time=position['entry_time'],
                entry_price=position['entry_price'],
                direction=position['direction'],
                entry_reason=position['entry_reason'],
                exit_time=last_candle['datetime'],
                exit_price=last_price,
                exit_reason='END',
                pnl=capital * (pnl_pct / 100),
                pnl_pct=pnl_pct,
                radar_score=position['radar_score'],
            )
            result.trades.append(trade)
            capital = capital * (1 + pnl_pct / 100)

            if pnl_pct > 0:
                result.winning_trades += 1
            else:
                result.losing_trades += 1
            result.total_pnl += trade.pnl

        # Calculate final metrics
        result.total_trades = len(result.trades)
        result.final_capital = capital
        result.total_pnl_pct = ((capital - initial_capital) / initial_capital) * 100

        if result.total_trades > 0:
            result.win_rate = (result.winning_trades / result.total_trades) * 100
            result.avg_trade_pnl = result.total_pnl / result.total_trades

            wins = [t.pnl for t in result.trades if t.pnl > 0]
            losses = [t.pnl for t in result.trades if t.pnl <= 0]

            if wins:
                result.avg_win = sum(wins) / len(wins)
            if losses:
                result.avg_loss = sum(losses) / len(losses)

            # Profit factor
            gross_profit = sum(wins) if wins else 0
            gross_loss = abs(sum(losses)) if losses else 0
            if gross_loss > 0:
                result.profit_factor = gross_profit / gross_loss

        # Sample equity curve (every 10th point to reduce size)
        result.equity_curve = equity_history[::10]

        logger.info(f"Backtest complete: {result.total_trades} trades, {result.win_rate:.1f}% WR, {result.total_pnl_pct:.2f}% return")

        return result


# Singleton instance
_backtest_service: Optional[BacktestService] = None


def get_backtest_service() -> BacktestService:
    """Get or create BacktestService singleton."""
    global _backtest_service
    if _backtest_service is None:
        _backtest_service = BacktestService()
    return _backtest_service
