# Follio App UI/UX Improvements
## Inspirowane audytem hyperhuman.pl → follio.io

**Branch:** `feature/new-landing-page`
**Target:** https://follio.io/app
**Data:** 2026-04-27

---

## 🎯 Obecna struktura aplikacji

### Routes (z `/src/app/`)
- `/` - Główny dashboard (Top 50 Cryptocurrencies)
- `/dashboard` - Trading Command Center (BiasGrid + RadarScore)
- `/radar` - RADAR scoring
- `/chart` - TradingChart
- `/assistant` - AI Assistant
- `/briefing` - Daily Briefing
- `/setups` - Trade Setups
- `/journal` - Trading Journal
- `/cycle` - Market Cycle
- `/calculator` - Position Calculator
- `/lp-playbook` - LP Playbook

### Komponenty
- `Header.tsx` - Navbar z linkami
- `BiasGrid.tsx` - Market bias table z real-time data
- `RadarScore.tsx` - RADAR scoring component
- `TradingChart.tsx` - Wykresy
- `MarketChat.tsx` - Chat z Claude
- `AIAnalysisButton.tsx` - Analiza AI

---

## 🔥 Priorytetowe poprawki (Quick Wins)

### 1. **Header/Navbar Enhancement** (30 min)
**Problem:** Navbar ma 11 linków w jednym rzędzie, wszystkie w tej samej szarości (`text-zinc-400`). Brak hierarchii wizualnej, brak głównego CTA.

