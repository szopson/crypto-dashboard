"""
Middleware module for FastAPI.
"""
from .auth import get_current_user, get_optional_user, AuthenticatedUser

__all__ = ["get_current_user", "get_optional_user", "AuthenticatedUser"]
