from datetime import datetime, timezone
from app.extensions import db


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey("contacts.id"), nullable=False)
    channel = db.Column(db.String(20), nullable=False)             # instagram | whatsapp
    status = db.Column(db.String(20), default="open")              # open | closed | bot
    last_message_at = db.Column(db.DateTime)
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id"))
    ai_enabled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    workspace = db.relationship("Workspace", back_populates="conversations")
    contact = db.relationship("Contact", back_populates="conversations")
    assigned_user = db.relationship("User", foreign_keys=[assigned_to])
    messages = db.relationship("Message", back_populates="conversation", lazy="dynamic", order_by="Message.created_at")

    def to_dict(self, include_contact=False):
        data = {
            "id": self.id,
            "channel": self.channel,
            "status": self.status,
            "ai_enabled": self.ai_enabled,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "assigned_to": self.assigned_to,
            "created_at": self.created_at.isoformat(),
        }
        if include_contact:
            data["contact"] = self.contact.to_dict()
        return data
