from datetime import datetime, timezone
from app.extensions import db


class Workspace(db.Model):
    __tablename__ = "workspaces"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    plan = db.Column(db.String(50), default="free")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    owner = db.relationship("User", foreign_keys=[owner_id])
    members = db.relationship("WorkspaceMember", back_populates="workspace", lazy="dynamic")
    integrations = db.relationship("Integration", back_populates="workspace", lazy="dynamic")
    contacts = db.relationship("Contact", back_populates="workspace", lazy="dynamic")
    conversations = db.relationship("Conversation", back_populates="workspace", lazy="dynamic")
    agents = db.relationship("Agent", back_populates="workspace", lazy="dynamic")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "plan": self.plan, "created_at": self.created_at.isoformat()}


class WorkspaceMember(db.Model):
    __tablename__ = "workspace_members"

    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    role = db.Column(db.String(50), default="member")  # owner | admin | member

    workspace = db.relationship("Workspace", back_populates="members")
    user = db.relationship("User", back_populates="workspaces")
