"""add caption to messages

Revision ID: d4f6a8b9c012
Revises: c1d3e8f2b905
Create Date: 2026-05-19 00:50:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4f6a8b9c012"
down_revision: Union[str, None] = "c1d3e8f2b905"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("caption", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "caption")
