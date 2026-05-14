from datetime import datetime, timezone
from app.extensions import db

CLAUDE_MODEL = "claude-sonnet-4-20250514"


class Agent(db.Model):
    __tablename__ = "agents"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    system_prompt = db.Column(db.Text, default="")
    model = db.Column(db.String(100), default=CLAUDE_MODEL)
    temperature = db.Column(db.Float, default=0.7)
    enabled = db.Column(db.Boolean, default=False)
    channels = db.Column(db.JSON, default=list)   # ["instagram", "whatsapp"]
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    workspace = db.relationship("Workspace", back_populates="agents")
    flows = db.relationship("Flow", back_populates="agent", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "system_prompt": self.system_prompt,
            "model": self.model,
            "temperature": self.temperature,
            "enabled": self.enabled,
            "channels": self.channels or [],
            "created_at": self.created_at.isoformat(),
        }
