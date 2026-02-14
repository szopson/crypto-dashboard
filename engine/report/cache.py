"""
Report caching system.

Caches generated PDF reports to avoid regenerating identical reports.
TTL: 14 days (configurable)
"""
import os
import json
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple
from loguru import logger


class ReportCache:
    """
    File-based report cache.

    Cache structure:
    - cache_dir/
      - {ticker}_{hash}.pdf  (the PDF file)
      - {ticker}_{hash}.meta (metadata JSON)
    """

    DEFAULT_TTL_DAYS = 14

    def __init__(self, cache_dir: str = None, ttl_days: int = None):
        self.cache_dir = Path(cache_dir or self._default_cache_dir())
        self.ttl_days = ttl_days or self.DEFAULT_TTL_DAYS
        self._ensure_cache_dir()

    def _default_cache_dir(self) -> str:
        """Get default cache directory."""
        # Use reports directory in engine folder
        base_dir = Path(__file__).parent.parent
        return str(base_dir / "cache" / "reports")

    def _ensure_cache_dir(self):
        """Create cache directory if it doesn't exist."""
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Create .gitignore to exclude cache from git
        gitignore = self.cache_dir / ".gitignore"
        if not gitignore.exists():
            gitignore.write_text("*\n!.gitignore\n")

    def _get_cache_key(self, ticker: str) -> str:
        """
        Generate cache key for a ticker.

        Key is based on ticker only (date-independent).
        TTL is enforced via metadata timestamp.
        """
        return ticker.upper()

    def _get_cache_paths(self, cache_key: str) -> Tuple[Path, Path]:
        """Get paths for PDF and metadata files."""
        pdf_path = self.cache_dir / f"{cache_key}.pdf"
        meta_path = self.cache_dir / f"{cache_key}.meta"
        return pdf_path, meta_path

    def get(self, ticker: str) -> Optional[bytes]:
        """
        Get cached report for ticker if valid.

        Returns:
            PDF bytes if cache hit and not expired, None otherwise
        """
        cache_key = self._get_cache_key(ticker)
        pdf_path, meta_path = self._get_cache_paths(cache_key)

        # Check if both files exist
        if not pdf_path.exists() or not meta_path.exists():
            logger.debug(f"Cache miss for {ticker}: files not found")
            return None

        # Read and validate metadata
        try:
            meta = json.loads(meta_path.read_text())
            created_at = datetime.fromisoformat(meta["created_at"])
            expires_at = created_at + timedelta(days=self.ttl_days)

            if datetime.now() > expires_at:
                logger.info(f"Cache expired for {ticker} (created: {created_at})")
                self._delete_cache(cache_key)
                return None

            # Cache hit
            pdf_bytes = pdf_path.read_bytes()
            age_hours = (datetime.now() - created_at).total_seconds() / 3600
            logger.info(f"Cache hit for {ticker} (age: {age_hours:.1f}h, size: {len(pdf_bytes)} bytes)")
            return pdf_bytes

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Invalid cache metadata for {ticker}: {e}")
            self._delete_cache(cache_key)
            return None

    def set(self, ticker: str, pdf_bytes: bytes, metadata: dict = None) -> bool:
        """
        Store report in cache.

        Args:
            ticker: Token ticker
            pdf_bytes: PDF file content
            metadata: Optional additional metadata

        Returns:
            True if cached successfully
        """
        cache_key = self._get_cache_key(ticker)
        pdf_path, meta_path = self._get_cache_paths(cache_key)

        try:
            # Write PDF
            pdf_path.write_bytes(pdf_bytes)

            # Write metadata
            meta = {
                "ticker": ticker.upper(),
                "created_at": datetime.now().isoformat(),
                "size_bytes": len(pdf_bytes),
                "ttl_days": self.ttl_days,
                **(metadata or {})
            }
            meta_path.write_text(json.dumps(meta, indent=2))

            logger.info(f"Cached report for {ticker} ({len(pdf_bytes)} bytes, TTL: {self.ttl_days} days)")
            return True

        except Exception as e:
            logger.error(f"Failed to cache report for {ticker}: {e}")
            return False

    def _delete_cache(self, cache_key: str):
        """Delete cached files for a key."""
        pdf_path, meta_path = self._get_cache_paths(cache_key)

        try:
            if pdf_path.exists():
                pdf_path.unlink()
            if meta_path.exists():
                meta_path.unlink()
        except Exception as e:
            logger.warning(f"Failed to delete cache for {cache_key}: {e}")

    def invalidate(self, ticker: str) -> bool:
        """
        Manually invalidate cache for a ticker.

        Returns:
            True if cache was invalidated
        """
        cache_key = self._get_cache_key(ticker)
        pdf_path, meta_path = self._get_cache_paths(cache_key)

        existed = pdf_path.exists() or meta_path.exists()
        self._delete_cache(cache_key)

        if existed:
            logger.info(f"Invalidated cache for {ticker}")

        return existed

    def clear_all(self) -> int:
        """
        Clear all cached reports.

        Returns:
            Number of reports cleared
        """
        count = 0
        for pdf_file in self.cache_dir.glob("*.pdf"):
            cache_key = pdf_file.stem
            self._delete_cache(cache_key)
            count += 1

        logger.info(f"Cleared {count} cached reports")
        return count

    def cleanup_expired(self) -> int:
        """
        Remove expired cache entries.

        Returns:
            Number of entries removed
        """
        count = 0
        for meta_file in self.cache_dir.glob("*.meta"):
            try:
                meta = json.loads(meta_file.read_text())
                created_at = datetime.fromisoformat(meta["created_at"])
                ttl = meta.get("ttl_days", self.ttl_days)

                if datetime.now() > created_at + timedelta(days=ttl):
                    cache_key = meta_file.stem
                    self._delete_cache(cache_key)
                    count += 1

            except Exception:
                continue

        if count > 0:
            logger.info(f"Cleaned up {count} expired cache entries")

        return count

    def get_stats(self) -> dict:
        """Get cache statistics."""
        total_size = 0
        count = 0
        oldest = None
        newest = None

        for meta_file in self.cache_dir.glob("*.meta"):
            try:
                meta = json.loads(meta_file.read_text())
                count += 1
                total_size += meta.get("size_bytes", 0)

                created_at = datetime.fromisoformat(meta["created_at"])
                if oldest is None or created_at < oldest:
                    oldest = created_at
                if newest is None or created_at > newest:
                    newest = created_at

            except Exception:
                continue

        return {
            "count": count,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "oldest": oldest.isoformat() if oldest else None,
            "newest": newest.isoformat() if newest else None,
            "ttl_days": self.ttl_days,
            "cache_dir": str(self.cache_dir),
        }


# Singleton instance
_cache: Optional[ReportCache] = None


def get_report_cache() -> ReportCache:
    """Get or create report cache singleton."""
    global _cache
    if _cache is None:
        _cache = ReportCache()
    return _cache
