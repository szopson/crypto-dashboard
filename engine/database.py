"""
Database configuration and session management.
Uses SQLAlchemy async with SQLite/PostgreSQL.
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from loguru import logger

from config import settings


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""
    pass


def get_async_database_url(url: str) -> str:
    """Convert database URL to async-compatible format."""
    # PostgreSQL: convert to asyncpg driver
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


# Create async engine
# statement_cache_size=0 required for Supabase pooler (pgbouncer)
engine = create_async_engine(
    get_async_database_url(settings.database_url),
    echo=settings.debug,
    connect_args={"statement_cache_size": 0},
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:
    """Dependency for getting database session."""
    async with async_session_maker() as session:
        yield session


async def init_db():
    """Initialize database - create all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized")


async def close_db():
    """Close database connections."""
    await engine.dispose()
    logger.info("Database connections closed")
