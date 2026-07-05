"""
Rotas REST para Conversas.

GET    /api/conversations           — lista (filtrado por workspace + paginação)
GET    /api/conversations/<id>      — detalhe com contato
POST   /api/conversations/initiate  — inicia nova conversa manualmente (WhatsApp)
PATCH  /api/conversations/<id>      — atualiza status, assigned_to
PATCH  /api/conversations/<id>/ai   — toggle ai_enabled
DELETE /api/conversations/<id>      — exclui a conversa e suas mensagens
"""
import logging
import re
from datetime import datetime, timezone
from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload
from app.extensions import db, socketio
from app.models import Contact, Conversation, Integration, Message, WorkspaceMember
from app.services.whatsapp_identity import (
    canonical_external_id,
    lookup_external_ids,
    remember_contact_identity,
)

logger = logging.getLogger(__name__)
bp = Blueprint("conversations", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id).first()
    return member.workspace_id if member else None


def _normalize_phone(phone: str) -> str:
    """Remove qualquer caractere não-numérico."""
    return re.sub(r"[^\d]", "", phone)


def _webhook_url() -> str:
    base = current_app.config.get("APP_BASE_URL", "http://localhost:5001").rstrip("/")
    url = f"{base}/webhooks/whatsapp"
    secret = current_app.config.get("WEBHOOK_SECRET", "")
    if secret:
        url += f"?token={secret}"
    return url


@bp.get("")
@jwt_required()
def list_conversations():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    channel = request.args.get("channel")
    status = request.args.get("status")
    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 30))
    except (ValueError, TypeError):
        return jsonify({"error": "Parametros page e per_page devem ser inteiros", "code": "INVALID_PARAMS"}), 400

    query = Conversation.query.filter_by(workspace_id=workspace_id).options(
        joinedload(Conversation.contact)
    )
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


@bp.post("/sync-whatsapp")
@jwt_required()
def sync_whatsapp_conversations():
    """Importa/atualiza a lista de conversas existentes na instância WhatsApp."""
    from app.services import evolution as evo_svc
    from app.services.evolution import EvolutionError

    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    integration = Integration.query.filter_by(
        workspace_id=workspace_id, channel="whatsapp", status="active"
    ).first()
    if not integration:
        return jsonify({"error": "Nenhuma integração WhatsApp ativa", "code": "NO_INTEGRATION"}), 400

    meta = integration.meta or {}
    instance_name = meta.get("instance_name") or f"kairos-crm-{user_id}"
    webhook_url = _webhook_url()
    try:
        evo_svc.set_webhook(instance_name, webhook_url)
        try:
            evo_svc.set_settings(instance_name, groups_ignore=False, sync_full_history=True)
        except EvolutionError as exc:
            logger.warning("Falha ao ajustar settings Evolution antes do sync | error=%s", exc)
        chats = evo_svc.find_chats(instance_name, limit=min(request.args.get("limit", 200, type=int), 500))
    except EvolutionError as exc:
        return jsonify({"error": str(exc), "code": "EVOLUTION_ERROR"}), 502

    imported = 0
    updated = 0
    skipped = 0
    for chat in chats:
        remote_jid = _chat_remote_jid(chat)
        if not remote_jid or remote_jid == "status@broadcast":
            skipped += 1
            continue

        contact_external_id = canonical_external_id(remote_jid)
        if not contact_external_id:
            skipped += 1
            continue

        contact = None
        for candidate in lookup_external_ids(remote_jid):
            contact = Contact.query.filter_by(
                workspace_id=workspace_id,
                channel="whatsapp",
                external_id=candidate,
            ).first()
            if contact:
                break

        name = _chat_name(chat, contact_external_id)
        if not contact:
            contact = Contact(
                workspace_id=workspace_id,
                channel="whatsapp",
                external_id=contact_external_id,
                name=name,
            )
            db.session.add(contact)
            db.session.flush()
        elif name and (not contact.name or contact.name == contact.external_id):
            contact.name = name

        remember_contact_identity(contact, remote_jid, None, name)

        conversation = Conversation.query.filter_by(
            workspace_id=workspace_id,
            contact_id=contact.id,
            channel="whatsapp",
        ).first()
        last_message_at = _chat_last_message_at(chat)
        if not conversation:
            conversation = Conversation(
                workspace_id=workspace_id,
                contact_id=contact.id,
                channel="whatsapp",
                status="open",
                last_message_at=last_message_at or datetime.now(timezone.utc),
            )
            db.session.add(conversation)
            imported += 1
        else:
            if last_message_at and (
                not conversation.last_message_at or last_message_at > conversation.last_message_at
            ):
                conversation.last_message_at = last_message_at
                updated += 1

    _update_integration_health(
        integration,
        last_chat_sync_at=datetime.now(timezone.utc).isoformat(),
        last_chat_sync_status="ok",
        last_chat_sync_total=len(chats),
        last_chat_sync_imported=imported,
        last_chat_sync_updated=updated,
        last_chat_sync_skipped=skipped,
        webhook_url=webhook_url,
        last_webhook_refresh_at=datetime.now(timezone.utc).isoformat(),
    )
    db.session.commit()

    try:
        socketio.emit(
            "conversation_updated",
            {"conversation_id": None, "fields": {"chat_sync": True}},
            room=f"workspace_{workspace_id}",
        )
    except Exception as exc:
        logger.warning("Falha ao emitir evento SocketIO | error=%s", exc)

    return jsonify({
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "total": len(chats),
    })


