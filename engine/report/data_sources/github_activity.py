"""
GitHub API Data Source.

Provides development activity metrics.
API Documentation: https://docs.github.com/en/rest
"""
import httpx
from typing import Dict, Any, Optional
from loguru import logger


class GitHubDataSource:
    """
    GitHub API client for development activity.

    Free API, no authentication required (rate limited to 60 req/hour).
    With token: 5000 req/hour.
    """

    BASE_URL = "https://api.github.com"

    # Common ticker to GitHub org/repo mapping
    TICKER_MAP = {
        "SOL": "solana-labs/solana",
        "ETH": "ethereum/go-ethereum",
        "AVAX": "ava-labs/avalanchego",
        "DOT": "paritytech/polkadot-sdk",
        "ATOM": "cosmos/cosmos-sdk",
        "NEAR": "near/nearcore",
        "SUI": "MystenLabs/sui",
        "APT": "aptos-labs/aptos-core",
        "ARB": "OffchainLabs/nitro",
        "OP": "ethereum-optimism/optimism",
        "AAVE": "aave/aave-v3-core",
        "UNI": "Uniswap/v3-core",
        "MKR": "makerdao/dss",
        "CRV": "curvefi/curve-contract",
        "LDO": "lidofinance/lido-dao",
        "LINK": "smartcontractkit/chainlink",
    }

    def __init__(self, api_token: Optional[str] = None):
        self.api_token = api_token
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if api_token:
            self.headers["Authorization"] = f"token {api_token}"

    async def fetch(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch GitHub activity data for a project.

        Args:
            ticker: Token symbol (e.g., "SOL", "ETH")

        Returns:
            Dict with GitHub metrics including commit history
        """
        data = {
            "repo_name": None,
            "repo_url": None,  # New: Direct link to repository
            "stars": None,
            "forks": None,
            "open_issues": None,
            "watchers": None,
            "contributors": None,
            "commits_4_weeks": None,
            "commits_history": [],  # New: Weekly commits for last 52 weeks
            "last_commit": None,
            "language": None,
        }

        repo_path = self.TICKER_MAP.get(ticker.upper())
        if not repo_path:
            logger.warning(f"No GitHub mapping for {ticker}")
            return data

        try:
            async with httpx.AsyncClient(timeout=30, headers=self.headers) as client:
                # Get repo info
                response = await client.get(f"{self.BASE_URL}/repos/{repo_path}")
                if response.status_code == 200:
                    repo = response.json()
                    data["repo_name"] = repo.get("full_name")
                    data["repo_url"] = f"https://github.com/{repo_path}"  # New: repo URL
                    data["stars"] = repo.get("stargazers_count")
                    data["forks"] = repo.get("forks_count")
                    data["open_issues"] = repo.get("open_issues_count")
                    data["watchers"] = repo.get("subscribers_count")
                    data["language"] = repo.get("language")
                    data["last_commit"] = repo.get("pushed_at")

                # Get commit activity (last 52 weeks)
                response = await client.get(
                    f"{self.BASE_URL}/repos/{repo_path}/stats/commit_activity"
                )
                if response.status_code == 200:
                    activity = response.json()
                    if activity and isinstance(activity, list):
                        # Sum last 4 weeks
                        recent_weeks = activity[-4:] if len(activity) >= 4 else activity
                        data["commits_4_weeks"] = sum(
                            week.get("total", 0) for week in recent_weeks
                        )

                        # New: Store full 52-week history for chart
                        data["commits_history"] = [
                            {
                                "week": i,
                                "commits": week.get("total", 0),
                                "timestamp": week.get("week", 0),
                            }
                            for i, week in enumerate(activity[-52:])  # Last 52 weeks
                        ]

                # Get contributor count
                response = await client.get(
                    f"{self.BASE_URL}/repos/{repo_path}/contributors",
                    params={"per_page": 1, "anon": "true"}
                )
                if response.status_code == 200:
                    # Get count from Link header
                    link_header = response.headers.get("Link", "")
                    if 'rel="last"' in link_header:
                        # Parse last page number
                        import re
                        match = re.search(r'page=(\d+)>; rel="last"', link_header)
                        if match:
                            data["contributors"] = int(match.group(1))
                    else:
                        # Only one page
                        data["contributors"] = len(response.json())

                logger.info(f"GitHub data fetched for {ticker}")

        except Exception as e:
            logger.error(f"GitHub fetch error for {ticker}: {e}")

        return data


# Singleton
_github_source: Optional[GitHubDataSource] = None


def get_github_source(api_token: Optional[str] = None) -> GitHubDataSource:
    """Get or create GitHub data source singleton."""
    global _github_source
    if _github_source is None:
        _github_source = GitHubDataSource(api_token)
    return _github_source
