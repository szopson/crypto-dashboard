"""
SMC + VELO Confluence Scorer
=============================

Łączy wyniki detekcji SMC (smc_detector.py) z patternami VELO (A/B/C/D/E)
w jeden ważony score od -100 do +100.

Implementuje logikę zdefiniowaną w SMC_VELO_CONFLUENCE_SPEC.md (v1.0).

Przykład użycia:
    from smc_detector import SMCDetector
    from confluence_scorer import ConfluenceScorer, VeloPatternResult, VeloPatternType

    smc_result = SMCDetector().analyze(df_ohlc)
    velo_result = VeloPatternResult(
        pattern=VeloPatternType.PATTERN_E,
        confidence=0.95,
        details={'price_change': 0.04, 'oi_change': 0.07, 'funding': -0.0001}
    )

    scorer = ConfluenceScorer()
    score = scorer.compute(smc_result, velo_result, current_index=len(df_ohlc) - 1)

    print(f"Final score: {score.final_score:.1f}")
    print(f"Confidence: {score.confidence_label}")
    print(f"Action: {score.recommended_action}")
    print(f"Breakdown: {score.breakdown}")
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from smc_detector import (
    SMCAnalysis, Direction, StructureEvent,
    StructureSignal, FairValueGap, OrderBlock, LiquiditySweep
)


# ============================================================================
# VELO Pattern types — zgodne z VELO_DATA_PATTERN_GUIDE.md
# ============================================================================

class VeloPatternType(str, Enum):
    PATTERN_A = "bear_trap"           # bias: BULLISH, base score: +50
    PATTERN_B = "accumulation"        # bias: BULLISH, base score: +40
    PATTERN_C = "distribution"        # bias: BEARISH, base score: -55
    PATTERN_D = "straight_bull"       # bias: NEUTRAL, base score: +10
    PATTERN_E = "squeeze_ignition"    # bias: BULLISH, base score: +60
    NONE = "none"


# Tabela wag VELO patterns ze specu sekcja 2.A
VELO_PATTERN_WEIGHTS: Dict[VeloPatternType, int] = {
    VeloPatternType.PATTERN_A: 50,
    VeloPatternType.PATTERN_B: 40,
    VeloPatternType.PATTERN_C: -55,
    VeloPatternType.PATTERN_D: 10,
    VeloPatternType.PATTERN_E: 60,
    VeloPatternType.NONE: 0,
}


@dataclass
class VeloPatternResult:
    """Wynik detekcji VELO pattern, do podania do scorera."""
    pattern: VeloPatternType
    confidence: float = 1.0  # 0.0 - 1.0, jak czysty jest pattern
    details: Dict[str, Any] = field(default_factory=dict)


# ============================================================================
# Confluence Score result
# ============================================================================

@dataclass
class ConfluenceBreakdown:
    """Rozłożenie końcowego score na komponenty (do debug / loggingu)."""
    velo_component: float = 0.0
    smc_structure: float = 0.0
    smc_liquidity: float = 0.0
    smc_poi: float = 0.0
    htf_modifier: float = 1.0
    raw_score: float = 0.0
    notes: List[str] = field(default_factory=list)


@dataclass
class ConfluenceScore:
    """Końcowy wynik confluence scoringu."""
    final_score: float
    confidence_label: str  # NO_EDGE / MODERATE / HIGH / VERY_HIGH
    bias: Direction
    recommended_action: str
    breakdown: ConfluenceBreakdown
    conflict_detected: bool = False


# ============================================================================
# Scorer
# ============================================================================

class ConfluenceScorer:
    """
    Implementacja confluence scoringu z SMC_VELO_CONFLUENCE_SPEC.md.

    Wszystkie wagi w jednym miejscu — łatwo tunować po backteście.
    """

    # SMC Structure weights (sekcja 2.B specu)
    # Klucze używają wartości StructureEvent enum: 'CHoCH' i 'BOS'
    STRUCTURE_WEIGHTS = {
        ('CHoCH', 'HTF'): 20,
        ('CHoCH', 'LTF'): 12,
        ('BOS', 'HTF'): 10,
        ('BOS', 'LTF'): 6,
    }

    # SMC Liquidity (sekcja 2.C)
    SWEEP_PLUS_CHOCH_WEIGHT = 15

    # SMC POI (sekcja 2.D)
    POI_REACTION_WEIGHT = 10
    POI_PARTIAL_WEIGHT = 5  # gdy FVG/OB częściowo wypełnione

    # HTF modifier (sekcja 2.E)
    HTF_ALIGNED_BONUS = 1.20
    HTF_OPPOSED_PENALTY = 0.80

    # Ile świec wstecz uznajemy CHoCH/BOS za "świeży"
    STRUCTURE_FRESHNESS_LOOKBACK = 50

    # Ile świec wstecz uznajemy sweep za "powiązany" z CHoCH
    SWEEP_TO_CHOCH_MAX_GAP = 24

    def __init__(self, htf_label_threshold: int = 4):
        """
        htf_label_threshold: minimum liczby świec sygnału strukturalnego od końca,
        powyżej którego uznajemy event za HTF (przy założeniu że dataframe to LTF).
        Przy 1H data, swing length 14 → CHoCH/BOS w obrębie ostatnich 4 świec to LTF,
        starsze to HTF.
        """
        self.htf_label_threshold = htf_label_threshold

    def compute(
        self,
        smc: SMCAnalysis,
        velo: VeloPatternResult,
        current_index: int,
    ) -> ConfluenceScore:
        """
        Główna metoda. Zwraca ConfluenceScore z pełnym breakdownem.

        Args:
            smc: wynik SMCDetector.analyze()
            velo: wynik detekcji pattern VELO (z istniejącego kodu)
            current_index: indeks ostatniej świecy w DF (używany jako "now")
        """
        breakdown = ConfluenceBreakdown()

        # 1. VELO Pattern Component
        velo_score = self._compute_velo_component(velo, breakdown)
        breakdown.velo_component = velo_score

        # 2. SMC Structure Component
        structure_score = self._compute_structure_component(
            smc, current_index, breakdown
        )
        breakdown.smc_structure = structure_score

        # 3. SMC Liquidity Component (sweep + CHoCH combo)
        liquidity_score = self._compute_liquidity_component(
            smc, current_index, breakdown
        )
        breakdown.smc_liquidity = liquidity_score

        # 4. SMC POI Component
        poi_score = self._compute_poi_component(smc, current_index, breakdown)
        breakdown.smc_poi = poi_score

        # 5. Surowy score
        raw = velo_score + structure_score + liquidity_score + poi_score
        breakdown.raw_score = raw

        # 6. HTF modifier
        # Określamy końcowy bias dla raw_score
        provisional_bias = self._infer_bias(raw)
        htf_modifier = self._compute_htf_modifier(smc.htf_trend, provisional_bias)
        breakdown.htf_modifier = htf_modifier
        breakdown.notes.append(
            f"HTF trend: {smc.htf_trend.value}, modifier: ×{htf_modifier:.2f}"
        )

        # 7. Final score
        final = raw * htf_modifier
        final = max(-100.0, min(100.0, final))

        # 8. Detekcja konfliktu VELO vs SMC
        conflict = self._detect_conflict(velo, structure_score)
        if conflict:
            breakdown.notes.append("⚠ CONFLICT: VELO i SMC structure wskazują przeciwne kierunki")

        return ConfluenceScore(
            final_score=round(final, 2),
            confidence_label=self._label_confidence(final),
            bias=self._infer_bias(final),
            recommended_action=self._recommend_action(final, smc.htf_trend),
            breakdown=breakdown,
            conflict_detected=conflict,
        )

    # ------------------------------------------------------------------------
    # Komponenty score
    # ------------------------------------------------------------------------

    def _compute_velo_component(
        self,
        velo: VeloPatternResult,
        breakdown: ConfluenceBreakdown,
    ) -> float:
        if velo.pattern == VeloPatternType.NONE:
            breakdown.notes.append("VELO: brak aktywnego patternu")
            return 0.0

        base = VELO_PATTERN_WEIGHTS[velo.pattern]
        confidence = max(0.0, min(1.0, velo.confidence))
        component = base * confidence
        breakdown.notes.append(
            f"VELO {velo.pattern.value}: base={base}, conf={confidence:.2f}, "
            f"component={component:+.1f}"
        )
        return component

    def _compute_structure_component(
        self,
        smc: SMCAnalysis,
        current_index: int,
        breakdown: ConfluenceBreakdown,
    ) -> float:
        """
        Bierzemy najnowszy nieinwalidowany sygnał strukturalny.
        CHoCH ma priorytet nad BOS (silniejszy sygnał).
        """
        if not smc.structure_events:
            breakdown.notes.append("SMC structure: brak eventów")
            return 0.0

        # Bierzemy ostatnie eventy w obrębie freshness lookback
        recent = [
            e for e in smc.structure_events
            if current_index - e.index <= self.STRUCTURE_FRESHNESS_LOOKBACK
        ]
        if not recent:
            breakdown.notes.append("SMC structure: brak świeżych eventów")
            return 0.0

        # CHoCH > BOS jeśli oba są świeże
        chochs = [e for e in recent if e.event == StructureEvent.CHOCH]
        if chochs:
            event = chochs[-1]
        else:
            event = recent[-1]  # last BOS

        # Klasyfikacja HTF/LTF — bardzo świeży event = LTF
        age = current_index - event.index
        is_htf = age > self.htf_label_threshold

        weight_key = (event.event.value, 'HTF' if is_htf else 'LTF')
        weight = self.STRUCTURE_WEIGHTS.get(weight_key, 0)

        # Zastosuj kierunek
        if event.direction == Direction.BEARISH:
            weight = -weight

        breakdown.notes.append(
            f"SMC {event.event.value} ({event.direction.value}, "
            f"age={age}, {'HTF' if is_htf else 'LTF'}): {weight:+d}"
        )
        return float(weight)

    def _compute_liquidity_component(
        self,
        smc: SMCAnalysis,
        current_index: int,
        breakdown: ConfluenceBreakdown,
    ) -> float:
        """
        Bonus gdy LIQUIDITY SWEEP poprzedził strukturalny CHoCH w tym samym kierunku.

        Sell-side sweep (bullish setup) + bullish CHoCH = +15
        Buy-side sweep (bearish setup) + bearish CHoCH = -15
        """
        if not smc.sweeps or not smc.structure_events:
            return 0.0

        # Bierzemy najnowszy CHoCH
        chochs = [e for e in smc.structure_events if e.event == StructureEvent.CHOCH]
        if not chochs:
            return 0.0
        last_choch = chochs[-1]

        # Czy CHoCH jest świeży?
        if current_index - last_choch.index > self.STRUCTURE_FRESHNESS_LOOKBACK:
            return 0.0

        # Szukamy sweep'u w tym samym kierunku PRZED tym CHoCH
        # ale nie za dawno
        relevant_sweeps = [
            s for s in smc.sweeps
            if s.direction == last_choch.direction
            and s.index < last_choch.index
            and last_choch.index - s.index <= self.SWEEP_TO_CHOCH_MAX_GAP
        ]

        if not relevant_sweeps:
            return 0.0

        sweep = relevant_sweeps[-1]
        weight = self.SWEEP_PLUS_CHOCH_WEIGHT
        if last_choch.direction == Direction.BEARISH:
            weight = -weight

        side = "sell-side" if sweep.direction == Direction.BULLISH else "buy-side"
        breakdown.notes.append(
            f"SMC {side} sweep + {last_choch.direction.value} CHoCH: {weight:+d}"
        )
        return float(weight)

    def _compute_poi_component(
        self,
        smc: SMCAnalysis,
        current_index: int,
        breakdown: ConfluenceBreakdown,
    ) -> float:
        """
        Bonus gdy cena WŁAŚNIE reaguje na POI (FVG lub OB) który jeszcze nie został
        w pełni zmitygowany. "Reaguje" = został niedawno tknięty (mitigation_index
        w obrębie ostatnich 5 świec).
        """
        recent_poi_touches: List[tuple] = []  # (direction, partial_or_full)

        # FVG mitigations w ostatnich 5 świecach
        for fvg in smc.fvgs:
            if fvg.mitigation_index is not None and \
               current_index - fvg.mitigation_index <= 5:
                recent_poi_touches.append((fvg.direction, "fvg"))

        # OB mitigations w ostatnich 5 świecach
        for ob in smc.order_blocks:
            if ob.mitigation_index is not None and \
               current_index - ob.mitigation_index <= 5:
                recent_poi_touches.append((ob.direction, "ob"))

        if not recent_poi_touches:
            return 0.0

        # Bierzemy najmocniejszy zgodny sygnał — jeśli wszystkie zgodne, +10/-10
        # Jeśli mieszane, brak bonusu
        bull_count = sum(1 for d, _ in recent_poi_touches if d == Direction.BULLISH)
        bear_count = sum(1 for d, _ in recent_poi_touches if d == Direction.BEARISH)

        if bull_count > 0 and bear_count == 0:
            breakdown.notes.append(f"SMC POI bullish reaction (×{bull_count}): +{self.POI_REACTION_WEIGHT}")
            return float(self.POI_REACTION_WEIGHT)
        if bear_count > 0 and bull_count == 0:
            breakdown.notes.append(f"SMC POI bearish reaction (×{bear_count}): -{self.POI_REACTION_WEIGHT}")
            return float(-self.POI_REACTION_WEIGHT)

        breakdown.notes.append(
            f"SMC POI: mieszane reakcje (bull={bull_count}, bear={bear_count}) → 0"
        )
        return 0.0

    def _compute_htf_modifier(
        self,
        htf_trend: Direction,
        signal_bias: Direction,
    ) -> float:
        if htf_trend == Direction.NEUTRAL or signal_bias == Direction.NEUTRAL:
            return 1.0
        if htf_trend == signal_bias:
            return self.HTF_ALIGNED_BONUS
        return self.HTF_OPPOSED_PENALTY

    # ------------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------------

    @staticmethod
    def _infer_bias(score: float) -> Direction:
        if score > 5:
            return Direction.BULLISH
        if score < -5:
            return Direction.BEARISH
        return Direction.NEUTRAL

    @staticmethod
    def _label_confidence(score: float) -> str:
        abs_s = abs(score)
        if abs_s < 20:
            return "NO_EDGE"
        if abs_s < 50:
            return "MODERATE"
        if abs_s < 80:
            return "HIGH"
        return "VERY_HIGH"

    @staticmethod
    def _recommend_action(score: float, htf_trend: Direction) -> str:
        if score >= 80:
            return "FULL_LONG (spot + 2-3x leverage)"
        if score >= 50:
            return "STANDARD_LONG (spot 70%, lev 1-2x)"
        if score >= 20:
            return "PROBE_LONG (spot 30-50%, no leverage)"
        if score > -20:
            return "NO_TRADE (czekaj na lepszy setup)"
        if score > -50:
            return "REDUCE_RISK (trim 30-50% pozycji long)"
        if score > -80:
            return "DE_RISK (trim 70%+, no new longs)"
        return "CASH_OR_HEDGE (full exit + opcjonalny short hedge)"

    def _detect_conflict(
        self,
        velo: VeloPatternResult,
        smc_structure_score: float,
    ) -> bool:
        """Konflikt = VELO bias bullish ale SMC structure bearish, lub odwrotnie."""
        if velo.pattern == VeloPatternType.NONE:
            return False

        velo_score = VELO_PATTERN_WEIGHTS[velo.pattern]
        if abs(velo_score) < 15:  # Pattern D (neutral) nie liczy się jako konflikt
            return False
        if abs(smc_structure_score) < 8:  # brak silnej struktury → brak konfliktu
            return False

        return (velo_score > 0 and smc_structure_score < 0) or \
               (velo_score < 0 and smc_structure_score > 0)


# ============================================================================
# Smoke test
# ============================================================================

if __name__ == "__main__":
    import pandas as pd
    import numpy as np
    from smc_detector import SMCDetector

    # Wygeneruj syntetyczne dane (kontrolowane: trend up + pullback)
    np.random.seed(7)
    n = 400
    base = 100000
    # symulujemy: down trend → reversal up
    seg1 = np.linspace(0, -2000, 200) + np.random.randn(200) * 80
    seg2 = np.linspace(-2000, 1500, 200) + np.random.randn(200) * 80
    closes = base + np.concatenate([seg1, seg2])

    df = pd.DataFrame({
        'time': pd.date_range('2025-01-01', periods=n, freq='1h'),
        'open': closes + np.random.randn(n) * 30,
        'high': closes + np.abs(np.random.randn(n) * 100),
        'low': closes - np.abs(np.random.randn(n) * 100),
        'close': closes,
    })
    df['high'] = df[['high', 'open', 'close']].max(axis=1)
    df['low'] = df[['low', 'open', 'close']].min(axis=1)

    # Analiza SMC
    smc_result = SMCDetector(swing_length=14).analyze(df)

    # Symulujemy 4 scenariusze VELO
    scenarios = [
        ("Pattern E + reversal SMC", VeloPatternResult(
            pattern=VeloPatternType.PATTERN_E,
            confidence=0.95,
            details={'price_change': 0.04, 'oi_change': 0.07}
        )),
        ("Pattern A bear trap", VeloPatternResult(
            pattern=VeloPatternType.PATTERN_A,
            confidence=0.7,
            details={}
        )),
        ("Pattern C distribution", VeloPatternResult(
            pattern=VeloPatternType.PATTERN_C,
            confidence=0.9,
            details={}
        )),
        ("Brak VELO, tylko SMC", VeloPatternResult(
            pattern=VeloPatternType.NONE,
            confidence=0.0,
            details={}
        )),
    ]

    scorer = ConfluenceScorer()
    print(f"=== Confluence Scoring Test ===")
    print(f"HTF trend wykryty: {smc_result.htf_trend.value}")
    print(f"Liczba CHoCH: {sum(1 for e in smc_result.structure_events if e.event == StructureEvent.CHOCH)}")
    print(f"Liczba BOS: {sum(1 for e in smc_result.structure_events if e.event == StructureEvent.BOS)}")
    print(f"Aktywne FVG: {len(smc_result.active_fvgs)}, sweeps: {len(smc_result.sweeps)}")
    print()

    for label, velo_input in scenarios:
        score = scorer.compute(smc_result, velo_input, current_index=len(df) - 1)
        print(f"--- {label} ---")
        print(f"  Final score: {score.final_score:+.1f}  [{score.confidence_label}]  bias={score.bias.value}")
        print(f"  Action: {score.recommended_action}")
        if score.conflict_detected:
            print(f"  ⚠ CONFLICT DETECTED")
        print(f"  Breakdown:")
        print(f"    VELO:        {score.breakdown.velo_component:+.1f}")
        print(f"    Structure:   {score.breakdown.smc_structure:+.1f}")
        print(f"    Liquidity:   {score.breakdown.smc_liquidity:+.1f}")
        print(f"    POI:         {score.breakdown.smc_poi:+.1f}")
        print(f"    Raw:         {score.breakdown.raw_score:+.1f}")
        print(f"    HTF mod:     ×{score.breakdown.htf_modifier:.2f}")
        print()
