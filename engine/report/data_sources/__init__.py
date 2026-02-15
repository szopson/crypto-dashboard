"""
Data Sources for PDF Report Generation.

Provides clients for external data APIs:
- CoinGecko: Price, market cap, ATH, supply
- DefiLlama: TVL, protocol revenue
- GitHub: Development activity
- Social: Community metrics (placeholder)
- ICT Analysis: Smart Money Concepts for reports
"""

from .coingecko import CoinGeckoDataSource, get_coingecko_source
from .defillama import DefiLlamaDataSource, get_defillama_source
from .github_activity import GitHubDataSource, get_github_source
from .social import SocialDataSource, get_social_source
from .ict_analysis import ICTAnalysisDataSource, get_ict_analysis_source

__all__ = [
    "CoinGeckoDataSource",
    "get_coingecko_source",
    "DefiLlamaDataSource",
    "get_defillama_source",
    "GitHubDataSource",
    "get_github_source",
    "SocialDataSource",
    "get_social_source",
    "ICTAnalysisDataSource",
    "get_ict_analysis_source",
]
