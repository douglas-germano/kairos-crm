"""merge caption branch with unread_count and file_name chain

Revision ID: d3e5216a278a
Revises: 479d50081252, d4f6a8b9c012
Create Date: 2026-07-05 12:28:19.223568

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e5216a278a'
down_revision: Union[str, None] = ('479d50081252', 'd4f6a8b9c012')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
