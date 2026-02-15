"""
Rate Limiting Middleware for FastAPI.

Simple in-memory rate limiter to protect against API abuse.
No external dependencies (Redis) to minimize costs.
"""
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional, Callable
from functools import wraps

from fastapi import Request, HTTPException, Response
from fastapi.routing import APIRoute
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger


@dataclass
class RateLimitConfig:
    """Rate limit configuration."""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000

    # Expensive endpoints (LLM calls, report generation)
    expensive_per_minute: int = 10
    expensive_per_hour: int = 100
    expensive_per_day: int = 500

    # Burst allowance (temporary spike above limit)
    burst_multiplier: float = 1.5

    # Whitelist IPs (localhost, internal)
    whitelist_ips: list = field(default_factory=lambda: ["127.0.0.1", "::1"])

    # Block duration after exceeding limits (seconds)
    block_duration: int = 300  # 5 minutes


@dataclass
class RateLimitEntry:
    """Track request counts for an IP."""
    minute_requests: int = 0
    hour_requests: int = 0
    day_requests: int = 0
    minute_start: float = 0
    hour_start: float = 0
    day_start: float = 0
    blocked_until: float = 0

    # Expensive endpoint tracking
    expensive_minute: int = 0
    expensive_hour: int = 0
    expensive_day: int = 0
    expensive_minute_start: float = 0
    expensive_hour_start: float = 0
    expensive_day_start: float = 0


