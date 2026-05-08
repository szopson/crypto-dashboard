# SMC + VELO Confluence Score — Specyfikacja

**Wersja:** 1.0
**Cel:** Zdefiniować jak sygnały Smart Money Concepts łączą się z VELO patterns (A/B/C/E) w jeden ważony score od -100 do +100.

---

## 1. Filozofia scoringu

**Założenie:** Każdy sygnał (VELO pattern lub SMC structure) jest probabilistyczny, nie binarny. Confluence to suma wag — im więcej niezależnych sygnałów potwierdza tę samą tezę, tym wyższa konwikcja.

**Skala finalnego score:**
- `+80 do +100` → bardzo wysoka konwikcja BULLISH (rzadko, full position)
- `+50 do +79`  → wysoka konwikcja BULLISH (standard position)
- `+20 do +49`  → umiarkowana BULLISH (mała pozycja / czekaj na potwierdzenie)
- `-19 do +19`  → szum / brak edge (nie tradować)
- `-49 do -20`  → umiarkowana BEARISH (redukcja ryzyka)
- `-79 do -50`  → wysoka konwikcja BEARISH (de-risk agresywnie)
- `-100 do -80` → bardzo wysoka konwikcja BEARISH (cash / hedge)

**Zero NIE jest sygnałem.** Brak setupu = brak akcji.

---

## 2. Komponenty score

### A. VELO Pattern Component (max ±60 punktów)

VELO patterns to fundament — biorą lwią część wagi, bo bazują na pozycjonowaniu (najtrudniejsze do "manipulacji").

| Pattern | Bias | Score | Confidence multiplier |
|---------|------|-------|----------------------|
| **A — Bear Trap** | BULLISH | +50 | × confidence (0.5-1.0) |
| **B — Accumulation** | BULLISH | +40 | × confidence (0.5-1.0) |
| **C — Distribution** | BEARISH | -55 | × confidence (0.5-1.0) |
| **D — Straight Bull** | NEUTRAL | +10 | × confidence (0.5-1.0) |
| **E — Squeeze Ignition** | BULLISH | +60 | × confidence (0.5-1.0) |

**Confidence multiplier** zależy od jak "czysty" jest pattern:
- Wszystkie 4 warunki spełnione mocno = 1.0
- Warunki spełnione na granicy progów = 0.5-0.7
- High-conviction variant (np. funding flipped negative w Pattern E) = 1.0

**Tylko jeden VELO pattern naraz** — jeśli wykryto kilka, bierzemy ten z najwyższym `|score × confidence|`.

---

### B. SMC Structure Component (max ±25 punktów)

Struktura mówi czy ruch jest strukturalnie potwierdzony. Najmocniejszy sygnał: CHoCH (Change of Character) bo oznacza zmianę trendu.

| Sygnał SMC | Bias | Score | Warunek |
|------------|------|-------|---------|
| **Bullish CHoCH** (HTF) | BULLISH | +20 | Cena przebija ostatni LH po sekwencji LL/LH |
| **Bullish CHoCH** (LTF) | BULLISH | +12 | To samo, ale na niższym timeframe |
| **Bullish BOS** | BULLISH | +10 | Cena w trendzie wzrostowym przebija HH |
| **Bearish CHoCH** (HTF) | BEARISH | -20 | Cena przebija ostatni HL po sekwencji HH/HL |
| **Bearish CHoCH** (LTF) | BEARISH | -12 | To samo, ale LTF |
| **Bearish BOS** | BEARISH | -10 | Cena w trendzie spadkowym przebija LL |
| **Brak sygnału** | NEUTRAL | 0 | Range, brak czystej struktury |

**HTF = 1D / 4H, LTF = 1H / 15m.** Bierzemy najsilniejszy aktywny sygnał (najnowszy nieinwalidowany).

---

### C. SMC Liquidity Component (max ±15 punktów)

Sweep płynności poprzedzający sygnał strukturalny = dramatycznie zwiększa konwikcję. To esencja smart money: zbierają płynność przed odwróceniem.

| Sygnał | Bias | Score | Warunek |
|--------|------|-------|---------|
| **Sell-side liquidity sweep + bullish CHoCH** | BULLISH | +15 | Cena spadła poniżej ostatniego swing low → szybkie odbicie + CHoCH up. Klasyczne smart money accumulation. |
| **Buy-side liquidity sweep + bearish CHoCH** | BEARISH | -15 | Cena przebija ATH/swing high → szybki revert + CHoCH down. Distribution. |
| **Equal highs/lows nieruszone** | INFO | 0 | Płynność wciąż "magnesem" — score bez zmian, ale flag dla operatora |

Sweep musi być świeży (max 24h przed sygnałem strukturalnym).

---

### D. SMC POI / Reaction Component (max ±10 punktów)

POI = Point of Interest (Order Block lub Fair Value Gap). Reakcja ceny na POI = potwierdzenie tezy strukturalnej.

| Sygnał | Bias | Score | Warunek |
|--------|------|-------|---------|
| **Bullish reaction at OB / FVG** | BULLISH | +10 | Cena testuje bullish OB lub wchodzi w bullish FVG i odbija (świeca z dolnym knotem + close powyżej mid-FVG) |
| **Bearish reaction at OB / FVG** | BEARISH | -10 | Lustrzane odbicie powyżej |
| **Brak reakcji / POI nieruszone** | NEUTRAL | 0 | — |

---

### E. HTF Trend Alignment Modifier (multiplikator ±20%)

Bonus/malus za zgodność z trendem 1D/1W. Mnoży końcowy score przez:

