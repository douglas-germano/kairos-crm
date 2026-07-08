"""
Rotas de configurações do workspace.

GET   /api/settings/workspace                       — dados do workspace atual
PATCH /api/settings/workspace                       — atualiza nome do workspace

GET   /api/settings/whatsapp/connections            — lista todas as conexões WhatsApp do workspace
POST  /api/settings/whatsapp/connect                — cria uma nova conexão (ou reconecta uma existente) e retorna QR code
GET   /api/settings/whatsapp/status                 — verifica estado de conexão de uma instância
POST  /api/settings/whatsapp/disconnect             — desconecta e remove uma instância
PATCH /api/settings/whatsapp/<int:integration_id>    — renomeia uma conexão

Um workspace pode ter mais de um número WhatsApp ativo ao mesmo tempo — cada
conexão é uma linha própria em `integrations` (channel="whatsapp"), identificada
por uma instance_name própria na Evolution API (kairos-crm-{workspace_id}-{integration_id}).
"""
import logging
from datetime import datetime, timezone
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
    member = WorkspaceMember.query.filter_by(user_id=user_id).first()
    if not member:
        return None
    return db.session.get(Workspace, member.workspace_id)


def _instance_name(workspace_id: int, integration_id: int) -> str:
    return f"kairos-crm-{workspace_id}-{integration_id}"


def _webhook_url() -> str:
    base = current_app.config.get("APP_BASE_URL", "http://localhost:5001").rstrip("/")
    url = f"{base}/webhooks/whatsapp"
    secret = current_app.config.get("WEBHOOK_SECRET", "")
    if secret:
        url += f"?token={secret}"
    return url


def _refresh_instance_config(instance_name: str, webhook_url: str):
    evo_svc.set_webhook(instance_name, webhook_url)
    try:
        evo_svc.set_settings(instance_name, groups_ignore=False, sync_full_history=True)
    except EvolutionError as exc:
        logger.warning("Falha ao ajustar settings WhatsApp", extra={"error": str(exc)})


def _get_whatsapp_integration(workspace_id: int, integration_id: int | None) -> Integration | None:
    """
    Busca uma conexão WhatsApp específica do workspace. Sem integration_id,
    cai para a primeira encontrada — mantém o comportamento antigo funcionando
    para workspaces com uma única conexão.
    """
    query = Integration.query.filter_by(workspace_id=workspace_id, channel="whatsapp")
    if integration_id:
        return query.filter_by(id=integration_id).first()
    return query.order_by(Integration.id.asc()).first()


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
        name = str(data["name"]).strip()
        if not name:
            return jsonify({"error": "name não pode ser vazio", "code": "MISSING_FIELD"}), 400
        ws.name = name
    db.session.commit()
    return jsonify(ws.to_dict())


# ─── WhatsApp — múltiplas conexões via QR Code ────────────────────────────────

@bp.get("/whatsapp/connections")
@jwt_required()
def list_whatsapp_connections():
    """Lista todas as conexões WhatsApp (números) do workspace."""
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    integrations = (
        Integration.query.filter_by(workspace_id=ws.id, channel="whatsapp")
        .order_by(Integration.id.asc())
        .all()
    )
    return jsonify([i.to_dict() for i in integrations])


@bp.post("/whatsapp/connect")
@jwt_required()
def whatsapp_connect():
    """
    Cria uma nova conexão WhatsApp ou reconecta uma existente na Evolution API.

    Body opcional: { "integration_id": int, "name": string }
      - Com integration_id: reconecta/atualiza o QR code dessa conexão.
      - Sem integration_id: cria uma conexão nova (permite múltiplos números
        ativos no mesmo workspace); "name" é o rótulo amigável exibido na UI.

    1. Garante a linha da integração no banco (para ter um id estável)
    2. Verifica se a instância já existe na Evolution API
    3. Se não existir, cria com webhook configurado
    4. Busca o QR code e retorna ao frontend
    """
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json(silent=True) or {}
    integration_id = data.get("integration_id")
    label = (data.get("name") or "").strip() or None

    if integration_id:
        integration = Integration.query.filter_by(
            id=integration_id, workspace_id=ws.id, channel="whatsapp"
        ).first()
        if not integration:
            return jsonify({"error": "Conexão não encontrada", "code": "NOT_FOUND"}), 404
    else:
        integration = Integration(workspace_id=ws.id, channel="whatsapp", status="pending", name=label)
        db.session.add(integration)
        db.session.flush()  # garante integration.id antes de nomear a instância Evolution

    if label:
        integration.name = label

    instance_name = _instance_name(ws.id, integration.id)
    webhook_url = _webhook_url()

    try:
        existing = evo_svc.fetch_instance(instance_name)

        if existing:
            # Instância já existe — garante que o webhook aponta para o backend atual.
            _refresh_instance_config(instance_name, webhook_url)
            qr_data = evo_svc.get_qr(instance_name)
        else:
            # Cria nova instância (já retorna QR quando qrcode=True)
            result = evo_svc.create_instance(instance_name, webhook_url)
            _refresh_instance_config(instance_name, webhook_url)
            qrcode_payload = result.get("qrcode", {})
            qr_data = {
                "code": qrcode_payload.get("base64") or qrcode_payload.get("code", ""),
                "pairingCode": qrcode_payload.get("pairingCode", ""),
                "count": qrcode_payload.get("count", 0),
            }

    except EvolutionError as exc:
        db.session.rollback()
        logger.error("Falha ao criar instância WhatsApp", extra={"error": str(exc)})
        return jsonify({"error": str(exc), "code": "EVOLUTION_ERROR"}), exc.status

    integration.status = "pending"
    integration.set_credentials({
        "instance_name": instance_name,
        "api_url": current_app.config.get("EVOLUTION_API_URL", ""),
        "api_key": current_app.config.get("EVOLUTION_API_KEY", ""),
    })
    meta = dict(integration.meta or {})
    meta["instance_name"] = instance_name
    meta["webhook_url"] = webhook_url
    integration.meta = meta
    _update_health(
        integration,
        last_connect_at=datetime.now(timezone.utc).isoformat(),
        webhook_url=webhook_url,
        last_webhook_refresh_at=datetime.now(timezone.utc).isoformat(),
        last_error=None,
    )
    db.session.commit()

    logger.info("WhatsApp QR gerado", extra={"workspace_id": ws.id, "integration_id": integration.id, "instance": instance_name})
    return jsonify({
        "integration_id": integration.id,
        "instance_name": instance_name,
        "qr": qr_data,
    })


