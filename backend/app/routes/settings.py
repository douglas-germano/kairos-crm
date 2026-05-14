"""
Rotas de configurações do workspace.

GET   /api/settings/workspace            — dados do workspace atual
PATCH /api/settings/workspace            — atualiza nome do workspace
POST  /api/settings/whatsapp             — configura integração WhatsApp (Evolution API)
GET   /api/settings/whatsapp             — status da integração WhatsApp
"""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Workspace, WorkspaceMember, Integration

logger = logging.getLogger(__name__)
bp = Blueprint("settings", __name__)


def _get_workspace(user_id: int):
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    if not member:
        return None
    return db.session.get(Workspace, member.workspace_id)


@bp.get("/workspace")
@jwt_required()
def get_workspace():
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404
    return jsonify(ws.to_dict())


@bp.patch("/workspace")
@jwt_required()
def update_workspace():
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    if "name" in data:
        ws.name = data["name"]
    db.session.commit()
    return jsonify(ws.to_dict())


@bp.post("/whatsapp")
@jwt_required()
def configure_whatsapp():
    """
    Salva as credenciais da Evolution API para o workspace.
    Body: { api_url, api_key, instance_name }
    """
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    required = ("api_url", "api_key", "instance_name")
    if not all(k in data for k in required):
        return jsonify({
            "error": f"Campos obrigatórios: {', '.join(required)}",
            "code": "MISSING_FIELDS",
        }), 400

    integration = Integration.query.filter_by(
        workspace_id=ws.id, channel="whatsapp"
    ).first()

    if not integration:
        integration = Integration(workspace_id=ws.id, channel="whatsapp")
        db.session.add(integration)

    integration.status = "active"
    integration.set_credentials({
        "api_url": data["api_url"],
        "api_key": data["api_key"],
        "instance_name": data["instance_name"],
    })
    integration.meta = {"instance_name": data["instance_name"]}
    db.session.commit()

    logger.info("WhatsApp configurado", extra={"workspace_id": ws.id, "instance": data["instance_name"]})
    return jsonify(integration.to_dict()), 201


@bp.get("/whatsapp")
@jwt_required()
def get_whatsapp_status():
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    integration = Integration.query.filter_by(
        workspace_id=ws.id, channel="whatsapp"
    ).first()

    if not integration:
        return jsonify({"status": "not_configured"})

    return jsonify(integration.to_dict())
