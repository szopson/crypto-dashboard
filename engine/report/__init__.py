"""
PDF Investment Report Generator Module.

Provides comprehensive crypto investment reports with:
- Multi-source data aggregation (CoinGecko, DefiLlama, GitHub)
- AI-powered analysis synthesis (Claude API)
- Professional Bloomberg-style PDF rendering (Playwright)
- Telegram delivery integration
"""

from .generator import ReportGeneratorService, get_report_generator_service
from .router import router

__all__ = [
    "ReportGeneratorService",
    "get_report_generator_service",
    "router",
]
