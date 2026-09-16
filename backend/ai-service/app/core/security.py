from fastapi import Header, HTTPException, status

from app.core.config import get_settings

settings = get_settings()


def require_internal_key(x_internal_key: str = Header(default="")):
    """
    This service is never called by the frontend directly — only by node-api,
    on behalf of an already-authenticated user. This header is that trust boundary.
    """
    if not settings.internal_api_key:
        return  # not configured (e.g. local dev) — allow through
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal key")
