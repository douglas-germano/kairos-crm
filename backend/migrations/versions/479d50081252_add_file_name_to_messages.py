"""add file_name to messages

Revision ID: 479d50081252
Revises: 6283f5cf8fff
Create Date: 2026-07-05 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "479d50081252"
down_revision: Union[str, None] = "6283f5cf8fff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("file_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "file_name")
