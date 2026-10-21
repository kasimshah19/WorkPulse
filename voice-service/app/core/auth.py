import hmac
from fastapi import Header, HTTPException, status
from app.core.config import settings

def verify_internal_key(x_internal_key: str = Header(None, alias="X-Internal-Key")):
    """
    Enforces shared secret verification between Backend API and Voice Service.
    Uses constant-time comparison to prevent timing attacks.
    """
    if not x_internal_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing X-Internal-Key header"
        )

    if not hmac.compare_digest(x_internal_key, settings.INTERNAL_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid internal API key"
        )

    return True
