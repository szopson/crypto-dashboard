# Report System Improvements

Lista ulepszeń do zaimplementowania w przyszłości.

---

## High Priority

### 1. Bitcoin Cycle & Altseason Analysis
**Status:** Not implemented
**Impact:** High - directly affects trading decisions

Dodać do AI analysis:
- BTC dominance (current vs historical)
- Bitcoin cycle position (accumulation/markup/distribution/markdown)
- Altseason probability indicator
- Adjust price targets based on macro cycle

**Files to modify:**
- `engine/report/ai_synthesis.py` - add cycle context to prompts
- `engine/report/templates/crypto_report.html` - add cycle indicator section

**Data sources:**
- CoinGecko: BTC dominance, total market cap
- Alternative.me: Fear & Greed Index
- Or calculate from BTC price vs 200MA

---

### 2. TVL-based Chain Selection
**Status:** Partially implemented (priority order only)
**Impact:** Medium - better data quality for multi-chain tokens

Obecnie używamy priority order (Ethereum > Polygon > Arbitrum...).
Powinniśmy query'ować DefiLlama TVL dla każdego chainu i wybrać ten z najwyższym TVL.

**Files to modify:**
- `engine/report/generator.py` - `_select_best_chain()` method
- `engine/report/data_sources/defillama.py` - add `get_token_tvl_by_chain()`

**DefiLlama endpoint:**
```
GET https://api.llama.fi/tvl/{chain}:{contract_address}
```

---

### 3. Report Caching
**Status:** Not implemented
**Impact:** High - user experience (2min → instant)

Cache recent reports:
- Key: `{ticker}_{date}` or hash of input params
- TTL: 1 hour (configurable)
- Storage: Redis or file-based

**Implementation options:**
- Redis cache with `aioredis`
- File cache in `/tmp/reports/`
- SQLite cache table

**Files to modify:**
- `engine/report/generator.py` - add cache check before generation
- `engine/api/reports.py` - add `?force_refresh=true` param

---

### 4. Dune Query Optimization
**Status:** Issue identified
**Impact:** Medium - USDC and other large tokens timeout

Problem: Tokens with millions of holders (USDC, USDT) cause query timeout.

Solutions:
- Use `LIMIT` in Dune queries
- Use pre-aggregated Spellbook tables
- Add token size detection and skip Dune for very large tokens
- Cache Dune results longer (24h)

**Current query (6679657):**
```sql
-- Add LIMIT for holder count approximation
-- Or use tokens.erc20 for pre-calculated stats
```

---

## Medium Priority

### 5. Dynamic Competitor Selection
**Status:** Hardcoded competitors
**Impact:** Medium - more relevant comparisons

Obecnie: hardcoded MKR, MORPHO dla lending protocols.

Powinno być:
1. Get token category from CoinGecko
2. Find top 3-5 tokens in same category by market cap
3. Exclude the analyzed token
4. Fetch their data for comparison

**Files to modify:**
- `engine/report/generator.py` - add `_get_competitors()` method
- `engine/report/data_sources/coingecko.py` - add category search

---

### 6. Token Not Found Handling
**Status:** Silent failure
**Impact:** Medium - better UX

Gdy ticker nie istnieje w CoinGecko:
- Return proper error response (404)
- Include suggestions (similar tickers)
- Log for analytics

**Files to modify:**
- `engine/report/data_sources/coingecko.py` - better error handling
- `engine/api/reports.py` - return structured error

---

### 7. Real-time Progress Endpoint
**Status:** Not implemented
**Impact:** Medium - UX for long generation

Report generation takes ~2 minutes. User sees nothing.

Options:
- WebSocket endpoint for progress updates
- Server-Sent Events (SSE)
- Polling endpoint `/api/report/status/{job_id}`

Progress stages:
1. Fetching CoinGecko data...
2. Fetching DefiLlama data...
3. Fetching Dune data...
4. AI analysis...
5. Generating PDF...

---

## Nice to Have

### 8. PDF Dark Mode
**Status:** Not implemented
**Impact:** Low - aesthetic preference

Alternative dark theme template:
- Dark background (#1a1a2e)
- Light text
- Adjusted chart colors

**Files to create:**
- `engine/report/templates/crypto_report_dark.html`
- Add `?theme=dark` param to API

---

### 9. Multi-language Support
**Status:** Not implemented
**Impact:** Low-Medium - Polish market

Support for:
- Polish (default for your users?)
- English

**Implementation:**
- i18n library or simple dict-based translations
- AI prompts in target language
- Template strings externalized

---

### 10. Historical Reports & Comparison
**Status:** Not implemented
**Impact:** Medium - track changes over time

Store generated reports:
- Database table with metadata
- Compare current vs previous report
- Show score changes, price changes
- "Report history" endpoint

**Schema:**
```sql
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20),
    generated_at TIMESTAMP,
    verdict VARCHAR(20),
    score_total INT,
    price_at_generation DECIMAL,
    pdf_path VARCHAR(255)
);
```

---

## Implementation Order (Suggested)

1. **Report Caching** - quick win, big UX improvement
2. **Bitcoin Cycle Analysis** - high value for trading decisions
3. **Token Not Found Handling** - prevents confusion
4. **Dynamic Competitors** - better report quality
5. **Progress Endpoint** - UX improvement
6. **TVL-based Chain Selection** - data quality
7. **Dune Optimization** - edge case fix
8. Rest as needed...

---

## Notes

- Wszystkie zmiany powinny być backward compatible
- Testy dla każdej nowej funkcji
- Dokumentacja API po zmianach
