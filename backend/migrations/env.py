"""
Alembic environment configuration.
Lê DATABASE_URL do ambiente para que o mesmo arquivo funcione
tanto localmente quanto no container Docker.
"""
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Carrega variáveis de ambiente antes de qualquer coisa
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Configura logging do Alembic a partir do alembic.ini (só se o arquivo existir)
config = context.config
if config.config_file_name is not None:
    from pathlib import Path
    if Path(config.config_file_name).exists():
        fileConfig(config.config_file_name)

# Sobrescreve a URL com DATABASE_URL do ambiente
database_url = os.environ.get("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

# Importa os modelos para que o Alembic detecte mudanças automaticamente
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.extensions import db
import app.models  # noqa: F401 — garante que todos os modelos são importados
target_metadata = db.metadata


def run_migrations_offline() -> None:
    """Roda as migrations sem conexão ao banco (gera SQL puro)."""
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
    """Roda as migrations com conexão ao banco."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
