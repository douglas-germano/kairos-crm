"""
Rotas REST para Flows.

GET    /api/flows              — lista flows do workspace (via agentes)
GET    /api/flows/<id>         — detalhe do flow
POST   /api/flows              — cria novo flow para um agente
PATCH  /api/flows/<id>         — atualiza nodes, edges, active, name, trigger_*
DELETE /api/flows/<id>         — remove flow
"""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Flow, Agent, WorkspaceMember
from sqlalchemy import select

logger = logging.getLogger(__name__)
bp = Blueprint("flows", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    return member.workspace_id if member else None


def _flow_belongs_to_workspace(flow_id: int, workspace_id: int) -> "Flow | None":
    """Retorna o Flow se pertencer ao workspace do usuário, None caso contrário."""
    flow = db.session.get(Flow, flow_id)
    if not flow:
        return None
    agent = Agent.query.filter_by(id=flow.agent_id, workspace_id=workspace_id).first()
    return flow if agent else None


@bp.get("")
@jwt_required()
def list_flows():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    agent_id_filter = request.args.get("agent_id", type=int)

    # Busca todos os agent_ids do workspace
    agent_query = Agent.query.filter_by(workspace_id=workspace_id)
    if agent_id_filter:
        agent_query = agent_query.filter_by(id=agent_id_filter)
    agent_ids = [a.id for a in agent_query.all()]

    flows = Flow.query.filter(Flow.agent_id.in_(agent_ids)).order_by(Flow.created_at).all()
    return jsonify([f.to_dict() for f in flows])


@bp.get("/<int:flow_id>")
@jwt_required()
def get_flow(flow_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)

    flow = _flow_belongs_to_workspace(flow_id, workspace_id)
    if not flow:
        return jsonify({"error": "Flow não encontrado", "code": "NOT_FOUND"}), 404

    return jsonify(flow.to_dict())


@bp.post("")
@jwt_required()
def create_flow():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    agent_id = data.get("agent_id")
    name = data.get("name", "").strip()

    if not agent_id or not name:
        return jsonify({"error": "Campos agent_id e name são obrigatórios", "code": "MISSING_FIELDS"}), 400

    # Verifica que o agente pertence ao workspace
    agent = Agent.query.filter_by(id=agent_id, workspace_id=workspace_id).first()
    if not agent:
        return jsonify({"error": "Agente não encontrado", "code": "AGENT_NOT_FOUND"}), 404

    flow = Flow(
        agent_id=agent_id,
        name=name,
        trigger_type=data.get("trigger_type", "first_message"),
        trigger_config=data.get("trigger_config", {}),
        nodes=data.get("nodes", []),
        edges=data.get("edges", []),
        active=bool(data.get("active", False)),
    )
    db.session.add(flow)
    db.session.commit()

    logger.info("Flow criado", extra={"flow_id": flow.id, "agent_id": agent_id})
    return jsonify(flow.to_dict()), 201


@bp.patch("/<int:flow_id>")
@jwt_required()
def update_flow(flow_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    data = request.get_json() or {}

    flow = _flow_belongs_to_workspace(flow_id, workspace_id)
    if not flow:
        return jsonify({"error": "Flow não encontrado", "code": "NOT_FOUND"}), 404

    allowed = {"name", "trigger_type", "trigger_config", "nodes", "edges", "active"}
    for field in allowed:
        if field in data:
            if field == "active":
                setattr(flow, field, bool(data[field]))
            else:
                setattr(flow, field, data[field])

    db.session.commit()
    logger.info("Flow atualizado", extra={"flow_id": flow.id})
    return jsonify(flow.to_dict())


@bp.delete("/<int:flow_id>")
@jwt_required()
def delete_flow(flow_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)

    flow = _flow_belongs_to_workspace(flow_id, workspace_id)
    if not flow:
        return jsonify({"error": "Flow não encontrado", "code": "NOT_FOUND"}), 404

    db.session.delete(flow)
    db.session.commit()

    logger.info("Flow removido", extra={"flow_id": flow_id})
    return jsonify({"message": "Flow removido"})
