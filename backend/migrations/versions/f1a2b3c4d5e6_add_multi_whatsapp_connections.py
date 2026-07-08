"""add multi whatsapp connections (integrations.name, contacts.integration_id)

Revision ID: f1a2b3c4d5e6
Revises: d3e5216a278a
Create Date: 2026-07-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "d3e5216a278a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("integrations", sa.Column("name", sa.String(length=100), nullable=True))

    op.add_column("contacts", sa.Column("integration_id", sa.Integer(), nullable=True))
    op.create_index("ix_contacts_integration_id", "contacts", ["integration_id"])
    op.create_foreign_key(
        "fk_contacts_integration_id",
        "contacts",
        "integrations",
        ["integration_id"],
        ["id"],
    )

    # Backfill: hoje existe no máximo uma integração ativa por (workspace, canal),
    # então associar os contatos existentes à integração do mesmo workspace/canal
    # é seguro e determinístico.
    op.execute(
        """
        UPDATE contacts
        SET integration_id = integrations.id
        FROM integrations
        WHERE contacts.workspace_id = integrations.workspace_id
          AND contacts.channel = integrations.channel
          AND contacts.integration_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_contacts_integration_id", "contacts", type_="foreignkey")
    op.drop_index("ix_contacts_integration_id", table_name="contacts")
    op.drop_column("contacts", "integration_id")
    op.drop_column("integrations", "name")
