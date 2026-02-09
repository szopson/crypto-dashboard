"""
GitHub API integration for repository statistics.
Works without token (60 req/h) or with token (5000 req/h).
"""
import httpx
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class GitHubData:
    """Data from GitHub API."""
    repo_name: str
    owner: str
    stars: int = 0
    forks: int = 0
    watchers: int = 0
    open_issues: int = 0
    contributors_count: int = 0
    last_commit_date: Optional[str] = None
    commits_last_30d: int = 0
    commits_last_year: int = 0
    created_at: Optional[str] = None
    language: Optional[str] = None
    license: Optional[str] = None
    is_archived: bool = False
    repo_url: str = ""


class GitHubService:
    """Service for fetching data from GitHub API."""

    BASE_URL = "https://api.github.com"
    TIMEOUT = 30.0

    def __init__(self):
        self.token = settings.github_token

    def _get_headers(self) -> dict:
        """Get headers for GitHub API requests."""
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "TradingCommandCenter/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def extract_repo_from_url(self, url: str) -> Optional[tuple[str, str]]:
        """
        Extract owner and repo name from GitHub URL.
        Handles various URL formats.
        """
        if not url:
            return None

        # Patterns to match GitHub URLs
        patterns = [
            r"github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/.*)?$",
            r"^([^/]+)/([^/]+)$",  # Just owner/repo format
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                owner = match.group(1)
                repo = match.group(2).rstrip("/")
                # Remove .git suffix if present
                if repo.endswith(".git"):
                    repo = repo[:-4]
                return owner, repo

        return None

    async def get_repo_stats(self, owner: str, repo: str) -> Optional[GitHubData]:
        """
        Fetch repository statistics.
        """
        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                # Fetch main repo data
                response = await client.get(
                    f"{self.BASE_URL}/repos/{owner}/{repo}",
                    headers=self._get_headers()
                )
                response.raise_for_status()
                data = response.json()

                github_data = GitHubData(
                    repo_name=data.get("name", repo),
                    owner=data.get("owner", {}).get("login", owner),
                    stars=data.get("stargazers_count", 0),
                    forks=data.get("forks_count", 0),
                    watchers=data.get("subscribers_count", 0),
                    open_issues=data.get("open_issues_count", 0),
                    created_at=data.get("created_at"),
                    language=data.get("language"),
                    license=data.get("license", {}).get("spdx_id") if data.get("license") else None,
                    is_archived=data.get("archived", False),
                    repo_url=data.get("html_url", f"https://github.com/{owner}/{repo}"),
                )

                return github_data

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.debug(f"GitHub repo not found: {owner}/{repo}")
            elif e.response.status_code == 403:
                logger.warning("GitHub API rate limit exceeded")
            else:
                logger.error(f"GitHub API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to fetch GitHub repo stats: {e}")
            return None

    async def get_commit_activity(self, owner: str, repo: str) -> Optional[dict]:
        """
        Fetch commit activity for the last year (52 weeks).
        Returns weekly commit counts.
        """
        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                response = await client.get(
                    f"{self.BASE_URL}/repos/{owner}/{repo}/stats/commit_activity",
                    headers=self._get_headers()
                )

                # GitHub returns 202 if stats are being computed
                if response.status_code == 202:
                    logger.debug("GitHub is computing stats, returning None")
                    return None

                response.raise_for_status()
                weeks = response.json()

                if not weeks:
                    return None

                # Calculate commits in last 30 days (approximately 4 weeks)
                last_4_weeks = weeks[-4:] if len(weeks) >= 4 else weeks
                commits_30d = sum(week.get("total", 0) for week in last_4_weeks)

                # Total commits in last year
                commits_year = sum(week.get("total", 0) for week in weeks)

                return {
                    "commits_last_30d": commits_30d,
                    "commits_last_year": commits_year,
                    "weekly_data": weeks,
                }

        except httpx.HTTPStatusError as e:
            logger.debug(f"Failed to fetch commit activity: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching commit activity: {e}")
            return None

    async def get_contributors_count(self, owner: str, repo: str) -> int:
        """
        Get the number of contributors.
        Uses pagination header to get count without fetching all contributors.
        """
        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                response = await client.get(
                    f"{self.BASE_URL}/repos/{owner}/{repo}/contributors",
                    headers=self._get_headers(),
                    params={"per_page": 1, "anon": "false"}
                )

                if response.status_code == 202:
                    return 0

                response.raise_for_status()

                # Check Link header for pagination
                link_header = response.headers.get("Link", "")
                if 'rel="last"' in link_header:
                    # Extract page number from last link
                    match = re.search(r'page=(\d+)>; rel="last"', link_header)
                    if match:
                        return int(match.group(1))

                # If no pagination, count the contributors in response
                contributors = response.json()
                return len(contributors) if isinstance(contributors, list) else 0

        except Exception as e:
            logger.debug(f"Failed to get contributors count: {e}")
            return 0

    async def get_last_commit_date(self, owner: str, repo: str) -> Optional[str]:
        """Get the date of the last commit."""
        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                response = await client.get(
                    f"{self.BASE_URL}/repos/{owner}/{repo}/commits",
                    headers=self._get_headers(),
                    params={"per_page": 1}
                )
                response.raise_for_status()
                commits = response.json()

                if commits and isinstance(commits, list):
                    commit_date = commits[0].get("commit", {}).get("committer", {}).get("date")
                    return commit_date

                return None

        except Exception as e:
            logger.debug(f"Failed to get last commit date: {e}")
            return None

    async def get_full_repo_data(self, owner: str, repo: str) -> Optional[GitHubData]:
        """
        Get complete repository data including activity metrics.
        Combines multiple API calls.
        """
        # First get basic stats
        github_data = await self.get_repo_stats(owner, repo)
        if not github_data:
            return None

        # Get additional metrics in parallel would be ideal,
        # but we do it sequentially to avoid rate limits
        contributors = await self.get_contributors_count(owner, repo)
        github_data.contributors_count = contributors

        last_commit = await self.get_last_commit_date(owner, repo)
        github_data.last_commit_date = last_commit

        activity = await self.get_commit_activity(owner, repo)
        if activity:
            github_data.commits_last_30d = activity.get("commits_last_30d", 0)
            github_data.commits_last_year = activity.get("commits_last_year", 0)

        return github_data

    async def get_repo_from_links(self, links: dict) -> Optional[GitHubData]:
        """
        Extract GitHub repo from CoinGecko links and fetch data.
        """
        github_url = None

        # Check repos_url first (most reliable)
        repos = links.get("repos_url", {})
        if repos.get("github"):
            github_urls = repos["github"]
            if isinstance(github_urls, list) and github_urls:
                github_url = github_urls[0]

        if not github_url:
            return None

        result = self.extract_repo_from_url(github_url)
        if not result:
            return None

        owner, repo = result
        return await self.get_full_repo_data(owner, repo)


# Singleton instance
_instance: Optional[GitHubService] = None


def get_github_service() -> GitHubService:
    """Get singleton instance of GitHubService."""
    global _instance
    if _instance is None:
        _instance = GitHubService()
    return _instance
