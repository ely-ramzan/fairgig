import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

# Load .env from project root (two levels up from services/auth/)
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

# Make the app package importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import (  # noqa: E402 — import after sys.path fix
    Base,
    CityZone,
    User,
    Platform,
    FileUpload,
    ShiftLog,
    Screenshot,
    Verification,
    Grievance,
    GrievanceTag,
    AnomalyResult,
)

config = context.config

# Override sqlalchemy.url from environment
database_url = os.environ["DATABASE_URL"]
# Alembic sync driver — replace asyncpg with psycopg2 for migrations
sync_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
config.set_main_option("sqlalchemy.url", sync_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


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
