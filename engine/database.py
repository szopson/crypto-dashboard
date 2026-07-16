"""
Database configuration and session management.
Uses SQLAlchemy async with SQLite/PostgreSQL.
"""
import shutil
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import inspect, text
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
# statement_cache_size=0 required for Supabase pooler (pgbouncer) — but it is
# an asyncpg-only kwarg; sqlite3.connect rejects it (TypeError on connect).
_async_url = get_async_database_url(settings.database_url)
_connect_args = {"statement_cache_size": 0} if _async_url.startswith("postgresql") else {}
engine = create_async_engine(
    _async_url,
    echo=settings.debug,
    connect_args=_connect_args,
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


def _sqlite_path_from_url(url: str) -> Path | None:
    """File path for a sqlite URL, or None for non-sqlite/in-memory URLs."""
    if not url.startswith("sqlite"):
        return None
    # sqlite+aiosqlite:///relative.db or ////absolute/path.db
    path = urlparse(url).path.lstrip("/")
    if not path or path == ":memory:":
        return None
    # urlparse strips the leading slash of absolute paths; a 4-slash URL
    # (sqlite:////app/data/x.db) yields "app/data/x.db" — restore it when the
    # original URL clearly pointed at an absolute path.
    if url.split("://", 1)[1].startswith("//"):
        return Path("/" + path)
    return Path(path)


# The engine state db used to live at ./trading.db inside the container —
# OUTSIDE the tcc-backend-data volume — so every `compose up` recreate wiped
# the trade journal. The prod URL now points into /app/data (the mounted
# volume); on first boot after that switch, adopt a legacy file. Two possible
# sources: ./trading.db (dev / same-container case) and
# /app/data/trading.db.legacy (rescued out of the OLD container by the deploy
# workflow before recreate — the old writable layer is destroyed with it).
LEGACY_SQLITE_CANDIDATES = [
    Path("/app/data/trading.db.legacy"),
    Path("./trading.db"),
]


def _row_count(db_path: Path, table: str) -> int | None:
    try:
        with sqlite3.connect(db_path) as conn:
            return conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
    except sqlite3.Error:
        return None


def migrate_sqlite_location() -> None:
    """One-time adoption of the legacy ./trading.db into the volume path.

    Copy (never move) so the legacy file remains as a rollback artifact.
    Runs before any connection is made, so the target file cannot have been
    created empty by SQLAlchemy yet.
    """
    target = _sqlite_path_from_url(settings.database_url)
    if target is None:
        return
    # Always ensure the parent dir exists — sqlite cannot create it and fails
    # with an opaque "unable to open database file" otherwise.
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return
    legacy = next(
        (
            p.resolve()
            for p in LEGACY_SQLITE_CANDIDATES
            if p.exists() and p.resolve() != target.resolve()
        ),
        None,
    )
    if legacy is None:
        return
    shutil.copy2(legacy, target)
    legacy_trades = _row_count(legacy, "trades")
    copied_trades = _row_count(target, "trades")
    if legacy_trades != copied_trades:
        # Fail closed: a bad copy must not silently become the new truth.
        target.unlink(missing_ok=True)
        raise RuntimeError(
            f"trading.db migration failed: trades rows legacy={legacy_trades} "
            f"copied={copied_trades}; keeping legacy file, aborting startup"
        )
    logger.info(
        f"Adopted legacy trading.db into {target} "
        f"({copied_trades} trades; legacy file kept as rollback copy)"
    )


def _ensure_trade_user_id(sync_conn) -> None:
    """Dialect-agnostic idempotent guard: trades.user_id column + index.

    Base.metadata.create_all never ALTERs existing tables, and this project
    has no migration runner — so pre-existing databases need this explicit
    guard. Uses SQLAlchemy inspect(), which works for SQLite and Postgres.
    """
    inspector = inspect(sync_conn)
    if "trades" not in inspector.get_table_names():
        return  # create_all just created it from the model, column included
    columns = {col["name"] for col in inspector.get_columns("trades")}
    if "user_id" not in columns:
        sync_conn.execute(text("ALTER TABLE trades ADD COLUMN user_id VARCHAR(64)"))
        logger.info("Schema guard: added trades.user_id column")
    indexes = {ix["name"] for ix in inspector.get_indexes("trades")}
    if "ix_trades_user_id" not in indexes:
        sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_trades_user_id ON trades (user_id)"))
        logger.info("Schema guard: added ix_trades_user_id index")


async def init_db():
    """Initialize database - create all tables + run schema guards."""
    migrate_sqlite_location()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_trade_user_id)
    logger.info("Database initialized")


async def close_db():
    """Close database connections."""
    await engine.dispose()
    logger.info("Database connections closed")
