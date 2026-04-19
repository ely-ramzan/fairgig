from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings
import os

settings = get_settings()

if os.environ.get("VERCEL"):
    from sqlalchemy.pool import NullPool
    engine = create_async_engine(
        settings.async_database_url,
        connect_args={"ssl": "require"},
        poolclass=NullPool,       
    )
else:
    engine = create_async_engine(
        settings.async_database_url,
        connect_args={"ssl": "require"},
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