**Fix z audytu (steal #7):**
- Dodaj **wyróżniony CTA button** po prawej stronie navbaru
- Kolor akcentu: `bg-emerald-500 hover:bg-emerald-600` (pasuje do tematu crypto)
- Tekst: "Get AI Analysis" lub "Ask Assistant" → link do `/assistant`
- Opcjonalnie: dodaj user avatar/profile dropdown na końcu

**Implementacja:**
```tsx
// src/components/Header.tsx
<div className="ml-auto flex items-center gap-4">
  <Link
    href="/assistant"
    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors text-sm"
  >
    Ask AI Assistant
  </Link>
</div>
```

---

### 2. **Dashboard Hero Metrics** (45 min)
**Problem:** Główna strona (`/page.tsx`) pokazuje tabelę top 50 crypto, ale brak "hero metrics" — dużych liczb które natychmiast komunikują wartość.

**Fix z audytu (steal #2):**
- Nad tabelą dodaj **4 duże karty metrykowe** (grid 2×2 lub 4×1)
- Przykładowe metryki:
  - **"<47s"** - Average AI Analysis Time
  - **"847+"** - Active Traders This Week
  - **"300+"** - Daily Signals Tracked
  - **"94%"** - Signal Accuracy (last 30d)

**Implementacja:**
```tsx
// src/app/page.tsx - przed tabelą
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
  <MetricCard
    value="<47s"
    label="AI Analysis Time"
    trend="+12% faster"
    color="emerald"
  />
  {/* ... więcej kart */}
</div>
```

---

### 3. **Real-time Update Indicator** (20 min)
**Problem:** `BiasGrid` pobiera dane co 5 minut, ale użytkownik nie widzi że dane są "żywe". Brak feedbacku o freshness danych.

**Fix z audytu (steal #1 - countdown/timer):**
- Dodaj **pulsujący zielony dot** obok "Market Bias" header
- Tekst: "Live • Updated 2m ago"
- Subtelna animacja pulse na dot

**Implementacja:**
```tsx
// src/components/BiasGrid.tsx - w headerze
<div className="flex items-center gap-2">
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
  </span>
  <span className="text-xs text-emerald-400 font-medium">Live</span>
</div>
```

---

### 4. **Bias Score Visual Enhancement** (30 min)
**Problem:** Score w `BiasGrid` jest mały (text-xs), trudno skanować wzrokiem dużą tabelę.

**Fix z audytu (steal #2 - duże liczby):**
- Zwiększ font size score z `text-xs` → `text-sm font-bold`
- Dodaj mini sparkline trend (↗/↘) obok score
- Highlight top/bottom performer w każdym timeframe

**Implementacja:**
```tsx
// src/components/BiasGrid.tsx - scoreColor section
<span className={`text-sm rounded px-2 py-1 font-mono font-bold ${scoreColor(r.score)}`}>
  {r.score}
  {r.trend > 0 ? ' ↗' : r.trend < 0 ? ' ↘' : ''}
</span>
```

---

### 5. **Dashboard Welcome Banner** (45 min)
**Problem:** User ląduje na stronie i widzi tabelę bez kontekstu. Brak personalizacji.

**Fix z audytu (steal #6 - avatar stack + social proof):**
- Dodaj **welcome banner** nad główną tabelą:
  - "Welcome back! 847 traders analyzed markets today."
  - Avatar stack (4-5 anonymous avatars)
  - Link do ostatniego AI briefing: "Read today's briefing →"

**Implementacja:**
```tsx
// src/app/page.tsx - tuż po Header
<div className="bg-gradient-to-r from-emerald-900/20 to-zinc-900 border border-emerald-800/30 rounded-xl p-6 mb-6">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-lg font-semibold text-zinc-100 mb-1">Welcome back!</h2>
      <p className="text-sm text-zinc-400">847 traders analyzed markets today</p>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex -space-x-2">
        {/* Avatar stack */}
      </div>
      <Link href="/briefing" className="text-sm text-emerald-400 hover:text-emerald-300">
        Read today's briefing →
      </Link>
    </div>
  </div>
</div>
```

---

## 🎨 Zaawansowane poprawki (Week 2-3)

### 6. **Animated Chart Previews** (2h)
**Problem:** `/chart` route wymaga kliknięcia. Brak preview w dashboard.

**Fix:** Dodaj mini-chart preview (7-day sparkline) w karcie każdego symbolu na dashboard.

---

### 7. **Trust Signals w Footer** (45 min)
**Fix z audytu (fix #5):** Zamień generyczne trust signals na konkretne:
- "Powered by Claude AI + CoinGecko real-time data"
- "Telegram alerts in <30s"
- "300+ signals backtested 2023–2025"

Dodaj jako footer w layout.

---

### 8. **AI Assistant Shortcut** (1h)
**Fix:** Floating action button (FAB) w prawym dolnym rogu:
- Icon: sparkles/robot
- On click: otwiera `/assistant` w slide-over panel (nie full page)
- Keyboard shortcut: `Cmd+K`

---

### 9. **Onboarding Tour dla nowych userów** (3h)
**Fix z audytu (steal #5 - persony):**
- Modal po pierwszym loginie: "What's your trading style?"
  - Day Trader
  - DeFi Investor
  - Long-term Hodler
  - Crypto Fund Manager
- Dostosuj dashboard view na podstawie wyboru

---

### 10. **Dashboard Customization** (4h)
**Fix:** Pozwól użytkownikom customizować widok:
- Drag & drop widget order
- Show/hide timeframes
- Favorite symbols (pin to top)
- Save layouts per user

---

## 📊 Metryki sukcesu

### Przed zmianami (baseline):
- Time on page: ~2min
- Clicks to /assistant: X/day
- Bounce rate: Y%

### Po zmianach (target):
- Time on page: +40% (3min)
- Clicks to /assistant: +100%
- Bounce rate: -25%
- User retention (7-day): +30%

---

## 🛠 Priorytet wdrożenia (kolejność)

### Sprint 1 (Quick Wins - 3h total)
1. ✅ Header CTA button (30min)
2. ✅ Real-time indicator (20min)
3. ✅ Bias score enhancement (30min)
4. ✅ Dashboard metrics cards (45min)
5. ✅ Welcome banner (45min)

### Sprint 2 (Polish - 4h)
6. Trust signals footer (45min)
7. AI Assistant FAB (1h)
8. Animated chart previews (2h)

### Sprint 3 (Advanced - 7h)
9. Onboarding tour (3h)
10. Dashboard customization (4h)

---

## 💡 Design Tokens (zgodnie z audytem)

```css
/* Kolory akcji */
--accent: #10b981 (emerald-500)
--accent-hover: #059669 (emerald-600)
--accent-dim: rgba(16, 185, 129, 0.12)

/* Status indicators */
--bullish: #7ee787
--bearish: #ff6b6b
--neutral: #888

/* Typography */
--font-mono: 'Geist Mono'
--font-sans: 'Geist'

/* Spacing dla metrics */
--metric-number-size: 2.5rem (40px)
--metric-label-size: 0.75rem (12px)
```

---

## 🚀 Next Steps

1. **Review tego planu** - czy zgadza się z Twoją wizją?
2. **Rozpocznij Sprint 1** - Quick wins najpierw
3. **Testuj po każdej zmianie** - porównaj before/after
4. **Zbieraj feedback** - od userów beta

Gotowy do wdrożenia?
