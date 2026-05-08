"""
Smart Money Concepts (SMC) Detection Module
============================================

Detektor podstawowych elementów SMC dla danych OHLCV:
- Swing Highs / Swing Lows (pivots)
- BOS (Break of Structure)
- CHoCH (Change of Character)
- FVG (Fair Value Gap)
- Order Blocks (bullish / bearish)
- Liquidity Sweeps (sell-side / buy-side)

Wszystkie detektory pracują na pandas DataFrame z kolumnami:
    ['time', 'open', 'high', 'low', 'close']  (volume opcjonalnie)

Przykład użycia:
    from smc_detector import SMCDetector

    detector = SMCDetector(swing_length=14)
    result = detector.analyze(df_btc_1h)

    print(result.last_choch)
    print(result.active_fvgs)
    print(result.recent_sweeps)
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np


# ============================================================================
# Typy i enumy
# ============================================================================

class Direction(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class StructureEvent(str, Enum):
    BOS = "BOS"      # Break of Structure (continuation)
    CHOCH = "CHoCH"  # Change of Character (reversal)


@dataclass
class SwingPoint:
    """Pojedynczy swing high lub swing low."""
    index: int
    time: Any
    price: float
    is_high: bool  # True = swing high, False = swing low

    def __repr__(self):
        kind = "HIGH" if self.is_high else "LOW"
        return f"Swing{kind}(idx={self.index}, price={self.price:.2f})"


@dataclass
class StructureSignal:
    """BOS lub CHoCH event."""
    index: int
    time: Any
    price: float
    event: StructureEvent
    direction: Direction
    broken_swing: SwingPoint  # poziom który został przebity

    def __repr__(self):
        return f"{self.direction.value.upper()}_{self.event.value}@{self.price:.2f}"


@dataclass
class FairValueGap:
    """Fair Value Gap — 3-świecowa luka."""
    index: int  # indeks świecy środkowej (impulsywnej)
    time: Any
    direction: Direction
    top: float
    bottom: float
    mitigated: bool = False  # czy cena wypełniła FVG
    mitigation_index: Optional[int] = None

    @property
    def midpoint(self) -> float:
        return (self.top + self.bottom) / 2

    @property
    def size(self) -> float:
        return self.top - self.bottom


@dataclass
class OrderBlock:
    """Order Block — ostatnia świeca przed silnym ruchem przeciwnym."""
    index: int
    time: Any
    direction: Direction  # bullish OB = ostatnia bearish świeca przed up move
    high: float
    low: float
    mitigated: bool = False
    mitigation_index: Optional[int] = None

    @property
    def midpoint(self) -> float:
        return (self.high + self.low) / 2


@dataclass
class LiquiditySweep:
    """Liquidity sweep — przebicie i powrót przez swing high/low."""
    index: int
    time: Any
    swept_swing: SwingPoint  # który swing został zsweepowany
    direction: Direction  # BULLISH = sell-side sweep (poniżej low) → potencjalny long
    extreme_price: float  # najdalszy punkt sweep'u

    def __repr__(self):
        side = "sell-side" if self.direction == Direction.BULLISH else "buy-side"
        return f"Sweep({side}, swept={self.swept_swing.price:.2f}, ext={self.extreme_price:.2f})"


@dataclass
class SMCAnalysis:
    """Wynik kompletnej analizy SMC dla DataFrame."""
    swings: List[SwingPoint] = field(default_factory=list)
    structure_events: List[StructureSignal] = field(default_factory=list)
    fvgs: List[FairValueGap] = field(default_factory=list)
    order_blocks: List[OrderBlock] = field(default_factory=list)
    sweeps: List[LiquiditySweep] = field(default_factory=list)
    htf_trend: Direction = Direction.NEUTRAL

    # convenience accessors
    @property
    def last_choch(self) -> Optional[StructureSignal]:
        chochs = [e for e in self.structure_events if e.event == StructureEvent.CHOCH]
        return chochs[-1] if chochs else None

    @property
    def last_bos(self) -> Optional[StructureSignal]:
        boss = [e for e in self.structure_events if e.event == StructureEvent.BOS]
        return boss[-1] if boss else None

    @property
    def active_fvgs(self) -> List[FairValueGap]:
        return [f for f in self.fvgs if not f.mitigated]

    @property
    def active_order_blocks(self) -> List[OrderBlock]:
        return [ob for ob in self.order_blocks if not ob.mitigated]

    @property
    def recent_sweeps(self) -> List[LiquiditySweep]:
        """Sweeps z ostatnich 24 świec (zakładamy że to ~24h dla 1H data)."""
        if not self.sweeps:
            return []
        latest_idx = max(s.index for s in self.sweeps)
        return [s for s in self.sweeps if s.index >= latest_idx - 24]


# ============================================================================
# Detektor
# ============================================================================

class SMCDetector:
    """
    Główny detektor SMC.

    Parametry:
        swing_length: ile świec po obu stronach pivota (default 14, jak Flux Charts)
        fvg_min_size_pct: minimalny rozmiar FVG jako % ceny (filtruje szum)
        sweep_lookback: ile świec wstecz szukać sweeped swings
        sweep_max_age: max wiek sweeped swing w świecach (żeby brać świeże poziomy)
    """

    def __init__(
        self,
        swing_length: int = 14,
        fvg_min_size_pct: float = 0.0005,  # 0.05% — filtruje mikro-FVG
        sweep_lookback: int = 5,
        sweep_max_age: int = 200,
    ):
        self.swing_length = swing_length
        self.fvg_min_size_pct = fvg_min_size_pct
        self.sweep_lookback = sweep_lookback
        self.sweep_max_age = sweep_max_age

    # ------------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------------

    def analyze(self, df: pd.DataFrame) -> SMCAnalysis:
        """Pełna analiza DataFrame OHLC. Zwraca SMCAnalysis."""
        self._validate_df(df)

        result = SMCAnalysis()
        result.swings = self.detect_swings(df)
        result.structure_events = self.detect_structure_events(df, result.swings)
        result.fvgs = self.detect_fvgs(df)
        result.order_blocks = self.detect_order_blocks(df, result.structure_events)
        result.sweeps = self.detect_liquidity_sweeps(df, result.swings)
        result.htf_trend = self.classify_htf_trend(df, result.swings)

        return result

    # ------------------------------------------------------------------------
    # Swing detection (pivots)
    # ------------------------------------------------------------------------

    def detect_swings(self, df: pd.DataFrame) -> List[SwingPoint]:
        """
        Wykrywa swing highs i swing lows używając pivot logic:
        świeca jest swing high jeśli jej high jest wyższe niż high
        N świec po obu stronach (N = swing_length).
        """
        n = self.swing_length
        swings: List[SwingPoint] = []

        if len(df) < 2 * n + 1:
            return swings

        highs = df['high'].values
        lows = df['low'].values
        times = df['time'].values if 'time' in df.columns else df.index.values

        for i in range(n, len(df) - n):
            window_high = highs[i - n: i + n + 1]
            window_low = lows[i - n: i + n + 1]

            if highs[i] == window_high.max() and (window_high == highs[i]).sum() == 1:
                swings.append(SwingPoint(
                    index=i, time=times[i], price=float(highs[i]), is_high=True
                ))

            if lows[i] == window_low.min() and (window_low == lows[i]).sum() == 1:
                swings.append(SwingPoint(
                    index=i, time=times[i], price=float(lows[i]), is_high=False
                ))

        swings.sort(key=lambda s: s.index)
        return swings

    # ------------------------------------------------------------------------
    # Structure events (BOS / CHoCH)
    # ------------------------------------------------------------------------

    def detect_structure_events(
        self,
        df: pd.DataFrame,
        swings: List[SwingPoint]
    ) -> List[StructureSignal]:
        """
        BOS = przebicie najnowszego swing high (bull) / low (bear) ZGODNE z trendem.
        CHoCH = przebicie najnowszego swing high (po downtrendzie) / low (po uptrendzie)
                — czyli zmiana charakteru.

        Algorytm:
        - Iteruje po świecach po pierwszych N (gdzie mamy stabilne swingi).
        - Tracking: aktualny "trend bias" (BULL/BEAR/NEUTRAL).
        - Dla każdej świecy sprawdza czy close przebił najnowszy unbroken swing.
        - Jeśli przebicie zgodne z biasem → BOS, ten swing usuwany z listy.
        - Jeśli przebicie przeciwne do biasu → CHoCH + flip biasu.
        """
        events: List[StructureSignal] = []
        if not swings or len(df) < 2 * self.swing_length + 1:
            return events

        closes = df['close'].values
        times = df['time'].values if 'time' in df.columns else df.index.values

        # Trend bias zaczyna jako neutral; ustalamy go po pierwszych dwóch swingach
        bias: Direction = Direction.NEUTRAL

        # "Aktywne" swingi to te jeszcze nieprzebite — od najnowszego idziemy w głąb
        # Każdy swing ma flag "broken"
        swing_states = [(s, False) for s in swings]  # list of (swing, broken)

        # Inicjalna ocena biasu na podstawie pierwszych 2 swingów
        if len(swings) >= 2:
            first, second = swings[0], swings[1]
            if first.is_high and not second.is_high:
                bias = Direction.BEARISH if second.price < first.price else Direction.BULLISH
            elif not first.is_high and second.is_high:
                bias = Direction.BULLISH if second.price > first.price else Direction.BEARISH

        for i in range(self.swing_length + 1, len(df)):
            current_close = closes[i]
            current_time = times[i]

            # Znajdź najnowszy unbroken swing high / low PRZED tą świecą
            unbroken_high = None
            unbroken_low = None
            for j in range(len(swing_states) - 1, -1, -1):
                s, broken = swing_states[j]
                if broken or s.index >= i:
                    continue
                if s.is_high and unbroken_high is None:
                    unbroken_high = (j, s)
                if not s.is_high and unbroken_low is None:
                    unbroken_low = (j, s)
                if unbroken_high and unbroken_low:
                    break

            # Sprawdź break-up
            if unbroken_high is not None:
                j, sh = unbroken_high
                if current_close > sh.price:
                    if bias == Direction.BULLISH:
                        events.append(StructureSignal(
                            index=i, time=current_time, price=current_close,
                            event=StructureEvent.BOS, direction=Direction.BULLISH,
                            broken_swing=sh
                        ))
                    else:
                        # przebicie HIGH gdy bias bearish/neutral = CHoCH bullish
                        events.append(StructureSignal(
                            index=i, time=current_time, price=current_close,
                            event=StructureEvent.CHOCH, direction=Direction.BULLISH,
                            broken_swing=sh
                        ))
                        bias = Direction.BULLISH
                    swing_states[j] = (sh, True)
                    continue  # jedna świeca = jeden event

            # Sprawdź break-down
            if unbroken_low is not None:
                j, sl = unbroken_low
                if current_close < sl.price:
                    if bias == Direction.BEARISH:
                        events.append(StructureSignal(
                            index=i, time=current_time, price=current_close,
                            event=StructureEvent.BOS, direction=Direction.BEARISH,
                            broken_swing=sl
                        ))
                    else:
                        events.append(StructureSignal(
                            index=i, time=current_time, price=current_close,
                            event=StructureEvent.CHOCH, direction=Direction.BEARISH,
                            broken_swing=sl
                        ))
                        bias = Direction.BEARISH
                    swing_states[j] = (sl, True)

        return events

    # ------------------------------------------------------------------------
    # FVG (Fair Value Gap)
    # ------------------------------------------------------------------------

    def detect_fvgs(self, df: pd.DataFrame) -> List[FairValueGap]:
        """
        Bullish FVG: świeca[i+1].low > świeca[i-1].high (luka w górę między 1. a 3. świecą)
        Bearish FVG: świeca[i+1].high < świeca[i-1].low (luka w dół)

        Środkowa świeca (i) to świeca impulsywna.
        FVG jest "mitigated" gdy późniejsza cena wraca do strefy.
        """
        fvgs: List[FairValueGap] = []
        if len(df) < 3:
            return fvgs

        highs = df['high'].values
        lows = df['low'].values
        closes = df['close'].values
        times = df['time'].values if 'time' in df.columns else df.index.values

        for i in range(1, len(df) - 1):
            prev_high, prev_low = highs[i - 1], lows[i - 1]
            next_high, next_low = highs[i + 1], lows[i + 1]
            current_price = closes[i]

            # Bullish FVG: gap pomiędzy prev_high a next_low
            if next_low > prev_high:
                size = next_low - prev_high
                if size / current_price >= self.fvg_min_size_pct:
                    fvg = FairValueGap(
                        index=i, time=times[i],
                        direction=Direction.BULLISH,
                        top=float(next_low),
                        bottom=float(prev_high),
                    )
                    self._check_fvg_mitigation(fvg, df, start_idx=i + 2)
                    fvgs.append(fvg)

            # Bearish FVG: gap pomiędzy next_high a prev_low
            elif next_high < prev_low:
                size = prev_low - next_high
                if size / current_price >= self.fvg_min_size_pct:
                    fvg = FairValueGap(
                        index=i, time=times[i],
                        direction=Direction.BEARISH,
                        top=float(prev_low),
                        bottom=float(next_high),
                    )
                    self._check_fvg_mitigation(fvg, df, start_idx=i + 2)
                    fvgs.append(fvg)

        return fvgs

    def _check_fvg_mitigation(self, fvg: FairValueGap, df: pd.DataFrame, start_idx: int):
        """Sprawdza czy cena wróciła do FVG (touch midpoint = mitigated)."""
        if start_idx >= len(df):
            return
        highs = df['high'].values[start_idx:]
        lows = df['low'].values[start_idx:]
        for offset, (h, l) in enumerate(zip(highs, lows)):
            if l <= fvg.midpoint <= h:
                fvg.mitigated = True
                fvg.mitigation_index = start_idx + offset
                return

    # ------------------------------------------------------------------------
    # Order Blocks
    # ------------------------------------------------------------------------

    def detect_order_blocks(
        self,
        df: pd.DataFrame,
        structure_events: List[StructureSignal]
    ) -> List[OrderBlock]:
        """
        Order Block = ostatnia świeca przeciwna PRZED ruchem który zrobił BOS/CHoCH.

        Bullish OB: ostatnia bearish (czerwona) świeca przed bullish BOS/CHoCH.
        Bearish OB: ostatnia bullish (zielona) świeca przed bearish BOS/CHoCH.

        Mitigation: cena wraca do strefy OB.
        """
        obs: List[OrderBlock] = []
        if not structure_events:
            return obs

        opens = df['open'].values
        closes = df['close'].values
        highs = df['high'].values
        lows = df['low'].values
        times = df['time'].values if 'time' in df.columns else df.index.values

        for ev in structure_events:
            # cofamy się od indeksu eventu i szukamy ostatniej świecy przeciwnej
            search_end = ev.index
            search_start = max(0, ev.index - 30)  # max 30 świec wstecz

            ob_idx = None
            if ev.direction == Direction.BULLISH:
                # szukamy ostatniej bearish świecy (close < open)
                for j in range(search_end - 1, search_start - 1, -1):
                    if closes[j] < opens[j]:
                        ob_idx = j
                        break
            else:
                # szukamy ostatniej bullish świecy
                for j in range(search_end - 1, search_start - 1, -1):
                    if closes[j] > opens[j]:
                        ob_idx = j
                        break

            if ob_idx is None:
                continue

            ob = OrderBlock(
                index=ob_idx,
                time=times[ob_idx],
                direction=ev.direction,
                high=float(highs[ob_idx]),
                low=float(lows[ob_idx]),
            )
            self._check_ob_mitigation(ob, df, start_idx=ev.index + 1)
            obs.append(ob)

        return obs

    def _check_ob_mitigation(self, ob: OrderBlock, df: pd.DataFrame, start_idx: int):
        if start_idx >= len(df):
            return
        highs = df['high'].values[start_idx:]
        lows = df['low'].values[start_idx:]
        for offset, (h, l) in enumerate(zip(highs, lows)):
            if l <= ob.midpoint <= h:
                ob.mitigated = True
                ob.mitigation_index = start_idx + offset
                return

    # ------------------------------------------------------------------------
    # Liquidity Sweeps
    # ------------------------------------------------------------------------

    def detect_liquidity_sweeps(
        self,
        df: pd.DataFrame,
        swings: List[SwingPoint]
    ) -> List[LiquiditySweep]:
        """
        Liquidity Sweep = świeca której:
          - high przebija ostatni swing high (buy-side sweep), ALE
          - close wraca z powrotem POD ten swing high
        Lustrzanie dla sell-side.

        To klasyczny stop hunt: cena bierze płynność i wraca.
        """
        sweeps: List[LiquiditySweep] = []
        if not swings or len(df) < 3:
            return sweeps

        highs = df['high'].values
        lows = df['low'].values
        closes = df['close'].values
        times = df['time'].values if 'time' in df.columns else df.index.values

        # Indeksujemy swingi po positionie
        swing_highs = [s for s in swings if s.is_high]
        swing_lows = [s for s in swings if not s.is_high]

        for i in range(1, len(df)):
            # buy-side sweep: high przebija swing high, ale close wraca pod
            for sh in reversed(swing_highs):
                if sh.index >= i:
                    continue
                if i - sh.index > self.sweep_max_age:
                    break  # za stary swing
                if highs[i] > sh.price and closes[i] < sh.price:
                    # to jest sweep — buy-side liquidity zebrana, bearish bias
                    sweeps.append(LiquiditySweep(
                        index=i, time=times[i],
                        swept_swing=sh,
                        direction=Direction.BEARISH,
                        extreme_price=float(highs[i]),
                    ))
                    break  # jeden sweep na świecę per kierunek

            # sell-side sweep: low przebija swing low, close wraca nad
            for sl in reversed(swing_lows):
                if sl.index >= i:
                    continue
                if i - sl.index > self.sweep_max_age:
                    break
                if lows[i] < sl.price and closes[i] > sl.price:
                    sweeps.append(LiquiditySweep(
                        index=i, time=times[i],
                        swept_swing=sl,
                        direction=Direction.BULLISH,  # sell-side sweep = bullish setup
                        extreme_price=float(lows[i]),
                    ))
                    break

        return sweeps

    # ------------------------------------------------------------------------
    # HTF Trend Classification
    # ------------------------------------------------------------------------

    def classify_htf_trend(
        self,
        df: pd.DataFrame,
        swings: List[SwingPoint]
    ) -> Direction:
        """
        Klasyfikuje trend HTF na podstawie:
        - sekwencji ostatnich swing points (HH/HL = bull, LH/LL = bear)
        - pozycji ceny vs 200 EMA (jeśli dostępne)

        Zwraca: BULLISH / BEARISH / NEUTRAL.
        """
        if len(swings) < 4:
            return Direction.NEUTRAL

        # Bierzemy ostatnie 4 swingi
        recent = swings[-4:]
        highs = [s for s in recent if s.is_high]
        lows = [s for s in recent if not s.is_high]

        if len(highs) >= 2 and len(lows) >= 2:
            higher_highs = highs[-1].price > highs[-2].price
            higher_lows = lows[-1].price > lows[-2].price
            lower_highs = highs[-1].price < highs[-2].price
            lower_lows = lows[-1].price < lows[-2].price

            if higher_highs and higher_lows:
                return Direction.BULLISH
            if lower_highs and lower_lows:
                return Direction.BEARISH

        # Fallback: EMA200
        if len(df) >= 200:
            ema200 = df['close'].ewm(span=200, adjust=False).mean()
            current_price = df['close'].iloc[-1]
            if current_price > ema200.iloc[-1] * 1.02:
                return Direction.BULLISH
            if current_price < ema200.iloc[-1] * 0.98:
                return Direction.BEARISH

        return Direction.NEUTRAL

    # ------------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------------

    def _validate_df(self, df: pd.DataFrame):
        required = {'open', 'high', 'low', 'close'}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"DataFrame missing columns: {missing}")
        if len(df) < 2 * self.swing_length + 3:
            raise ValueError(
                f"Need at least {2 * self.swing_length + 3} rows, got {len(df)}"
            )


# ============================================================================
# Quick test / smoke test
# ============================================================================

if __name__ == "__main__":
    # Generujemy syntetyczne dane do smoke testu
    np.random.seed(42)
    n = 500
    base = 100000
    trend = np.cumsum(np.random.randn(n) * 50)
    noise = np.random.randn(n) * 100
    closes = base + trend + noise

    df_test = pd.DataFrame({
        'time': pd.date_range('2025-01-01', periods=n, freq='1h'),
        'open': closes + np.random.randn(n) * 30,
        'high': closes + np.abs(np.random.randn(n) * 80),
        'low': closes - np.abs(np.random.randn(n) * 80),
        'close': closes,
    })
    # Wymuś high >= max(open,close) i low <= min(open,close)
    df_test['high'] = df_test[['high', 'open', 'close']].max(axis=1)
    df_test['low'] = df_test[['low', 'open', 'close']].min(axis=1)

    detector = SMCDetector(swing_length=14)
    result = detector.analyze(df_test)

    print(f"=== SMC Analysis ===")
    print(f"Swings detected: {len(result.swings)}")
    print(f"  - Highs: {sum(1 for s in result.swings if s.is_high)}")
    print(f"  - Lows:  {sum(1 for s in result.swings if not s.is_high)}")
    print(f"Structure events: {len(result.structure_events)}")
    print(f"  - BOS:   {sum(1 for e in result.structure_events if e.event == StructureEvent.BOS)}")
    print(f"  - CHoCH: {sum(1 for e in result.structure_events if e.event == StructureEvent.CHOCH)}")
    print(f"FVGs: {len(result.fvgs)} (active: {len(result.active_fvgs)})")
    print(f"Order Blocks: {len(result.order_blocks)} (active: {len(result.active_order_blocks)})")
    print(f"Liquidity Sweeps: {len(result.sweeps)}")
    print(f"HTF Trend: {result.htf_trend.value}")
    print()
    print(f"Last CHoCH: {result.last_choch}")
    print(f"Last BOS:   {result.last_bos}")
