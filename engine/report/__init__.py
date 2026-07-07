"""
Investment Report Generator Module.

Provides:
- Crypto reports (crypto-dashboard original): ReportGeneratorService → PDF via Playwright
- Equity reports (engine.report.equity): MDX output for Next.js, Coinbase-style structure

The crypto report system depends on config + many runtime services and is therefore
loaded lazily via __getattr__ so that importing the lighter `equity` subpackage does
not pull in the entire crypto pipeline (and its env requirements).
"""

# Lazy attribute access for crypto-only symbols to avoid eager dependency loading.
def __getattr__(name):
    if name in ("ReportGeneratorService", "get_report_generator_service"):
        from .generator import ReportGeneratorService, get_report_generator_service
        return locals()[name]
    if name == "router":
        from .router import router
        return router
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "ReportGeneratorService",
    "get_report_generator_service",
    "router",
]
