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
    metadata_ = db.Column("metadata", db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    workspace = db.relationship("Workspace", back_populates="contacts")
    conversations = db.relationship("Conversation", back_populates="contact", lazy="dynamic")

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
            "created_at": self.created_at.isoformat(),
        }
