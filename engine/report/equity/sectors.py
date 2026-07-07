"""
Sector and ticker coverage for equity research.

12 sectors × 5 companies = 60 reports seed. New-tech focus.
"""
from typing import Optional


SECTORS: dict[str, dict] = {
    "semiconductors": {
        "name": "Semiconductors",
        "slug": "semiconductors",
        "description": "Chip designers and fabs powering AI, computing, and connectivity.",
        "tickers": ["NVDA", "TSM", "ASML", "AMD", "AVGO"],
    },
    "ai-infrastructure": {
        "name": "AI Infrastructure",
        "slug": "ai-infrastructure",
        "description": "Hyperscalers and platforms building the compute backbone for AI workloads.",
        "tickers": ["MSFT", "GOOGL", "META", "ORCL", "SMCI"],
    },
    "ai-pure-play": {
        "name": "AI Pure-Play",
        "slug": "ai-pure-play",
        "description": "Companies whose primary thesis is direct exposure to AI applications.",
        "tickers": ["PLTR", "AI", "PATH", "SOUN", "BBAI"],
    },
    "space": {
        "name": "Space",
        "slug": "space",
        "description": "Launch, satellites, geospatial, and space infrastructure plays.",
        "tickers": ["RKLB", "ASTS", "LUNR", "IRDM", "PL"],
    },
    "quantum": {
        "name": "Quantum Computing",
        "slug": "quantum",
        "description": "Pure-play quantum computing hardware and software companies.",
        "tickers": ["IONQ", "RGTI", "QBTS", "QUBT", "ARQQ"],
    },
    "pharma-biotech": {
        "name": "Pharma & Biotech",
        "slug": "pharma-biotech",
        "description": "Drug developers from large-cap pharma to high-conviction biotech.",
        "tickers": ["LLY", "NVO", "REGN", "VRTX", "MRNA"],
    },
    "nuclear-smr": {
        "name": "Nuclear & SMR",
        "slug": "nuclear-smr",
        "description": "Nuclear utilities and small modular reactor developers benefiting from AI power demand.",
        "tickers": ["VST", "CEG", "OKLO", "SMR", "NNE"],
    },
    "uranium": {
        "name": "Uranium",
        "slug": "uranium",
        "description": "Uranium miners and fuel suppliers feeding the nuclear renaissance.",
        "tickers": ["CCJ", "UEC", "NXE", "LEU", "UUUU"],
    },
    "energy-storage": {
        "name": "Energy Storage",
        "slug": "energy-storage",
        "description": "Batteries, grid storage, and energy management critical to renewables.",
        "tickers": ["ENPH", "ALB", "QS", "FLNC", "STEM"],
    },
    "robotics": {
        "name": "Robotics & Automation",
        "slug": "robotics",
        "description": "Industrial, surgical, and warehouse robotics plus automation platforms.",
        "tickers": ["ISRG", "SYM", "ABB", "ROK", "KSCP"],
    },
    "china-tech": {
        "name": "China Tech",
        "slug": "china-tech",
        "description": "Chinese internet and consumer tech with global ambitions.",
        "tickers": ["BABA", "JD", "PDD", "BIDU", "TCEHY"],
    },
    "defense": {
        "name": "Defense",
        "slug": "defense",
        "description": "Defense primes and emerging drone, autonomy, and missile companies.",
        "tickers": ["LMT", "RTX", "NOC", "KTOS", "AVAV"],
    },
}


def get_sector_for_ticker(ticker: str) -> Optional[dict]:
    """Find sector dict containing this ticker, or None."""
    t = ticker.upper()
    for sector in SECTORS.values():
        if t in sector["tickers"]:
            return sector
    return None


def all_tickers() -> list[tuple[str, str]]:
    """Return list of (ticker, sector_slug) tuples for the full seed."""
    out = []
    for slug, sector in SECTORS.items():
        for tk in sector["tickers"]:
            out.append((tk, slug))
    return out
