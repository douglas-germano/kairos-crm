"""
Rotas REST para Conversas.

GET    /api/conversations           — lista (filtrado por workspace + paginação)
GET    /api/conversations/<id>      — detalhe com contato
PATCH  /api/conversations/<id>      — atualiza status, assigned_to
PATCH  /api/conversations/<id>/ai   — toggle ai_enabled
DELETE /api/conversations/<id>      — fecha a conversa (status=closed)
"""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db, socketio
from app.models import Conversation, WorkspaceMember

logger = logging.getLogger(__name__)
bp = Blueprint("conversations", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    return member.workspace_id if member else None


@bp.get("")
@jwt_required()
def list_conversations():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    channel = request.args.get("channel")  # filtro opcional
    status = request.args.get("status")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 30))

    query = Conversation.query.filter_by(workspace_id=workspace_id)
    if channel:
        query = query.filter_by(channel=channel)
    if status:
        query = query.filter_by(status=status)
    query = query.order_by(Conversation.last_message_at.desc().nullslast())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    items = [c.to_dict(include_contact=True) for c in pagination.items]

    return jsonify({
        "items": items,
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
    })


@bp.get("/<int:conversation_id>")
@jwt_required()
def get_conversation(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    return jsonify(conv.to_dict(include_contact=True))


@bp.patch("/<int:conversation_id>")
@jwt_required()
def update_conversation(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    data = request.get_json() or {}

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    allowed_fields = {"status", "assigned_to"}
    for field in allowed_fields:
        if field in data:
            setattr(conv, field, data[field])

    db.session.commit()

    # Emite evento real-time
    try:
        socketio.emit(
            "conversation_updated",
            {"conversation_id": conv.id, "fields": {f: data[f] for f in allowed_fields if f in data}},
            room=f"workspace_{workspace_id}",
        )
    except Exception:
        pass

    return jsonify(conv.to_dict(include_contact=True))


@bp.patch("/<int:conversation_id>/ai")
@jwt_required()
def toggle_ai(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    data = request.get_json() or {}

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    if "ai_enabled" not in data:
        return jsonify({"error": "Campo ai_enabled obrigatório", "code": "MISSING_FIELD"}), 400

    conv.ai_enabled = bool(data["ai_enabled"])
    db.session.commit()

    try:
        socketio.emit(
            "conversation_updated",
            {"conversation_id": conv.id, "fields": {"ai_enabled": conv.ai_enabled}},
            room=f"workspace_{workspace_id}",
        )
    except Exception:
        pass

    return jsonify({"id": conv.id, "ai_enabled": conv.ai_enabled})


@bp.delete("/<int:conversation_id>")
@jwt_required()
def close_conversation(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    conv.status = "closed"
    db.session.commit()

    return jsonify({"message": "Conversa encerrada"})
