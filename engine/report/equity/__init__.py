"""
Equity Investment Report Module.

Generates equity research reports modeled on the Coinbase/MARA PDF format:
11 sections covering scoreboard, QoQ changes, ownership, seven metrics,
peer comparison, business strategy, monetary policy sensitivity, SWOT,
catalysts, and technical analysis.

Output formats: MDX (for Next.js render) and HTML (reusing existing PDF pipeline).
"""

from .sectors import SECTORS, get_sector_for_ticker, all_tickers
from .generator import EquityReportGenerator, get_equity_generator

__all__ = [
    "SECTORS",
    "get_sector_for_ticker",
    "all_tickers",
    "EquityReportGenerator",
    "get_equity_generator",
]
