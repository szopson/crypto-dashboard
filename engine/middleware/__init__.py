"""
Middleware module for FastAPI.
"""
from .auth import get_current_user, get_optional_user, AuthenticatedUser
from .rate_limit import (
    RateLimitMiddleware,
    RateLimitConfig,
    get_rate_limiter,
    rate_limit,
)

__all__ = [
    "get_current_user",
    "get_optional_user",
    "AuthenticatedUser",
    "RateLimitMiddleware",
    "RateLimitConfig",
    "get_rate_limiter",
    "rate_limit",
]
