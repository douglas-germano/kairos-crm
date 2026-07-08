from datetime import datetime, timezone
from app.extensions import db


class Contact(db.Model):
    __tablename__ = "contacts"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False)
    channel = db.Column(db.String(20), nullable=False)       # instagram | whatsapp
    external_id = db.Column(db.String(255), nullable=False)  # IGSID ou número WhatsApp
    name = db.Column(db.String(255))
    avatar_url = db.Column(db.String(500))
    # Conexão (Integration) de onde esse contato foi visto pela primeira vez — relevante
    # só quando o workspace tem mais de um número WhatsApp ativo; usado para rotear o
    # envio de mensagens pelo número certo. Nulo em contatos migrados de antes dessa coluna.
    integration_id = db.Column(db.Integer, db.ForeignKey("integrations.id"), nullable=True, index=True)
    metadata_ = db.Column("metadata", db.JSON, default=lambda: {})
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    workspace = db.relationship("Workspace", back_populates="contacts")
    conversations = db.relationship("Conversation", back_populates="contact", lazy="dynamic")
    integration = db.relationship("Integration")

    __table_args__ = (
        db.UniqueConstraint("workspace_id", "channel", "external_id", name="uq_contact_workspace_channel_external"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "channel": self.channel,
            "external_id": self.external_id,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "integration_id": self.integration_id,
            "created_at": self.created_at.isoformat(),
        }
