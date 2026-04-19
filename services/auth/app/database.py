from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings
import os

settings = get_settings()

_engine = None
_AsyncSessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        if os.environ.get("VERCEL"):
            from sqlalchemy.pool import NullPool
            _engine = create_async_engine(          # ← _engine not engine
                settings.async_database_url,
                connect_args={"ssl": "require"},
                poolclass=NullPool,
            )
        else:
            _engine = create_async_engine(          # ← _engine not engine
                settings.async_database_url,
                connect_args={"ssl": "require"},
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
            )
    return _engine


def get_session_maker():
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _AsyncSessionLocal


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with get_session_maker()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_with_rls(user_id: str, role: str) -> AsyncGenerator[AsyncSession, None]:
    async with get_session_maker()() as session:    # ← get_session_maker()() not AsyncSessionLocal
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