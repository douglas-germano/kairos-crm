"""
Rotas REST para Conversas.

GET    /api/conversations           — lista (filtrado por workspace + paginação)
GET    /api/conversations/<id>      — detalhe com contato
POST   /api/conversations/initiate  — inicia nova conversa manualmente (WhatsApp)
PATCH  /api/conversations/<id>      — atualiza status, assigned_to
PATCH  /api/conversations/<id>/ai   — toggle ai_enabled
DELETE /api/conversations/<id>      — fecha a conversa (status=closed)
"""
import logging
import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db, socketio
from app.models import Conversation, WorkspaceMember

logger = logging.getLogger(__name__)
bp = Blueprint("conversations", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    return member.workspace_id if member else None


def _normalize_phone(phone: str) -> str:
    """Remove qualquer caractere não-numérico."""
    return re.sub(r"[^\d]", "", phone)


@bp.get("")
@jwt_required()
def list_conversations():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    channel = request.args.get("channel")
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


@bp.post("/initiate")
@jwt_required()
def initiate_conversation():
    """Inicia uma conversa WhatsApp a partir de um número adicionado manualmente."""
    from app.models import Integration, Contact, Message
    from app.services.whatsapp_service import get_whatsapp_service

    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    phone_raw = data.get("phone_number", "").strip()
    name = data.get("name", "").strip()
    message = data.get("message", "").strip()

    if not phone_raw:
        return jsonify({"error": "phone_number é obrigatório", "code": "MISSING_PHONE"}), 400

    phone_number = _normalize_phone(phone_raw)
    if len(phone_number) < 8:
        return jsonify({"error": "Número de telefone inválido", "code": "INVALID_PHONE"}), 400

    integration = Integration.query.filter_by(
        workspace_id=workspace_id, channel="whatsapp", status="active"
    ).first()
    if not integration:
        return jsonify({"error": "Nenhuma integração WhatsApp ativa", "code": "NO_WHATSAPP_INTEGRATION"}), 400

    # Encontra ou cria contato
    contact = Contact.query.filter_by(
        workspace_id=workspace_id,
        channel="whatsapp",
        external_id=phone_number,
    ).first()

    if not contact:
        contact = Contact(
            workspace_id=workspace_id,
            channel="whatsapp",
            external_id=phone_number,
            name=name or phone_number,
        )
        db.session.add(contact)
        db.session.flush()
    elif name and not contact.name:
        contact.name = name

    # Reabre conversa existente ou cria nova
    conversation = (
        Conversation.query.filter_by(
            workspace_id=workspace_id,
            contact_id=contact.id,
            channel="whatsapp",
        )
        .filter(Conversation.status != "closed")
        .first()
    )

    created_new = conversation is None
    if not conversation:
        conversation = Conversation(
            workspace_id=workspace_id,
            contact_id=contact.id,
            channel="whatsapp",
            status="open",
            last_message_at=datetime.now(timezone.utc),
        )
        db.session.add(conversation)
        db.session.flush()

    # Envia mensagem inicial se fornecida
    if message:
        msg = Message(
            conversation_id=conversation.id,
            direction="outbound",
            content=message,
            content_type="text",
            status="sent",
        )
        db.session.add(msg)
        conversation.last_message_at = datetime.now(timezone.utc)
        db.session.flush()

        try:
            svc = get_whatsapp_service(integration)
            result = svc.send_text(phone_number, message)
            ext_id = result.get("key", {}).get("id") if isinstance(result, dict) else None
            msg.external_id = ext_id
        except Exception as exc:
            logger.error("Falha ao enviar mensagem inicial", extra={"error": str(exc)})
            msg.status = "failed"

    db.session.commit()

    logger.info(
        "Conversa iniciada manualmente",
        extra={"conversation_id": conversation.id, "phone": phone_number, "new": created_new},
    )

    try:
        socketio.emit(
            "conversation_updated",
            {"conversation_id": conversation.id, "fields": {}},
            room=f"workspace_{workspace_id}",
        )
    except Exception:
        pass

    return jsonify(conversation.to_dict(include_contact=True)), 201


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
