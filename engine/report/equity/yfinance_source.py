"""
Yahoo Finance data source for equity reports.

Fetches everything we need for the 11-section report:
- Company info (sector, industry, summary, website)
- Pricing (current, 52-week range, history)
- Valuation ratios (P/E, P/S, EV/EBITDA, PEG)
- Financials (income, balance sheet, cash flow, quarterly + annual)
- Margins, growth, profitability
- Ownership (insiders, institutions, float, short interest)
- News headlines
- Analyst recommendations (target price, ratings)
- Earnings history and upcoming dates
- Insider transactions (recent buys/sells)
- Major institutional holders
"""
import asyncio
from datetime import datetime, timedelta
from typing import Any, Optional

import yfinance as yf
from loguru import logger


class EquityNotFoundError(Exception):
    def __init__(self, ticker: str):
        self.ticker = ticker
        super().__init__(f"Equity '{ticker}' not found or no data available")


def _safe(d: Any, k: str, default: Any = None) -> Any:
    """Get key from dict-like, return default on missing/None."""
    try:
        v = d.get(k) if hasattr(d, "get") else default
        return v if v is not None else default
    except Exception:
        return default


def _ratio(num: Optional[float], denom: Optional[float]) -> Optional[float]:
    if num is None or denom is None or denom == 0:
        return None
    try:
        return num / denom
    except Exception:
        return None


