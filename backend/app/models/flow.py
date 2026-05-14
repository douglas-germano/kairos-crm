from datetime import datetime, timezone
from app.extensions import db


class Flow(db.Model):
    __tablename__ = "flows"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("agents.id"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    trigger_type = db.Column(db.String(50))          # first_message | keyword | schedule
    trigger_config = db.Column(db.JSON, default=dict)
    nodes = db.Column(db.JSON, default=list)          # React Flow nodes
    edges = db.Column(db.JSON, default=list)          # React Flow edges
    active = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    agent = db.relationship("Agent", back_populates="flows")

    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "name": self.name,
            "trigger_type": self.trigger_type,
            "trigger_config": self.trigger_config,
            "nodes": self.nodes or [],
            "edges": self.edges or [],
            "active": self.active,
            "created_at": self.created_at.isoformat(),
        }
