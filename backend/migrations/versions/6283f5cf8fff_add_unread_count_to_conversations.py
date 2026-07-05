"""add unread_count to conversations

Revision ID: 6283f5cf8fff
Revises: e2a1f7d3c849
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6283f5cf8fff"
down_revision: Union[str, None] = "e2a1f7d3c849"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("unread_count", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("conversations", "unread_count")
