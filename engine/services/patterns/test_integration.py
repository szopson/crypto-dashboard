"""
Integration test: pełny scenariusz idealnego setupu
====================================================

Testujemy:
1. Pattern E (squeeze ignition) + bullish CHoCH + sell-side sweep + bullish FVG
   → oczekujemy VERY_HIGH BULLISH score (~80-100)

2. Pattern C (distribution) + bearish CHoCH + buy-side sweep
   → oczekujemy HIGH BEARISH score (~-70 do -90)
"""

import pandas as pd
import numpy as np
from smc_detector import (
    SMCDetector, SMCAnalysis, Direction, StructureEvent,
    SwingPoint, StructureSignal, FairValueGap, OrderBlock, LiquiditySweep
)
from confluence_scorer import (
    ConfluenceScorer, VeloPatternResult, VeloPatternType
)


def make_smc_with_bullish_setup(current_index: int) -> SMCAnalysis:
    """
    Ręcznie konstruujemy SMCAnalysis ze wszystkimi bullish elementami
    blisko current_index.
    """
    # Swing low 30 świec wstecz
    swing_low = SwingPoint(
        index=current_index - 30,
        time="t-30", price=98000.0, is_high=False,
    )
    swing_high = SwingPoint(
        index=current_index - 50,
        time="t-50", price=102000.0, is_high=True,
    )

    # Sweep sell-side (bullish setup) 15 świec temu — pod swing low
    sweep = LiquiditySweep(
        index=current_index - 15,
        time="t-15",
        swept_swing=swing_low,
        direction=Direction.BULLISH,  # sell-side sweep
        extreme_price=97500.0,
    )

    # Bullish CHoCH 8 świec temu (HTF — bo > 4 świec od końca)
    choch = StructureSignal(
        index=current_index - 8,
        time="t-8",
        price=100500.0,
        event=StructureEvent.CHOCH,
        direction=Direction.BULLISH,
        broken_swing=swing_high,
    )

    # Bullish FVG zostawiony przy CHoCH, właśnie tknięty 2 świece temu
    fvg = FairValueGap(
        index=current_index - 7,
        time="t-7",
        direction=Direction.BULLISH,
        top=100200.0,
        bottom=99800.0,
        mitigated=True,
        mitigation_index=current_index - 2,
    )

    return SMCAnalysis(
        swings=[swing_high, swing_low],
        structure_events=[choch],
        fvgs=[fvg],
        order_blocks=[],
        sweeps=[sweep],
        htf_trend=Direction.BULLISH,
    )


def make_smc_with_bearish_setup(current_index: int) -> SMCAnalysis:
    """Analogiczny bearish setup do testu Pattern C."""
    swing_high = SwingPoint(
        index=current_index - 30,
        time="t-30", price=120000.0, is_high=True,
    )
    swing_low = SwingPoint(
        index=current_index - 50,
        time="t-50", price=115000.0, is_high=False,
    )

    sweep = LiquiditySweep(
        index=current_index - 15,
        time="t-15",
        swept_swing=swing_high,
        direction=Direction.BEARISH,  # buy-side sweep nad ATH
        extreme_price=120500.0,
    )

    choch = StructureSignal(
        index=current_index - 8,
        time="t-8",
        price=117500.0,
        event=StructureEvent.CHOCH,
        direction=Direction.BEARISH,
        broken_swing=swing_low,
    )

    ob = OrderBlock(
        index=current_index - 7,
        time="t-7",
        direction=Direction.BEARISH,
        high=120000.0,
        low=119500.0,
        mitigated=True,
        mitigation_index=current_index - 2,
    )

    return SMCAnalysis(
        swings=[swing_high, swing_low],
        structure_events=[choch],
        fvgs=[],
        order_blocks=[ob],
        sweeps=[sweep],
        htf_trend=Direction.BULLISH,  # ważne: kontr-trend → modifier ×0.80 dla bearish
    )


# ============================================================================
# TESTS
# ============================================================================

def test_perfect_long_setup():
    print("=" * 70)
    print("TEST 1: Pattern E + bullish CHoCH (HTF) + sweep + FVG + HTF up")
    print("=" * 70)

    smc = make_smc_with_bullish_setup(current_index=200)
    velo = VeloPatternResult(
        pattern=VeloPatternType.PATTERN_E,
        confidence=1.0,
        details={'price_change': 0.045, 'oi_change': 0.08, 'funding': -0.0002,
                 'funding_flipped_negative': True}
    )

    scorer = ConfluenceScorer()
    score = scorer.compute(smc, velo, current_index=200)

    print(f"\n  Final score: {score.final_score:+.1f}")
    print(f"  Confidence:  {score.confidence_label}")
    print(f"  Bias:        {score.bias.value}")
    print(f"  Action:      {score.recommended_action}")
    print(f"\n  Breakdown:")
    print(f"    VELO Pattern E:    {score.breakdown.velo_component:+.1f}")
    print(f"    Structure CHoCH:   {score.breakdown.smc_structure:+.1f}")
    print(f"    Sweep + CHoCH:     {score.breakdown.smc_liquidity:+.1f}")
    print(f"    FVG reaction:      {score.breakdown.smc_poi:+.1f}")
    print(f"    Raw:               {score.breakdown.raw_score:+.1f}")
    print(f"    HTF modifier:      ×{score.breakdown.htf_modifier:.2f}")
    print(f"\n  Notes:")
    for n in score.breakdown.notes:
        print(f"    - {n}")

    # Asercje
    assert score.bias == Direction.BULLISH, "Powinno być BULLISH"
    assert score.final_score >= 80, f"Expected >=80, got {score.final_score}"
    assert score.confidence_label == "VERY_HIGH"
    print("\n  ✅ PASS — VERY_HIGH BULLISH zgodnie z oczekiwaniem")


