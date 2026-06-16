import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Tests run against a Postgres instance (defaults match docker-compose).
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://revenuepilot:revenuepilot@localhost:5432/revenuepilot",
)
os.environ.setdefault("DEBUG", "false")

from app.core.config import settings  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest_asyncio.fixture(scope="function")
async def client():
    # Per-test engine with NullPool avoids cross-event-loop connection reuse.
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_local = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    async def _override_get_db():
        async with session_local() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as ac:
        yield ac
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture
def unique_email():
    return f"test-{uuid.uuid4().hex[:8]}@example.com"
