"""
Rotas REST para Mensagens.

GET  /api/messages/<conversation_id>  — histórico paginado de uma conversa
POST /api/messages/<conversation_id>  — envia mensagem outbound manualmente
"""
import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db, socketio
from app.models import Conversation, Message, Integration, WorkspaceMember

logger = logging.getLogger(__name__)
bp = Blueprint("messages", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    return member.workspace_id if member else None


@bp.get("/<int:conversation_id>")
@jwt_required()
def list_messages(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    # Paginação scroll infinito — cursor-based (before_id)
    before_id = request.args.get("before_id", type=int)
    limit = min(int(request.args.get("limit", 50)), 100)

    query = Message.query.filter_by(conversation_id=conv.id)
    if before_id:
        query = query.filter(Message.id < before_id)
    query = query.order_by(Message.id.desc()).limit(limit)

    messages = list(reversed(query.all()))
    return jsonify([m.to_dict() for m in messages])


@bp.post("/<int:conversation_id>")
@jwt_required()
def send_message(conversation_id: int):
    """Envio manual de mensagem outbound pelo operador humano."""
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    content = data.get("content", "").strip()
    content_type = data.get("content_type", "text")
    if not content:
        return jsonify({"error": "content é obrigatório", "code": "MISSING_CONTENT"}), 400

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    channel = conv.channel
    contact = conv.contact
    integration = Integration.query.filter_by(
        workspace_id=workspace_id, channel=channel, status="active"
    ).first()

    # Salva a mensagem antes de enviar — o operador vê o que digitou independente do resultado
    msg = Message(
        conversation_id=conv.id,
        direction="outbound",
        content=content,
        content_type=content_type,
        status="sent",
        external_id=None,
    )
    db.session.add(msg)
    conv.last_message_at = datetime.now(timezone.utc)
    db.session.commit()

    # Tenta enviar pelo canal — falhas não removem a mensagem do banco
    if integration:
        try:
            if channel == "whatsapp":
                from app.services.whatsapp_service import get_whatsapp_service
                svc = get_whatsapp_service(integration)
                if content_type == "audio":
                    result = svc.send_audio(contact.external_id, content)
                else:
                    result = svc.send_text(contact.external_id, content)
                ext_id = result.get("key", {}).get("id") if isinstance(result, dict) else None
                msg.external_id = ext_id
            elif channel == "instagram":
                from app.services.instagram_service import get_instagram_service
                svc = get_instagram_service(integration)
                result = svc.send_text(contact.external_id, content)
                ext_id = result.get("message_id") if isinstance(result, dict) else None
                msg.external_id = ext_id
            db.session.commit()
        except Exception as exc:
            logger.error("Falha ao enviar mensagem pelo canal", extra={"channel": channel, "error": str(exc)})
            msg.status = "failed"
            db.session.commit()

    # Emite evento real-time
    try:
        socketio.emit(
            "new_message",
            {"conversation_id": conv.id, "message": msg.to_dict()},
            room=f"workspace_{workspace_id}",
        )
    except Exception:
        pass

    return jsonify(msg.to_dict()), 201
