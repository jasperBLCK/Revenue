from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_manager
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.manager import Manager, RefreshToken
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
)
from app.schemas.auth import (
    Manager as ManagerSchema,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


async def _issue_tokens(db: AsyncSession, manager: Manager) -> AuthResponse:
    access_token = create_access_token(str(manager.id), {"role": manager.role.value})
    refresh_token, jti, expires_at = create_refresh_token(str(manager.id))
    db.add(RefreshToken(jti=jti, manager_id=manager.id, expires_at=expires_at))
    await db.flush()
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        manager=ManagerSchema.model_validate(manager),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    existing = await db.execute(select(Manager).where(Manager.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    manager = Manager(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    db.add(manager)
    await db.flush()
    return await _issue_tokens(db, manager)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    result = await db.execute(select(Manager).where(Manager.email == payload.email))
    manager = result.scalar_one_or_none()
    if manager is None or not verify_password(payload.password, manager.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    return await _issue_tokens(db, manager)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    try:
        claims = decode_token(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from exc
    if claims.get("type") != REFRESH_TOKEN_TYPE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    jti = claims.get("jti")
    result = await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    stored = result.scalar_one_or_none()
    if stored is None or stored.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked"
        )
    expires_at = stored.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    # Rotate: revoke the old refresh token.
    stored.revoked = True
    manager = await db.get(Manager, stored.manager_id)
    if manager is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Manager not found")
    return await _issue_tokens(db, manager)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    manager: Manager = Depends(get_current_manager), db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.manager_id == manager.id, RefreshToken.revoked.is_(False)
        )
    )
    for token in result.scalars().all():
        token.revoked = True


@router.get("/me", response_model=ManagerSchema)
async def me(manager: Manager = Depends(get_current_manager)) -> ManagerSchema:
    return ManagerSchema.model_validate(manager)
