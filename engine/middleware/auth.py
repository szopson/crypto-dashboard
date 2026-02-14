"""
Supabase JWT Authentication Middleware.

Validates JWT tokens from Supabase Auth and extracts user information.
Supports both HS256 (symmetric) and ES256 (asymmetric) algorithms.
"""
import httpx
from typing import Optional
from dataclasses import dataclass

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError, jwk
from loguru import logger

from config import settings


# Security scheme for Swagger UI
security = HTTPBearer(auto_error=False)

# Cache for JWKS public keys
_jwks_cache: dict = {}


@dataclass
class AuthenticatedUser:
    """Authenticated user data extracted from JWT."""
    id: str
    email: Optional[str]
    role: str

    @property
    def user_id(self) -> str:
        """Alias for id for compatibility."""
        return self.id


async def _fetch_jwks() -> dict:
    """Fetch JWKS from Supabase for ES256 verification."""
    global _jwks_cache

    if _jwks_cache:
        return _jwks_cache

    if not settings.supabase_url:
        return {}

    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            _jwks_cache = response.json()
            logger.info(f"Fetched JWKS from Supabase: {len(_jwks_cache.get('keys', []))} keys")
            return _jwks_cache
    except Exception as e:
        logger.warning(f"Failed to fetch JWKS: {e}")
        return {}


def _get_signing_key(jwks: dict, kid: str) -> Optional[dict]:
    """Get the signing key from JWKS by key ID."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AuthenticatedUser:
    """
    Validate Supabase JWT and extract user info.

    Use as a dependency in protected routes:
        @router.get("/protected")
        async def protected_route(user: AuthenticatedUser = Depends(get_current_user)):
            return {"user_id": user.id}

    Raises:
        HTTPException 401: If token is missing, invalid, or expired
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Check if Supabase is configured
    if not settings.supabase_url and not settings.supabase_jwt_secret:
        logger.warning("Supabase not configured, using development mode")
        # Development mode: accept any token and extract claims without verification
        try:
            payload = jwt.get_unverified_claims(token)
            return AuthenticatedUser(
                id=payload.get("sub", "dev-user"),
                email=payload.get("email"),
                role=payload.get("role", "authenticated"),
            )
        except Exception:
            raise HTTPException(
                status_code=401,
                detail="Invalid token format",
                headers={"WWW-Authenticate": "Bearer"},
            )

    try:
        # Get token header to determine algorithm
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        kid = header.get("kid")

        if alg == "ES256":
            # ES256 (asymmetric) - fetch public key from JWKS
            jwks = await _fetch_jwks()

            if not jwks or not kid:
                logger.warning(f"JWKS not available or no kid in token (kid={kid})")
                raise HTTPException(
                    status_code=401,
                    detail="Unable to verify token signature",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            signing_key = _get_signing_key(jwks, kid)
            if not signing_key:
                logger.warning(f"Signing key not found for kid: {kid}")
                raise HTTPException(
                    status_code=401,
                    detail="Signing key not found",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Convert JWK to PEM for verification
            public_key = jwk.construct(signing_key)

            payload = jwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )
        else:
            # HS256 (symmetric) - use JWT secret
            if not settings.supabase_jwt_secret:
                raise HTTPException(
                    status_code=401,
                    detail="JWT secret not configured",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return AuthenticatedUser(
            id=user_id,
            email=payload.get("email"),
            role=payload.get("role", "authenticated"),
        )

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        # Log more details for debugging
        try:
            header = jwt.get_unverified_header(token)
            logger.warning(f"JWT validation failed: {e}, token alg: {header.get('alg')}")
        except Exception:
            logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[AuthenticatedUser]:
    """
    Get user if authenticated, None otherwise.

    Use for routes that work both with and without authentication:
        @router.get("/public-or-private")
        async def flexible_route(user: Optional[AuthenticatedUser] = Depends(get_optional_user)):
            if user:
                return {"personalized": True, "user_id": user.id}
            return {"personalized": False}
    """
    if not credentials:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_role(allowed_roles: list[str]):
    """
    Dependency factory to require specific roles.

    Usage:
        @router.get("/admin-only")
        async def admin_route(
            user: AuthenticatedUser = Depends(require_role(["admin", "service_role"]))
        ):
            return {"admin": True}
    """
    async def check_role(
        user: AuthenticatedUser = Depends(get_current_user)
    ) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required roles: {allowed_roles}",
            )
        return user

    return check_role
