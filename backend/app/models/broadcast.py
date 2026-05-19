from datetime import datetime, timezone
from app.extensions import db


class Broadcast(db.Model):
    __tablename__ = "broadcasts"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="draft")  # draft | sending | completed | failed
    total_count = db.Column(db.Integer, default=0)
    sent_count = db.Column(db.Integer, default=0)
    delivered_count = db.Column(db.Integer, default=0)
    read_count = db.Column(db.Integer, default=0)
    failed_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)

    workspace = db.relationship("Workspace", back_populates="broadcasts")
    recipients = db.relationship("BroadcastRecipient", back_populates="broadcast", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "message": self.message,
            "status": self.status,
            "total_count": self.total_count,
            "sent_count": self.sent_count,
            "delivered_count": self.delivered_count,
            "read_count": self.read_count,
            "failed_count": self.failed_count,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class BroadcastRecipient(db.Model):
    __tablename__ = "broadcast_recipients"

    id = db.Column(db.Integer, primary_key=True)
    broadcast_id = db.Column(db.Integer, db.ForeignKey("broadcasts.id"), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey("contacts.id"), nullable=False)
    # pending | sent | delivered | read | failed
    status = db.Column(db.String(20), nullable=False, default="pending")
    message_external_id = db.Column(db.String(255), index=True)  # ID retornado pela Evolution API ao enviar
    sent_at = db.Column(db.DateTime)
    delivered_at = db.Column(db.DateTime)
    read_at = db.Column(db.DateTime)
    error_message = db.Column(db.String(500))

    broadcast = db.relationship("Broadcast", back_populates="recipients")
    contact = db.relationship("Contact")

    def to_dict(self):
        return {
            "id": self.id,
            "broadcast_id": self.broadcast_id,
            "contact_id": self.contact_id,
            "status": self.status,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "error_message": self.error_message,
            "contact": self.contact.to_dict() if self.contact else None,
        }
