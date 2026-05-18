import json
from datetime import datetime, timezone
from cryptography.fernet import Fernet
from flask import current_app
from app.extensions import db


class Integration(db.Model):
    __tablename__ = "integrations"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False)
    channel = db.Column(db.String(20), nullable=False)   # instagram | whatsapp
    status = db.Column(db.String(20), default="inactive")  # active | inactive
    _credentials = db.Column("credentials", db.Text)       # JSON criptografado
    meta = db.Column(db.JSON, default=lambda: {})
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    workspace = db.relationship("Workspace", back_populates="integrations")

    def _fernet(self) -> Fernet:
        key = current_app.config["SECRET_KEY"].encode()
        # Fernet requer chave base64 de 32 bytes — derivamos do SECRET_KEY
        import base64, hashlib
        derived = base64.urlsafe_b64encode(hashlib.sha256(key).digest())
        return Fernet(derived)

    def set_credentials(self, data: dict):
        f = self._fernet()
        self._credentials = f.encrypt(json.dumps(data).encode()).decode()

    def get_credentials(self) -> dict:
        if not self._credentials:
            return {}
        f = self._fernet()
        return json.loads(f.decrypt(self._credentials.encode()).decode())

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "channel": self.channel,
            "status": self.status,
            "meta": self.meta,
            "created_at": self.created_at.isoformat(),
        }
