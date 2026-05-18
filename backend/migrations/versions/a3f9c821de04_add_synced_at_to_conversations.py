"""add synced_at to conversations

Revision ID: a3f9c821de04
Revises: 75c7a914680b
Create Date: 2026-05-18 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f9c821de04'
down_revision: Union[str, None] = '75c7a914680b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('conversations', sa.Column('synced_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('conversations', 'synced_at')