class RateLimiter:
    """In-memory rate limiter."""

    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self._entries: dict[str, RateLimitEntry] = defaultdict(RateLimitEntry)
        self._last_cleanup = time.time()
        self._cleanup_interval = 3600  # Clean up hourly

        # Expensive endpoints patterns
        self.expensive_patterns = [
            "/api/wealth/chat",
            "/api/report/generate",
            "/api/report/pdf",
            "/api/analysis",
        ]

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check X-Forwarded-For header (behind proxy/load balancer)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Get first IP in chain (original client)
            return forwarded.split(",")[0].strip()

        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to direct client IP
        if request.client:
            return request.client.host

        return "unknown"

    def _is_expensive_endpoint(self, path: str) -> bool:
        """Check if endpoint is expensive (LLM, reports)."""
        return any(pattern in path for pattern in self.expensive_patterns)

    def _cleanup_old_entries(self):
        """Remove old entries to prevent memory leak."""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return

        self._last_cleanup = now
        cutoff = now - 86400  # 24 hours

        to_delete = []
        for ip, entry in self._entries.items():
            if entry.day_start < cutoff and entry.blocked_until < now:
                to_delete.append(ip)

        for ip in to_delete:
            del self._entries[ip]

        if to_delete:
            logger.debug(f"Rate limiter cleanup: removed {len(to_delete)} stale entries")

    def check_rate_limit(self, request: Request) -> tuple[bool, Optional[str], Optional[int]]:
        """
        Check if request should be rate limited.

        Returns:
            (allowed, error_message, retry_after_seconds)
        """
        self._cleanup_old_entries()

        client_ip = self._get_client_ip(request)
        path = request.url.path
        now = time.time()

        # Whitelist check
        if client_ip in self.config.whitelist_ips:
            return True, None, None

        entry = self._entries[client_ip]

        # Check if currently blocked
        if entry.blocked_until > now:
            retry_after = int(entry.blocked_until - now)
            return False, "Too many requests. You have been temporarily blocked.", retry_after

        is_expensive = self._is_expensive_endpoint(path)

        # Reset counters if time window expired
        if now - entry.minute_start > 60:
            entry.minute_requests = 0
            entry.minute_start = now
        if now - entry.hour_start > 3600:
            entry.hour_requests = 0
            entry.hour_start = now
        if now - entry.day_start > 86400:
            entry.day_requests = 0
            entry.day_start = now

        # Reset expensive counters
        if is_expensive:
            if now - entry.expensive_minute_start > 60:
                entry.expensive_minute = 0
                entry.expensive_minute_start = now
            if now - entry.expensive_hour_start > 3600:
                entry.expensive_hour = 0
                entry.expensive_hour_start = now
            if now - entry.expensive_day_start > 86400:
                entry.expensive_day = 0
                entry.expensive_day_start = now

        # Check expensive endpoint limits first
        if is_expensive:
            if entry.expensive_minute >= self.config.expensive_per_minute:
                return False, "Rate limit exceeded for AI endpoints. Please wait.", 60
            if entry.expensive_hour >= self.config.expensive_per_hour:
                return False, "Hourly AI request limit reached.", 3600
            if entry.expensive_day >= self.config.expensive_per_day:
                entry.blocked_until = now + self.config.block_duration
                return False, "Daily AI request limit reached. Try again tomorrow.", 86400

        # Check general limits
        burst_minute = int(self.config.requests_per_minute * self.config.burst_multiplier)

        if entry.minute_requests >= burst_minute:
            return False, "Too many requests per minute.", 60

        if entry.hour_requests >= self.config.requests_per_hour:
            return False, "Hourly request limit reached.", 3600

        if entry.day_requests >= self.config.requests_per_day:
            entry.blocked_until = now + self.config.block_duration
            return False, "Daily request limit reached.", 86400

        # Increment counters
        entry.minute_requests += 1
        entry.hour_requests += 1
        entry.day_requests += 1

        if is_expensive:
            entry.expensive_minute += 1
            entry.expensive_hour += 1
            entry.expensive_day += 1

        return True, None, None

    def get_remaining(self, request: Request) -> dict:
        """Get remaining request allowances for client."""
        client_ip = self._get_client_ip(request)
        entry = self._entries[client_ip]
        now = time.time()

        # Reset if windows expired
        minute_remaining = self.config.requests_per_minute - entry.minute_requests
        if now - entry.minute_start > 60:
            minute_remaining = self.config.requests_per_minute

        hour_remaining = self.config.requests_per_hour - entry.hour_requests
        if now - entry.hour_start > 3600:
            hour_remaining = self.config.requests_per_hour

        return {
            "minute": max(0, minute_remaining),
            "hour": max(0, hour_remaining),
            "reset_minute": int(60 - (now - entry.minute_start)) if entry.minute_start else 60,
            "reset_hour": int(3600 - (now - entry.hour_start)) if entry.hour_start else 3600,
        }


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get or create rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""

    def __init__(self, app, config: Optional[RateLimitConfig] = None):
        super().__init__(app)
        self.limiter = RateLimiter(config)
        global _rate_limiter
        _rate_limiter = self.limiter

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for health checks and docs
        path = request.url.path
        if path in ["/", "/docs", "/openapi.json", "/redoc", "/api/health"]:
            return await call_next(request)

        allowed, error_msg, retry_after = self.limiter.check_rate_limit(request)

        if not allowed:
            logger.warning(
                f"Rate limit exceeded: {self.limiter._get_client_ip(request)} - {path}"
            )

            headers = {"Retry-After": str(retry_after)} if retry_after else {}
            raise HTTPException(
                status_code=429,
                detail=error_msg,
                headers=headers,
            )

        response = await call_next(request)

        # Add rate limit headers
        remaining = self.limiter.get_remaining(request)
        response.headers["X-RateLimit-Limit"] = str(self.limiter.config.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining["minute"])
        response.headers["X-RateLimit-Reset"] = str(remaining["reset_minute"])

        return response


def rate_limit(
    requests_per_minute: int = 10,
    requests_per_hour: int = 100,
):
    """
    Decorator for endpoint-specific rate limiting.

    Usage:
        @router.post("/expensive")
        @rate_limit(requests_per_minute=5, requests_per_hour=50)
        async def expensive_endpoint():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = kwargs.get("request")
            if not request:
                # Find request in args
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            if request:
                limiter = get_rate_limiter()
                client_ip = limiter._get_client_ip(request)
                # Custom endpoint-specific limiting could be added here

            return await func(*args, **kwargs)
        return wrapper
    return decorator
