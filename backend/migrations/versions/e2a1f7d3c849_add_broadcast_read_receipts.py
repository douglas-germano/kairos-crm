"""add broadcast read receipts

Revision ID: e2a1f7d3c849
Revises: c1d3e8f2b905
Create Date: 2026-05-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2a1f7d3c849"
down_revision: Union[str, None] = "c1d3e8f2b905"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Counters de entrega e leitura no broadcast
    op.add_column("broadcasts", sa.Column("delivered_count", sa.Integer(), server_default="0", nullable=True))
    op.add_column("broadcasts", sa.Column("read_count", sa.Integer(), server_default="0", nullable=True))

    # Rastreamento individual por recipient
    op.add_column("broadcast_recipients", sa.Column("message_external_id", sa.String(255), nullable=True))
    op.add_column("broadcast_recipients", sa.Column("delivered_at", sa.DateTime(), nullable=True))
    op.add_column("broadcast_recipients", sa.Column("read_at", sa.DateTime(), nullable=True))

    op.create_index(
        "ix_broadcast_recipients_message_external_id",
        "broadcast_recipients",
        ["message_external_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_broadcast_recipients_message_external_id", table_name="broadcast_recipients")
    op.drop_column("broadcast_recipients", "read_at")
    op.drop_column("broadcast_recipients", "delivered_at")
    op.drop_column("broadcast_recipients", "message_external_id")
    op.drop_column("broadcasts", "read_count")
    op.drop_column("broadcasts", "delivered_count")