@bp.post("/initiate")
@jwt_required()
def initiate_conversation():
    """Inicia uma conversa WhatsApp a partir de um número adicionado manualmente."""
    from app.models import Integration, Contact, Message
    from app.services.whatsapp_identity import contact_has_phone, remember_contact_identity
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
        contacts = Contact.query.filter_by(workspace_id=workspace_id, channel="whatsapp").all()
        contact = next((item for item in contacts if contact_has_phone(item, phone_number)), None)

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
    remember_contact_identity(contact, f"{phone_number}@s.whatsapp.net", f"{phone_number}@s.whatsapp.net", name or None)

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
    except Exception as exc:
        logger.warning("Falha ao emitir evento SocketIO | error=%s", exc)

    return jsonify(conversation.to_dict(include_contact=True)), 201


@bp.get("/<int:conversation_id>")
@jwt_required()
def get_conversation(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace nao encontrado", "code": "NO_WORKSPACE"}), 404

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    return jsonify(conv.to_dict(include_contact=True))


@bp.patch("/<int:conversation_id>")
@jwt_required()
def update_conversation(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace nao encontrado", "code": "NO_WORKSPACE"}), 404
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
    except Exception as exc:
        logger.warning("Falha ao emitir evento SocketIO | error=%s", exc)

    return jsonify(conv.to_dict(include_contact=True))


@bp.post("/<int:conversation_id>/read")
@jwt_required()
def mark_read(conversation_id: int):
    """Zera o contador de mensagens não lidas ao abrir a conversa."""
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace nao encontrado", "code": "NO_WORKSPACE"}), 404

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    if conv.unread_count:
        conv.unread_count = 0
        db.session.commit()
        try:
            socketio.emit(
                "conversation_updated",
                {"conversation_id": conv.id, "fields": {"unread_count": 0}},
                room=f"workspace_{workspace_id}",
            )
        except Exception as exc:
            logger.warning("Falha ao emitir evento SocketIO | error=%s", exc)

    return jsonify({"id": conv.id, "unread_count": conv.unread_count})


@bp.patch("/<int:conversation_id>/ai")
@jwt_required()
def toggle_ai(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace nao encontrado", "code": "NO_WORKSPACE"}), 404
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
    except Exception as exc:
        logger.warning("Falha ao emitir evento SocketIO | error=%s", exc)

    return jsonify({"id": conv.id, "ai_enabled": conv.ai_enabled})


@bp.delete("/<int:conversation_id>")
@jwt_required()
def close_conversation(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace nao encontrado", "code": "NO_WORKSPACE"}), 404

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    Message.query.filter_by(conversation_id=conv.id).delete(synchronize_session=False)
    db.session.delete(conv)
    db.session.commit()

    try:
        socketio.emit(
            "conversation_deleted",
            {"conversation_id": conversation_id},
            room=f"workspace_{workspace_id}",
        )
    except Exception as exc:
        logger.warning("Falha ao emitir evento SocketIO | error=%s", exc)

    return jsonify({"deleted": True, "conversation_id": conversation_id})


def _chat_remote_jid(chat: dict) -> str:
    key = chat.get("key") or {}
    remote = (
        chat.get("remoteJid")
        or chat.get("remote_jid")
        or chat.get("jid")
        or chat.get("id")
        or key.get("remoteJid")
    )
    return str(remote or "").strip().lower()


def _chat_name(chat: dict, fallback: str) -> str:
    contact = chat.get("contact") if isinstance(chat.get("contact"), dict) else {}
    name = (
        chat.get("name")
        or chat.get("pushName")
        or chat.get("subject")
        or contact.get("name")
        or contact.get("pushName")
        or contact.get("notify")
        or fallback
    )
    return str(name).strip() or fallback


def _chat_last_message_at(chat: dict) -> datetime | None:
    value = (
        chat.get("conversationTimestamp")
        or chat.get("messageTimestamp")
        or chat.get("updatedAt")
        or chat.get("lastMessageAt")
    )
    if value is None and isinstance(chat.get("lastMessage"), dict):
        value = chat["lastMessage"].get("messageTimestamp") or chat["lastMessage"].get("createdAt")
    return _parse_chat_datetime(value)


def _parse_chat_datetime(value) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)) or (isinstance(value, str) and value.isdigit()):
        timestamp = int(value)
        if timestamp > 10_000_000_000:
            timestamp = timestamp / 1000
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(tzinfo=None)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _update_integration_health(integration: Integration, **fields):
    meta = dict(integration.meta or {})
    health = dict(meta.get("health") or {})
    health.update(fields)
    meta["health"] = health
    integration.meta = meta
