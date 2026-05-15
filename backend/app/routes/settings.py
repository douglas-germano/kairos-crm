"""
Rotas de configurações do workspace.

GET   /api/settings/workspace              — dados do workspace atual
PATCH /api/settings/workspace              — atualiza nome do workspace

POST  /api/settings/whatsapp/connect       — cria instância na Evolution API e retorna QR code
GET   /api/settings/whatsapp/status        — verifica estado de conexão da instância
POST  /api/settings/whatsapp/disconnect    — desconecta e remove instância
"""
import logging
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Workspace, WorkspaceMember, Integration
from app.services import evolution as evo_svc
from app.services.evolution import EvolutionError

logger = logging.getLogger(__name__)
bp = Blueprint("settings", __name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_workspace(user_id: int):
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    if not member:
        return None
    return db.session.get(Workspace, member.workspace_id)


def _instance_name(user_id: int) -> str:
    return f"kairos-crm-{user_id}"


def _webhook_url() -> str:
    base = current_app.config.get("APP_BASE_URL", "http://localhost:5001").rstrip("/")
    return f"{base}/webhooks/whatsapp"


# ─── Workspace ────────────────────────────────────────────────────────────────

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


# ─── WhatsApp — QR Code Flow ──────────────────────────────────────────────────

@bp.post("/whatsapp/connect")
@jwt_required()
def whatsapp_connect():
    """
    Cria ou reconecta a instância WhatsApp do usuário na Evolution API.

    1. Verifica se a instância já existe na Evolution API
    2. Se não existir, cria com webhook configurado
    3. Busca o QR code e retorna ao frontend
    4. Salva integração no banco com status 'pending'
    """
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    instance_name = _instance_name(user_id)
    webhook_url = _webhook_url()

    try:
        # Verifica se já existe
        existing = evo_svc.fetch_instance(instance_name)

        if existing:
            # Instância já existe — só busca QR atualizado
            qr_data = evo_svc.get_qr(instance_name)
        else:
            # Cria nova instância (já retorna QR quando qrcode=True)
            result = evo_svc.create_instance(instance_name, webhook_url)
            qrcode_payload = result.get("qrcode", {})
            qr_data = {
                "code": qrcode_payload.get("base64") or qrcode_payload.get("code", ""),
                "pairingCode": qrcode_payload.get("pairingCode", ""),
                "count": qrcode_payload.get("count", 0),
            }

    except EvolutionError as exc:
        logger.error("Falha ao criar instância WhatsApp", extra={"error": str(exc)})
        return jsonify({"error": str(exc), "code": "EVOLUTION_ERROR"}), exc.status

    # Salva/atualiza integração no banco
    integration = Integration.query.filter_by(
        workspace_id=ws.id, channel="whatsapp"
    ).first()

    if not integration:
        integration = Integration(workspace_id=ws.id, channel="whatsapp")
        db.session.add(integration)

    integration.status = "pending"
    integration.set_credentials({
        "instance_name": instance_name,
        "api_url": current_app.config.get("EVOLUTION_API_URL", ""),
        "api_key": current_app.config.get("EVOLUTION_API_KEY", ""),
    })
    integration.meta = {"instance_name": instance_name}
    db.session.commit()

    logger.info("WhatsApp QR gerado", extra={"workspace_id": ws.id, "instance": instance_name})
    return jsonify({
        "instance_name": instance_name,
        "qr": qr_data,
    })


@bp.get("/whatsapp/status")
@jwt_required()
def whatsapp_status():
    """
    Verifica o estado atual da conexão WhatsApp.

    Retorna:
      - integration: dados da integração no banco
      - state: 'open' | 'close' | 'connecting' (da Evolution API)
    """
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    integration = Integration.query.filter_by(
        workspace_id=ws.id, channel="whatsapp"
    ).first()

    if not integration:
        return jsonify({"state": "not_configured", "integration": None})

    instance_name = _instance_name(user_id)

    try:
        state_data = evo_svc.connection_state(instance_name)
        state = state_data.get("instance", {}).get("state", "close")

        # Sincroniza status no banco quando conectado
        if state == "open" and integration.status != "active":
            integration.status = "active"
            db.session.commit()
        elif state != "open" and integration.status == "active":
            integration.status = "inactive"
            db.session.commit()

    except EvolutionError:
        state = "close"

    return jsonify({
        "state": state,
        "integration": integration.to_dict(),
    })


@bp.post("/whatsapp/disconnect")
@jwt_required()
def whatsapp_disconnect():
    """Desconecta e remove a instância WhatsApp."""
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    instance_name = _instance_name(user_id)

    try:
        evo_svc.delete_instance(instance_name)
    except EvolutionError as exc:
        # Se não existir (404), ignora — só limpa banco
        if exc.status != 404:
            logger.warning("Erro ao deletar instância Evolution", extra={"error": str(exc)})

    integration = Integration.query.filter_by(
        workspace_id=ws.id, channel="whatsapp"
    ).first()

    if integration:
        integration.status = "inactive"
        integration.set_credentials({})
        integration.meta = {}
        db.session.commit()

    logger.info("WhatsApp desconectado", extra={"workspace_id": ws.id})
    return jsonify({"message": "Desconectado com sucesso"})


# ─── Legado — mantido para compatibilidade ────────────────────────────────────

@bp.get("/whatsapp")
@jwt_required()
def get_whatsapp_status():
    """Alias de compatibilidade para o status da integração no banco."""
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
