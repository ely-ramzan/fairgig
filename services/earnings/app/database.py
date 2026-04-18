from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Standard dependency — used by Auth Service and any service that doesn't query shift_logs."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_with_rls(user_id: str, role: str) -> AsyncGenerator[AsyncSession, None]:
    """
    RLS-aware dependency for Earnings and Analytics services.

    Sets the two session-local GUC variables that the shift_logs RLS policy reads:
        SET LOCAL app.current_user_id = '<uuid>';
        SET LOCAL app.current_role    = '<role>';

    Usage in another service's route:
        async def get_db_rls(current_user=Depends(get_current_user)):
            async for session in get_db_with_rls(str(current_user.id), current_user.role):
                yield session

    NOTE: RLS does NOT apply to PostgreSQL superusers by default (no FORCE ROW LEVEL
    SECURITY).  Connecting via the postgres superuser account (the default DATABASE_URL)
    bypasses RLS entirely, which is the simplest approach for development.  Use this
    helper only when you want per-user row filtering enforced at the DB layer.
    """
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(
                text("SET LOCAL app.current_user_id = :uid"), {"uid": user_id}
            )
            await session.execute(
                text("SET LOCAL app.current_role = :role"), {"role": role}
            )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
