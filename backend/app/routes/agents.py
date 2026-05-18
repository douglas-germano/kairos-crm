"""
Rotas REST para Agentes.

GET    /api/agents          — lista agentes do workspace
POST   /api/agents          — cria novo agente
GET    /api/agents/<id>     — detalhe do agente
PATCH  /api/agents/<id>     — atualiza campos (enabled, channels, system_prompt, etc.)
DELETE /api/agents/<id>     — remove agente
"""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Agent, WorkspaceMember
from app.models.agent import CLAUDE_MODEL

logger = logging.getLogger(__name__)
bp = Blueprint("agents", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    return member.workspace_id if member else None


@bp.get("")
@jwt_required()
def list_agents():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    agents = Agent.query.filter_by(workspace_id=workspace_id).order_by(Agent.created_at).all()
    return jsonify([a.to_dict() for a in agents])


@bp.post("")
@jwt_required()
def create_agent():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Campo name é obrigatório", "code": "MISSING_NAME"}), 400

    agent = Agent(
        workspace_id=workspace_id,
        name=name,
        system_prompt=data.get("system_prompt", ""),
        model=data.get("model", CLAUDE_MODEL),
        temperature=float(data.get("temperature", 0.7)),
        enabled=bool(data.get("enabled", False)),
        channels=data.get("channels", []),
    )
    db.session.add(agent)
    db.session.commit()

    logger.info("Agente criado", extra={"agent_id": agent.id, "workspace_id": workspace_id})
    return jsonify(agent.to_dict()), 201


@bp.get("/<int:agent_id>")
@jwt_required()
def get_agent(agent_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)

    agent = Agent.query.filter_by(id=agent_id, workspace_id=workspace_id).first_or_404()
    return jsonify(agent.to_dict())


@bp.patch("/<int:agent_id>")
@jwt_required()
def update_agent(agent_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    data = request.get_json() or {}

    agent = Agent.query.filter_by(id=agent_id, workspace_id=workspace_id).first_or_404()

    allowed_fields = {"name", "system_prompt", "model", "temperature", "enabled", "channels"}
    for field in allowed_fields:
        if field in data:
            if field == "temperature":
                setattr(agent, field, float(data[field]))
            elif field == "enabled":
                setattr(agent, field, bool(data[field]))
            else:
                setattr(agent, field, data[field])

    db.session.commit()
    logger.info("Agente atualizado", extra={"agent_id": agent.id})
    return jsonify(agent.to_dict())


@bp.delete("/<int:agent_id>")
@jwt_required()
def delete_agent(agent_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)

    agent = Agent.query.filter_by(id=agent_id, workspace_id=workspace_id).first_or_404()
    db.session.delete(agent)
    db.session.commit()

    logger.info("Agente removido", extra={"agent_id": agent_id})
    return jsonify({"message": "Agente removido"})
