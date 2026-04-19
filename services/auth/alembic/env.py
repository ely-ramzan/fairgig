import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool, create_engine, MetaData

# Load .env from project root (two levels up from services/auth/)
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

# Make the app package importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# For migrations, we only need the metadata, not the async engine
# Avoid importing app.database which creates the async engine
try:
    from app.models import Base
    target_metadata = Base.metadata
except (ImportError, RuntimeError):
    # Fallback: create a minimal metadata object
    # This happens if app.database can't load (e.g., no psycopg2 for migrations)
    target_metadata = MetaData()

config = context.config

# Override sqlalchemy.url from environment
database_url = os.environ.get("DATABASE_URL", "")
if database_url:
    # Use asyncpg URL as-is; SQLAlchemy will automatically use the sync driver
    # when we call create_engine() below (not create_async_engine)
    sync_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    config.set_main_option("sqlalchemy.url", sync_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)



def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