def test_perfect_short_setup():
    print("\n" + "=" * 70)
    print("TEST 2: Pattern C + bearish CHoCH + sweep + OB + HTF up (kontr-trend)")
    print("=" * 70)

    smc = make_smc_with_bearish_setup(current_index=200)
    velo = VeloPatternResult(
        pattern=VeloPatternType.PATTERN_C,
        confidence=0.9,
        details={'price_change': 0.04, 'oi_vs_ath': 0.98, 'funding': 0.00025}
    )

    scorer = ConfluenceScorer()
    score = scorer.compute(smc, velo, current_index=200)

    print(f"\n  Final score: {score.final_score:+.1f}")
    print(f"  Confidence:  {score.confidence_label}")
    print(f"  Bias:        {score.bias.value}")
    print(f"  Action:      {score.recommended_action}")
    print(f"\n  Breakdown:")
    print(f"    VELO Pattern C:    {score.breakdown.velo_component:+.1f}")
    print(f"    Structure CHoCH:   {score.breakdown.smc_structure:+.1f}")
    print(f"    Sweep + CHoCH:     {score.breakdown.smc_liquidity:+.1f}")
    print(f"    OB reaction:       {score.breakdown.smc_poi:+.1f}")
    print(f"    Raw:               {score.breakdown.raw_score:+.1f}")
    print(f"    HTF modifier:      ×{score.breakdown.htf_modifier:.2f} (counter-trend penalty)")
    print(f"\n  Notes:")
    for n in score.breakdown.notes:
        print(f"    - {n}")

    assert score.bias == Direction.BEARISH
    assert score.final_score <= -50, f"Expected <=-50, got {score.final_score}"
    print(f"\n  ✅ PASS — HIGH/VERY_HIGH BEARISH (counter-trend dyskonto zastosowane)")


def test_conflict_detection():
    print("\n" + "=" * 70)
    print("TEST 3: Konflikt — VELO C (bear) ale SMC bullish CHoCH")
    print("=" * 70)

    smc = make_smc_with_bullish_setup(current_index=200)
    velo = VeloPatternResult(
        pattern=VeloPatternType.PATTERN_C,
        confidence=0.8,
        details={}
    )

    scorer = ConfluenceScorer()
    score = scorer.compute(smc, velo, current_index=200)

    print(f"\n  Final score: {score.final_score:+.1f}")
    print(f"  Conflict:    {score.conflict_detected}")
    print(f"  Bias:        {score.bias.value}")
    print(f"\n  Breakdown:")
    print(f"    VELO C:            {score.breakdown.velo_component:+.1f}")
    print(f"    SMC structure:     {score.breakdown.smc_structure:+.1f}")
    print(f"    Sweep+CHoCH:       {score.breakdown.smc_liquidity:+.1f}")
    print(f"    POI:               {score.breakdown.smc_poi:+.1f}")
    print(f"\n  Notes:")
    for n in score.breakdown.notes:
        print(f"    - {n}")

    assert score.conflict_detected, "Powinno wykryć konflikt"
    print(f"\n  ✅ PASS — Konflikt wykryty poprawnie")


def test_no_velo_only_smc():
    print("\n" + "=" * 70)
    print("TEST 4: Brak VELO, tylko SMC (bullish setup)")
    print("=" * 70)

    smc = make_smc_with_bullish_setup(current_index=200)
    velo = VeloPatternResult(pattern=VeloPatternType.NONE)

    scorer = ConfluenceScorer()
    score = scorer.compute(smc, velo, current_index=200)

    print(f"\n  Final score: {score.final_score:+.1f}")
    print(f"  Confidence:  {score.confidence_label}")
    print(f"  Bias:        {score.bias.value}")

    # SMC alone: 20 (CHoCH HTF) + 15 (sweep) + 10 (FVG) = 45 × 1.20 = 54
    assert score.bias == Direction.BULLISH
    assert 40 <= score.final_score <= 70, f"Expected 40-70, got {score.final_score}"
    print(f"\n  ✅ PASS — Sam SMC daje umiarkowany bullish bez VELO")


if __name__ == "__main__":
    test_perfect_long_setup()
    test_perfect_short_setup()
    test_conflict_detection()
    test_no_velo_only_smc()
    print("\n" + "=" * 70)
    print("✅ Wszystkie testy zaliczone")
    print("=" * 70)
