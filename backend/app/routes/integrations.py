"""
Fluxo OAuth do Instagram (Meta):
  1. GET  /api/integrations/instagram/auth      → redireciona para o dialog OAuth do Meta
  2. GET  /api/integrations/instagram/callback  → troca code por token, salva no banco
  3. GET  /api/integrations              → lista integrações do workspace
  4. DELETE /api/integrations/<id>       → desconecta integração
"""
import logging
import urllib.parse
import requests
from flask import Blueprint, request, jsonify, redirect, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Integration, WorkspaceMember

logger = logging.getLogger(__name__)
bp = Blueprint("integrations", __name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"

# Permissões necessárias para DM via Instagram
IG_SCOPES = ",".join([
    "instagram_basic",
    "instagram_manage_messages",
    "pages_show_list",
    "pages_messaging",
])


def _get_workspace_id(user_id: int) -> int | None:
    """Retorna o primeiro workspace do usuário (owner)."""
    member = (
        WorkspaceMember.query
        .filter_by(user_id=user_id)
        .first()
    )
    return member.workspace_id if member else None


# ─── OAuth ────────────────────────────────────────────────────────────────────

@bp.get("/instagram/auth")
@jwt_required()
def instagram_auth():
    """Inicia o fluxo OAuth — redireciona o usuário para o Meta."""
    app_id = current_app.config["META_APP_ID"]
    base_url = current_app.config["APP_BASE_URL"]
    redirect_uri = f"{base_url}/api/integrations/instagram/callback"

    params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "scope": IG_SCOPES,
        "response_type": "code",
        "state": get_jwt_identity(),  # user_id como state para identificar na callback
    }
    oauth_url = "https://www.facebook.com/v19.0/dialog/oauth?" + urllib.parse.urlencode(params)
    return redirect(oauth_url)


@bp.get("/instagram/callback")
def instagram_callback():
    """
    Meta redireciona aqui após o usuário autorizar.
    Troca o code por um token de longa duração e salva no banco.
    """
    code = request.args.get("code")
    state = request.args.get("state")  # user_id
    error = request.args.get("error")

    if error:
        logger.warning("OAuth negado pelo usuário", extra={"error": error})
        return redirect(f"{current_app.config['APP_BASE_URL']}/settings?error=oauth_denied")

    if not code or not state:
        return jsonify({"error": "Parâmetros inválidos", "code": "INVALID_CALLBACK"}), 400

    app_id = current_app.config["META_APP_ID"]
    app_secret = current_app.config["META_APP_SECRET"]
    base_url = current_app.config["APP_BASE_URL"]
    redirect_uri = f"{base_url}/api/integrations/instagram/callback"

    # 1. Troca code por short-lived token
    token_resp = requests.get(f"{GRAPH_BASE}/oauth/access_token", params={
        "client_id": app_id,
        "client_secret": app_secret,
        "redirect_uri": redirect_uri,
        "code": code,
    })
    if not token_resp.ok:
        logger.error("Falha ao trocar code por token", extra={"response": token_resp.text})
        return redirect(f"{base_url}/settings?error=token_exchange_failed")

    short_token = token_resp.json().get("access_token")

    # 2. Troca por long-lived token (60 dias)
    ll_resp = requests.get(f"{GRAPH_BASE}/oauth/access_token", params={
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token,
    })
    if not ll_resp.ok:
        logger.error("Falha ao obter long-lived token", extra={"response": ll_resp.text})
        return redirect(f"{base_url}/settings?error=long_lived_token_failed")

    ll_data = ll_resp.json()
    long_token = ll_data.get("access_token")
    expires_in = ll_data.get("expires_in")
    if not long_token:
        logger.error("Token de longa duração ausente na resposta da Meta", extra={"response": ll_data})
        return redirect(f"{base_url}/settings?error=long_lived_token_failed")

    # 3. Busca páginas do usuário para encontrar IG Business Account
    pages_resp = requests.get(f"{GRAPH_BASE}/me/accounts", params={
        "access_token": long_token,
        "fields": "id,name,instagram_business_account",
    })
    pages = pages_resp.json().get("data", []) if pages_resp.ok else []

    ig_user_id = None
    page_id = None
    page_name = None
    for page in pages:
        if page.get("instagram_business_account"):
            ig_user_id = page["instagram_business_account"]["id"]
            page_id = page["id"]
            page_name = page.get("name")
            break

    if not ig_user_id:
        logger.warning("Nenhuma conta Instagram Business encontrada nas páginas do usuário")
        return redirect(f"{base_url}/settings?error=no_ig_business_account")

    # 4. Salva/atualiza integração no banco
    user_id = int(state)
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return redirect(f"{base_url}/settings?error=no_workspace")

    integration = Integration.query.filter_by(
        workspace_id=workspace_id, channel="instagram"
    ).first()

    if not integration:
        integration = Integration(workspace_id=workspace_id, channel="instagram")
        db.session.add(integration)

    integration.status = "active"
    integration.set_credentials({
        "access_token": long_token,
        "ig_user_id": ig_user_id,
        "page_id": page_id,
    })
    integration.meta = {
        "ig_user_id": ig_user_id,
        "page_id": page_id,
        "page_name": page_name,
        "expires_in": expires_in,
    }
    db.session.commit()

    logger.info("Instagram conectado com sucesso", extra={
        "workspace_id": workspace_id, "ig_user_id": ig_user_id
    })
    return redirect(f"{base_url}/settings?success=instagram_connected")


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@bp.get("")
@jwt_required()
def list_integrations():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    integrations = Integration.query.filter_by(workspace_id=workspace_id).all()
    return jsonify([i.to_dict() for i in integrations])


@bp.delete("/<int:integration_id>")
@jwt_required()
def disconnect(integration_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)

    integration = Integration.query.filter_by(
        id=integration_id, workspace_id=workspace_id
    ).first_or_404()

    integration.status = "inactive"
    integration.set_credentials({})
    db.session.commit()

    return jsonify({"message": "Integração desconectada"})