| Stan HTF trendu | Modifier (jeśli sygnał BULL) | Modifier (jeśli sygnał BEAR) |
|-----------------|------------------------------|------------------------------|
| **HTF uptrend** (cena > 1D 200 EMA, HH/HL) | × 1.20 | × 0.80 |
| **HTF downtrend** (cena < 1D 200 EMA, LH/LL) | × 0.80 | × 1.20 |
| **HTF range** (brak czystej struktury) | × 1.00 | × 1.00 |

To "trend is your friend" — kontr-trendowe setupy dostają dyskonto, bo trade z prądem ma statystycznie wyższy edge.

---

## 3. Wzór końcowy

```
raw_score = (VELO_component) + (SMC_structure) + (SMC_liquidity) + (SMC_POI)
final_score = raw_score × HTF_modifier
final_score = clamp(final_score, -100, +100)
```

**Confidence label:**
```python
if abs(final_score) < 20:    "NO_EDGE"
elif abs(final_score) < 50:  "MODERATE"
elif abs(final_score) < 80:  "HIGH"
else:                        "VERY_HIGH"
```

---

## 4. Przykładowe scenariusze

### Scenariusz 1: Idealny long setup (Pattern E + bullish CHoCH + sweep)
```
VELO Pattern E (squeeze ignition, conf=1.0):     +60
Bullish CHoCH na 1H (LTF):                       +12
Sell-side sweep + CHoCH:                         +15
Bullish FVG reaction:                            +10
HTF uptrend modifier:                            × 1.20
─────────────────────────────────────────────────
raw = 97 → final = 97 × 1.20 = clamp = +100 (VERY_HIGH BULLISH)
```

### Scenariusz 2: Distribution top z potwierdzeniem
```
VELO Pattern C (distribution, conf=0.9):         -55 × 0.9 = -49.5
Bearish CHoCH na 4H (HTF):                       -20
Buy-side sweep ATH + CHoCH down:                 -15
Bearish OB rejection:                            -10
HTF uptrend modifier (kontr-trend):              × 0.80
─────────────────────────────────────────────────
raw = -94.5 → final = -94.5 × 0.80 = -75.6 (HIGH BEARISH)
```

### Scenariusz 3: Tylko VELO, brak SMC potwierdzenia
```
VELO Pattern A (bear trap, conf=0.7):            +50 × 0.7 = +35
SMC structure: brak (range):                     0
SMC liquidity: brak:                             0
SMC POI: brak:                                   0
HTF range modifier:                              × 1.00
─────────────────────────────────────────────────
raw = 35 → final = 35 (MODERATE BULLISH — czekaj na potwierdzenie struktury)
```

### Scenariusz 4: SMC sygnalizuje, VELO milczy
```
VELO: brak patternu:                             0
Bullish CHoCH na 1H:                             +12
Sell-side sweep + CHoCH:                         +15
Bullish FVG reaction:                            +10
HTF uptrend:                                     × 1.20
─────────────────────────────────────────────────
raw = 37 → final = 44.4 (MODERATE BULLISH — czysty SMC long bez confirmu od pozycjonowania)
```

---

## 5. Reguły interpretacji

**Trade rules:**

| Final Score | Action |
|-------------|--------|
| `+80 do +100`  | Full size long (spot + leverage 2-3x) |
| `+50 do +79`   | Standard long (spot 70%, leverage 1-2x) |
| `+20 do +49`   | Probe position (spot 30-50%, no leverage) |
| `-19 do +19`   | NO TRADE (czekaj na lepszy setup) |
| `-49 do -20`   | Reduce risk (trim 30-50% pozycji long) |
| `-79 do -50`   | De-risk (trim 70%+, no new longs) |
| `-100 do -80`  | Cash / hedge (full exit + opcjonalne short hedge) |

**Override rules:**
- Jeśli HTF trend = downtrend ORAZ raw_score > 0 ALE < 50 → traktuj jako counter-trend, nie tradować bez bardzo wysokiej konwikcji
- Jeśli VELO Pattern C wykryty ALE SMC = bullish CHoCH na HTF → konflikt; final_score zostaje, ale flagujemy `CONFLICT_DETECTED` — to często early warning że jeden z sygnałów się odwróci

---

## 6. Co NIE wchodzi do score

Świadomie pomijamy:

- **Ceny absolutne / round numbers** — to nie SMC, to lokalna psychologia
- **RSI / klasyczne wskaźniki** — celowo bazujemy tylko na strukturze + pozycjonowaniu
- **News / sentiment** — osobny moduł, nie miesza się
- **Fibonacci levels** — opcjonalnie jako tie-breaker, ale nie w core score
- **Volume profile** — w przyszłej wersji jako osobny komponent

---

## 7. Kalibracja

Wagi w sekcji 2 to **punkt startowy oparty na intuicji frameworka**, nie na backteście. Po deploy:

1. Loguj każdy sygnał z final_score do bazy
2. Po 60 dniach zrób analizę: które komponenty mają najwyższe hit rate?
3. Tunuj wagi w oparciu o realne wyniki, nie założenia

Plan: w v2.0 dodać `weight_calibration.json` z aktualnymi wagami zamiast hard-codingu w kodzie.

---

## 8. Edge cases

**Co robić gdy:**

| Sytuacja | Decyzja |
|----------|---------|
| Wykryto 2 VELO patterns naraz | Bierz ten z wyższym `|score × confidence|` |
| Sweep był 48h temu, nie 24h | Score = 0 (za stary, niewystarczający trigger) |
| CHoCH na 1H ale BOS w przeciwnym kierunku na 4H | Konflikt — bierz HTF (4H), score według HTF |
| Brak danych dla HTF (świeży coin) | HTF_modifier = 1.0 (neutralny) |
| FVG zostało wypełnione ale cena wraca do middle | POI score = 50% wartości (5 zamiast 10) |

---

**Koniec speca v1.0** — to fundament pod implementację. Zmiany wagowe = bump wersji.
