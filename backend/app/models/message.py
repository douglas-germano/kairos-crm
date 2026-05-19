from datetime import datetime, timezone
from app.extensions import db


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False)
    direction = db.Column(db.String(10), nullable=False)    # inbound | outbound
    content = db.Column(db.Text, nullable=False)
    content_type = db.Column(db.String(20), default="text") # text | image | audio | video | template
    caption = db.Column(db.Text)
    status = db.Column(db.String(20), default="sent")        # sent | delivered | read | failed
    external_id = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    conversation = db.relationship("Conversation", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "direction": self.direction,
            "content": self.content,
            "content_type": self.content_type,
            "caption": self.caption,
            "status": self.status,
            "external_id": self.external_id,
            "created_at": self.created_at.isoformat(),
        }