@bp.get("/whatsapp/status")
@jwt_required()
def whatsapp_status():
    """
    Verifica o estado atual de uma conexão WhatsApp (?integration_id=; sem esse
    parâmetro, cai para a primeira conexão do workspace).

    Retorna:
      - integration: dados da integração no banco
      - state: 'open' | 'close' | 'connecting' (da Evolution API)
    """
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    integration = _get_whatsapp_integration(ws.id, request.args.get("integration_id", type=int))
    if not integration:
        return jsonify({"state": "not_configured", "integration": None})

    instance_name = (integration.meta or {}).get("instance_name") or _instance_name(ws.id, integration.id)

    try:
        _refresh_instance_config(instance_name, _webhook_url())
        state_data = evo_svc.connection_state(instance_name)
        state = state_data.get("instance", {}).get("state", "close")

        # Sincroniza status no banco quando conectado
        if state == "open" and integration.status != "active":
            integration.status = "active"
        elif state != "open" and integration.status == "active":
            integration.status = "inactive"
        meta = dict(integration.meta or {})
        meta["webhook_url"] = _webhook_url()
        integration.meta = meta
        _update_health(
            integration,
            connection_state=state,
            last_status_check_at=datetime.now(timezone.utc).isoformat(),
            last_webhook_refresh_at=datetime.now(timezone.utc).isoformat(),
            last_error=None,
        )
        db.session.commit()

    except EvolutionError as exc:
        state = "close"
        _update_health(
            integration,
            connection_state=state,
            last_status_check_at=datetime.now(timezone.utc).isoformat(),
            last_error=str(exc),
        )
        db.session.commit()

    return jsonify({
        "state": state,
        "integration": integration.to_dict(),
        "health": (integration.meta or {}).get("health", {}),
    })


@bp.post("/whatsapp/disconnect")
@jwt_required()
def whatsapp_disconnect():
    """Desconecta e remove uma instância WhatsApp. Body opcional: { integration_id }."""
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json(silent=True) or {}
    integration = _get_whatsapp_integration(ws.id, data.get("integration_id"))
    if not integration:
        return jsonify({"error": "Conexão não encontrada", "code": "NOT_FOUND"}), 404

    instance_name = (integration.meta or {}).get("instance_name") or _instance_name(ws.id, integration.id)

    try:
        evo_svc.delete_instance(instance_name)
    except EvolutionError as exc:
        # Se não existir (404), ignora — só limpa banco
        if exc.status != 404:
            logger.warning("Erro ao deletar instância Evolution", extra={"error": str(exc)})

    integration.status = "inactive"
    integration.set_credentials({})
    integration.meta = {}
    db.session.commit()

    logger.info("WhatsApp desconectado", extra={"workspace_id": ws.id, "integration_id": integration.id})
    return jsonify({"message": "Desconectado com sucesso"})


@bp.patch("/whatsapp/<int:integration_id>")
@jwt_required()
def rename_whatsapp_connection(integration_id: int):
    """Renomeia uma conexão WhatsApp (rótulo amigável, ex.: 'Vendas', 'Suporte')."""
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    integration = Integration.query.filter_by(
        id=integration_id, workspace_id=ws.id, channel="whatsapp"
    ).first()
    if not integration:
        return jsonify({"error": "Conexão não encontrada", "code": "NOT_FOUND"}), 404

    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "name é obrigatório", "code": "MISSING_FIELD"}), 400

    integration.name = name
    db.session.commit()
    return jsonify(integration.to_dict())


# ─── Legado — mantido para compatibilidade ────────────────────────────────────

@bp.get("/whatsapp")
@jwt_required()
def get_whatsapp_status():
    """Alias de compatibilidade — status da primeira conexão WhatsApp do workspace."""
    user_id = int(get_jwt_identity())
    ws = _get_workspace(user_id)
    if not ws:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    integration = _get_whatsapp_integration(ws.id, None)
    if not integration:
        return jsonify({"status": "not_configured"})

    return jsonify(integration.to_dict())


def _update_health(integration: Integration, **fields):
    meta = dict(integration.meta or {})
    health = dict(meta.get("health") or {})
    health.update(fields)
    meta["health"] = health
    integration.meta = meta