class YFinanceSource:
    """Synchronous yfinance wrapped in async-friendly methods."""

    def __init__(self):
        pass

    async def fetch_all(self, ticker: str) -> dict[str, Any]:
        """Fetch all available data for ticker in parallel where possible."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_all_sync, ticker)

    def _fetch_all_sync(self, ticker: str) -> dict[str, Any]:
        ticker = ticker.upper()
        try:
            t = yf.Ticker(ticker)
            info = t.info or {}
        except Exception as e:
            logger.error(f"yfinance failed for {ticker}: {e}")
            raise EquityNotFoundError(ticker)

        if not info or not info.get("symbol") and not info.get("shortName"):
            raise EquityNotFoundError(ticker)

        out: dict[str, Any] = {
            "ticker": ticker,
            "fetched_at": datetime.utcnow().isoformat(),
            "company": self._company(info),
            "price": self._price(info),
            "valuation": self._valuation(info),
            "financials": self._financials(info),
            "margins_growth": self._margins_growth(info),
            "balance": self._balance(info),
            "ownership": self._ownership(info),
            "dividend": self._dividend(info),
            "analysts": self._analysts(info),
            "raw_info_keys": sorted(list(info.keys())),
        }

        # Time-series and tables - each in its own try so one failure doesn't kill the whole report
        out["history"] = self._safe_history(t)
        out["income_quarterly"] = self._safe_financials(t, "quarterly_income_stmt")
        out["income_annual"] = self._safe_financials(t, "income_stmt")
        out["balance_quarterly"] = self._safe_financials(t, "quarterly_balance_sheet")
        out["cashflow_quarterly"] = self._safe_financials(t, "quarterly_cashflow")
        out["earnings_dates"] = self._safe_earnings_dates(t)
        out["recommendations"] = self._safe_recommendations(t)
        out["institutional_holders"] = self._safe_holders(t, "institutional_holders")
        out["major_holders"] = self._safe_holders(t, "major_holders")
        out["insider_transactions"] = self._safe_holders(t, "insider_transactions")
        out["news"] = self._safe_news(t)

        # Derived/computed convenience fields
        out["computed"] = self._compute_derived(out)

        return out

    # ---------- Section extractors ----------

    def _company(self, info: dict) -> dict:
        return {
            "name": _safe(info, "longName") or _safe(info, "shortName"),
            "short_name": _safe(info, "shortName"),
            "sector": _safe(info, "sector"),
            "industry": _safe(info, "industry"),
            "website": _safe(info, "website"),
            "country": _safe(info, "country"),
            "city": _safe(info, "city"),
            "employees": _safe(info, "fullTimeEmployees"),
            "summary": _safe(info, "longBusinessSummary"),
            "exchange": _safe(info, "exchange") or _safe(info, "fullExchangeName"),
        }

    def _price(self, info: dict) -> dict:
        return {
            "current": _safe(info, "currentPrice") or _safe(info, "regularMarketPrice"),
            "previous_close": _safe(info, "previousClose"),
            "day_high": _safe(info, "dayHigh"),
            "day_low": _safe(info, "dayLow"),
            "fifty_two_week_high": _safe(info, "fiftyTwoWeekHigh"),
            "fifty_two_week_low": _safe(info, "fiftyTwoWeekLow"),
            "fifty_day_avg": _safe(info, "fiftyDayAverage"),
            "two_hundred_day_avg": _safe(info, "twoHundredDayAverage"),
            "market_cap": _safe(info, "marketCap"),
            "enterprise_value": _safe(info, "enterpriseValue"),
            "volume": _safe(info, "volume"),
            "avg_volume": _safe(info, "averageVolume"),
            "beta": _safe(info, "beta"),
            "currency": _safe(info, "currency"),
        }

    def _valuation(self, info: dict) -> dict:
        return {
            "trailing_pe": _safe(info, "trailingPE"),
            "forward_pe": _safe(info, "forwardPE"),
            "peg_ratio": _safe(info, "pegRatio") or _safe(info, "trailingPegRatio"),
            "price_to_sales": _safe(info, "priceToSalesTrailing12Months"),
            "price_to_book": _safe(info, "priceToBook"),
            "ev_to_revenue": _safe(info, "enterpriseToRevenue"),
            "ev_to_ebitda": _safe(info, "enterpriseToEbitda"),
            "book_value": _safe(info, "bookValue"),
        }

    def _financials(self, info: dict) -> dict:
        return {
            "total_revenue": _safe(info, "totalRevenue"),
            "revenue_per_share": _safe(info, "revenuePerShare"),
            "gross_profits": _safe(info, "grossProfits"),
            "ebitda": _safe(info, "ebitda"),
            "net_income": _safe(info, "netIncomeToCommon"),
            "trailing_eps": _safe(info, "trailingEps"),
            "forward_eps": _safe(info, "forwardEps"),
            "free_cashflow": _safe(info, "freeCashflow"),
            "operating_cashflow": _safe(info, "operatingCashflow"),
        }

    def _margins_growth(self, info: dict) -> dict:
        return {
            "gross_margin": _safe(info, "grossMargins"),
            "operating_margin": _safe(info, "operatingMargins"),
            "profit_margin": _safe(info, "profitMargins"),
            "ebitda_margin": _safe(info, "ebitdaMargins"),
            "fcf_margin": _ratio(_safe(info, "freeCashflow"), _safe(info, "totalRevenue")),
            "return_on_equity": _safe(info, "returnOnEquity"),
            "return_on_assets": _safe(info, "returnOnAssets"),
            "revenue_growth": _safe(info, "revenueGrowth"),
            "earnings_growth": _safe(info, "earningsGrowth"),
            "earnings_quarterly_growth": _safe(info, "earningsQuarterlyGrowth"),
            "revenue_quarterly_growth": _safe(info, "revenueQuarterlyGrowth"),
        }

    def _balance(self, info: dict) -> dict:
        return {
            "total_cash": _safe(info, "totalCash"),
            "cash_per_share": _safe(info, "totalCashPerShare"),
            "total_debt": _safe(info, "totalDebt"),
            "debt_to_equity": _safe(info, "debtToEquity"),
            "quick_ratio": _safe(info, "quickRatio"),
            "current_ratio": _safe(info, "currentRatio"),
            "total_assets": _safe(info, "totalAssets"),
        }

    def _ownership(self, info: dict) -> dict:
        return {
            "held_pct_insiders": _safe(info, "heldPercentInsiders"),
            "held_pct_institutions": _safe(info, "heldPercentInstitutions"),
            "short_pct_of_float": _safe(info, "shortPercentOfFloat"),
            "short_ratio": _safe(info, "shortRatio"),
            "shares_outstanding": _safe(info, "sharesOutstanding"),
            "float_shares": _safe(info, "floatShares"),
            "shares_short": _safe(info, "sharesShort"),
            "shares_short_prior_month": _safe(info, "sharesShortPriorMonth"),
            "implied_shares_outstanding": _safe(info, "impliedSharesOutstanding"),
        }

    def _dividend(self, info: dict) -> dict:
        return {
            "dividend_yield": _safe(info, "dividendYield"),
            "dividend_rate": _safe(info, "dividendRate"),
            "payout_ratio": _safe(info, "payoutRatio"),
            "five_year_avg_yield": _safe(info, "fiveYearAvgDividendYield"),
            "ex_dividend_date": _safe(info, "exDividendDate"),
        }

    def _analysts(self, info: dict) -> dict:
        return {
            "target_mean": _safe(info, "targetMeanPrice"),
            "target_high": _safe(info, "targetHighPrice"),
            "target_low": _safe(info, "targetLowPrice"),
            "target_median": _safe(info, "targetMedianPrice"),
            "recommendation": _safe(info, "recommendationKey"),
            "recommendation_mean": _safe(info, "recommendationMean"),
            "num_analysts": _safe(info, "numberOfAnalystOpinions"),
        }

    # ---------- Time-series and tables ----------

    def _safe_history(self, t) -> list:
        try:
            hist = t.history(period="1y", interval="1d", auto_adjust=True)
            if hist is None or hist.empty:
                return []
            # Sample to ~52 weekly bars to keep payload small
            weekly = hist.resample("W").last().dropna()
            return [
                {
                    "date": idx.strftime("%Y-%m-%d"),
                    "close": float(row["Close"]),
                    "volume": float(row["Volume"]),
                }
                for idx, row in weekly.iterrows()
            ]
        except Exception as e:
            logger.warning(f"history fetch failed: {e}")
            return []

    def _safe_financials(self, t, attr: str) -> dict:
        try:
            df = getattr(t, attr, None)
            if df is None or df.empty:
                return {}
            return {
                col.strftime("%Y-%m-%d"): {str(k): (float(v) if v == v else None) for k, v in df[col].items()}
                for col in df.columns
            }
        except Exception as e:
            logger.warning(f"{attr} fetch failed: {e}")
            return {}

    def _safe_earnings_dates(self, t) -> list:
        try:
            df = t.earnings_dates
            if df is None or df.empty:
                return []
            out = []
            for idx, row in df.head(8).iterrows():
                out.append({
                    "date": idx.strftime("%Y-%m-%d"),
                    "eps_estimate": float(row.get("EPS Estimate")) if row.get("EPS Estimate") == row.get("EPS Estimate") else None,
                    "eps_actual": float(row.get("Reported EPS")) if row.get("Reported EPS") == row.get("Reported EPS") else None,
                    "surprise_pct": float(row.get("Surprise(%)")) if row.get("Surprise(%)") == row.get("Surprise(%)") else None,
                })
            return out
        except Exception as e:
            logger.warning(f"earnings_dates fetch failed: {e}")
            return []

    def _safe_recommendations(self, t) -> list:
        try:
            df = t.recommendations
            if df is None or len(df) == 0:
                return []
            return df.tail(8).to_dict(orient="records")
        except Exception as e:
            logger.warning(f"recommendations fetch failed: {e}")
            return []

    def _safe_holders(self, t, attr: str) -> list:
        try:
            df = getattr(t, attr, None)
            if df is None or len(df) == 0:
                return []
            return df.head(15).to_dict(orient="records") if hasattr(df, "to_dict") else []
        except Exception as e:
            logger.warning(f"{attr} fetch failed: {e}")
            return []

    def _safe_news(self, t) -> list:
        try:
            items = t.news or []
            out = []
            for item in items[:10]:
                content = item.get("content", item) if isinstance(item, dict) else {}
                out.append({
                    "title": content.get("title") or item.get("title"),
                    "publisher": (content.get("provider", {}) or {}).get("displayName") or item.get("publisher"),
                    "link": ((content.get("canonicalUrl") or {}).get("url")) or item.get("link"),
                    "published": content.get("pubDate") or item.get("providerPublishTime"),
                    "summary": content.get("summary"),
                })
            return out
        except Exception as e:
            logger.warning(f"news fetch failed: {e}")
            return []

    # ---------- Derived ----------

    def _compute_derived(self, data: dict) -> dict:
        """Compute fields useful for the report (deltas, 52w position, etc.)."""
        price = data["price"]
        comp: dict[str, Any] = {}

        cur = price.get("current")
        hi = price.get("fifty_two_week_high")
        lo = price.get("fifty_two_week_low")
        if cur and hi and lo and hi > lo:
            comp["pct_off_52w_high"] = (cur - hi) / hi * 100
            comp["pct_above_52w_low"] = (cur - lo) / lo * 100
            comp["position_in_52w"] = (cur - lo) / (hi - lo)

        target = data["analysts"].get("target_mean")
        if cur and target:
            comp["target_upside_pct"] = (target - cur) / cur * 100

        # FCF yield = FCF / market cap
        fcf = data["financials"].get("free_cashflow")
        cap = price.get("market_cap")
        if fcf and cap:
            comp["fcf_yield"] = fcf / cap

        # Revenue per employee
        rev = data["financials"].get("total_revenue")
        emp = data["company"].get("employees")
        if rev and emp:
            comp["revenue_per_employee"] = rev / emp

        # Net cash / debt
        cash = data["balance"].get("total_cash")
        debt = data["balance"].get("total_debt")
        if cash is not None and debt is not None:
            comp["net_cash"] = cash - debt

        return comp


_singleton: Optional[YFinanceSource] = None


def get_yfinance_source() -> YFinanceSource:
    global _singleton
    if _singleton is None:
        _singleton = YFinanceSource()
    return _singleton
