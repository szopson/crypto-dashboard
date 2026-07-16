"""
Supabase JWT Authentication Middleware.

Validates JWT tokens from Supabase Auth and extracts user information.
Supports both HS256 (symmetric) and ES256 (asymmetric) algorithms.
"""
import secrets
import time
from typing import Optional
from dataclasses import dataclass

import httpx
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError, jwk
from loguru import logger

from config import settings


# Security scheme for Swagger UI
security = HTTPBearer(auto_error=False)

# Cache for JWKS public keys (bounded TTL — key rotation must not require a
# restart; see _fetch_jwks refresh-on-unknown-kid).
_jwks_cache: dict = {}
_jwks_fetched_at: float = 0.0
JWKS_TTL_SECONDS = 3600

# Clock-skew tolerance for exp/nbf validation.
JWT_LEEWAY_SECONDS = 30


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


async def _fetch_jwks(force: bool = False) -> dict:
    """Fetch JWKS from Supabase for ES256 verification.

    Cached with a bounded TTL; `force=True` bypasses the cache (used once when
    a token carries an unknown kid, so Supabase key rotation doesn't lock every
    user out until a restart). Fails closed: on fetch error the stale cache is
    NOT extended — an empty result means 401 upstream.
    """
    global _jwks_cache, _jwks_fetched_at

    fresh = _jwks_cache and (time.monotonic() - _jwks_fetched_at) < JWKS_TTL_SECONDS
    if fresh and not force:
        return _jwks_cache

    if not settings.supabase_url:
        return {}

    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            _jwks_cache = response.json()
            _jwks_fetched_at = time.monotonic()
            logger.info(f"Fetched JWKS from Supabase: {len(_jwks_cache.get('keys', []))} keys")
            return _jwks_cache
    except Exception as e:
        logger.warning(f"Failed to fetch JWKS: {e}")
        # Serve the stale cache if we have one (better than a hard outage);
        # empty cache stays empty → caller 401s.
        return _jwks_cache or {}


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

        # Verify audience, issuer and expiry (with clock-skew leeway) for BOTH
        # algorithms. Previously verify_aud was disabled and the issuer never
        # checked — any Supabase-signed JWT (any project, anon tokens) passed.
        decode_kwargs = {
            "audience": "authenticated",
            "issuer": f"{settings.supabase_url}/auth/v1" if settings.supabase_url else None,
            "options": {"leeway": JWT_LEEWAY_SECONDS},
        }

        if alg == "ES256":
            # ES256 (asymmetric) - fetch public key from JWKS
            jwks = await _fetch_jwks()

            if not kid:
                raise HTTPException(
                    status_code=401,
                    detail="Unable to verify token signature",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            signing_key = _get_signing_key(jwks, kid)
            if not signing_key:
                # Key rotation: refresh JWKS once before rejecting.
                jwks = await _fetch_jwks(force=True)
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
                **decode_kwargs,
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
                **decode_kwargs,
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )

        role = payload.get("role", "")
        if role != "authenticated":
            # Rejects anon-key tokens (role "anon") and service tokens — user
            # endpoints are for signed-in users only.
            raise HTTPException(
                status_code=401,
                detail="Invalid token role",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return AuthenticatedUser(
            id=user_id,
            email=payload.get("email"),
            role=role,
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


async def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> None:
    """
    Service/admin authorization for operational control routes (Telegram
    sends, scheduler control, alert-monitor control). These are NOT user
    features — they were publicly callable before this guard.

    Checks the bearer token against the static ADMIN_API_TOKEN from
    engine/.env. Fails closed: with no token configured, every call is 401.
    """
    supplied = credentials.credentials if credentials else ""
    expected = settings.admin_api_token
    if not expected or not supplied or not secrets.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=401,
            detail="Admin authorization required",
            headers={"WWW-Authenticate": "Bearer"},
        )


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
