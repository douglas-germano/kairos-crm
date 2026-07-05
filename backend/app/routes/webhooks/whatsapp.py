import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from app.extensions import db, rq_queue, socketio
from app.models import Integration, Contact, Conversation, Message
from app.services.whatsapp_identity import (
    canonical_external_id,
    lookup_external_ids,
    remember_contact_identity,
)

logger = logging.getLogger(__name__)
bp = Blueprint("webhook_whatsapp", __name__)

# Eventos que atualizam o status de conexão
_MESSAGE_EVENTS = {"messages.upsert", "MESSAGES_UPSERT"}
_CONNECTION_EVENTS = {"connection.update", "CONNECTION_UPDATE"}
_STATUS_EVENTS = {"messages.update", "MESSAGES_UPDATE"}

# Mapeia os status de ACK do WhatsApp (Baileys/Evolution API) para o nosso enum de status.
# Baileys usa tanto strings quanto códigos numéricos dependendo da versão/evento.
_ACK_STATUS_MAP = {
    "ERROR": "failed",
    "PENDING": "sent",
    "SERVER_ACK": "sent",
    "DELIVERY_ACK": "delivered",
    "READ": "read",
    "PLAYED": "read",
    "0": "failed",
    "1": "sent",
    "2": "sent",
    "3": "delivered",
    "4": "read",
    "5": "read",
}
_STATUS_ORDER = {"sent": 0, "delivered": 1, "read": 2}


@bp.post("/whatsapp")
def receive():
    """Recebe mensagens e eventos do WhatsApp via Evolution API webhooks."""
    expected_token = current_app.config.get("WEBHOOK_SECRET", "")
    if expected_token and request.args.get("token") != expected_token:
        logger.warning("Token de webhook WhatsApp inválido ou ausente")
        return jsonify({"error": "Unauthorized", "code": "INVALID_TOKEN"}), 401

    data = request.get_json(silent=True) or {}

    event = data.get("event", "")
    instance_name = data.get("instance")

    try:
        if event in _MESSAGE_EVENTS:
            _handle_messages(instance_name, data.get("data", {}))
        elif event in _CONNECTION_EVENTS:
            _handle_connection_update(instance_name, data.get("data", {}))
        elif event in _STATUS_EVENTS:
            _handle_status_updates(instance_name, data.get("data", {}))
        else:
            logger.debug("Evento WhatsApp ignorado", extra={"event": event})
    except Exception as exc:
        db.session.rollback()
        logger.exception("Falha ao processar webhook WhatsApp", extra={"event": event, "instance": instance_name})
        integration = _find_integration_any_status(instance_name)
        if integration:
            _update_health(
                integration,
                last_webhook_error=str(exc),
                last_webhook_event=event,
                last_webhook_at=datetime.now(timezone.utc).isoformat(),
            )
            db.session.commit()
        return jsonify({"status": "error", "message": "webhook processing failed"}), 500

    # Retorna 200 imediatamente — processamento pesado vai para a fila
    return jsonify({"status": "ok"}), 200


def _handle_connection_update(instance_name: str, data: dict):
    """Atualiza o status da integração quando a conexão WhatsApp muda."""
    state = data.get("state", "")  # open | close | connecting
    # Busca por qualquer status — o evento pode chegar enquanto ainda é "pending"
    integration = _find_integration_any_status(instance_name)
    if not integration:
        return

    new_status = {
        "open": "active",
        "close": "inactive",
        "connecting": "pending",
    }.get(state)

    if new_status and integration.status != new_status:
        integration.status = new_status
    _update_health(
        integration,
        last_connection_state=state,
        last_connection_event_at=datetime.now(timezone.utc).isoformat(),
        last_webhook_error=None,
    )
    db.session.commit()
    logger.info(
        "Status WhatsApp atualizado via CONNECTION_UPDATE",
        extra={"instance": instance_name, "state": state, "status": integration.status},
    )


def _handle_status_updates(instance_name: str, data: dict):
    """Processa eventos de ACK (sent/delivered/read) de mensagens outbound."""
    items: list[dict]
    if isinstance(data, list):
        items = [item for item in data if isinstance(item, dict)]
    elif isinstance(data, dict):
        nested = data.get("updates") or data.get("messages")
        items = [item for item in nested if isinstance(item, dict)] if isinstance(nested, list) else [data]
    else:
        items = []

    for item in items:
        _handle_status_update(instance_name, item)


def _handle_status_update(instance_name: str, item: dict):
    key = item.get("key") or {}
    ext_id = key.get("id") or item.get("keyId") or item.get("id")
    if not ext_id:
        return

    raw_status = item.get("status") or (item.get("update") or {}).get("status") or key.get("status")
    if raw_status is None:
        return

    new_status = _ACK_STATUS_MAP.get(str(raw_status).upper())
    if not new_status:
        logger.debug("Status de ACK desconhecido", extra={"status": raw_status, "ext_id": ext_id})
        return

    integration = _find_integration_any_status(instance_name)
    if not integration:
        return

    msg = (
        Message.query.join(Conversation)
        .filter(Conversation.workspace_id == integration.workspace_id, Message.external_id == ext_id)
        .first()
    )
    if not msg or msg.status == new_status:
        return

    # Evita regressão de status quando eventos chegam fora de ordem
    if msg.status in _STATUS_ORDER and new_status in _STATUS_ORDER:
        if _STATUS_ORDER[new_status] < _STATUS_ORDER[msg.status]:
            return

    msg.status = new_status
    db.session.commit()

    try:
        socketio.emit(
            "message_status_updated",
            {"conversation_id": msg.conversation_id, "message_id": msg.id, "status": msg.status},
            room=f"workspace_{integration.workspace_id}",
        )
    except Exception as exc:
        logger.warning("Falha ao emitir message_status_updated | msg=%s error=%s", msg.id, exc)


def _handle_messages(instance_name: str, data: dict):
    """Normaliza payloads da Evolution e processa uma ou mais mensagens."""
    handled = 0
    for message in _message_items(data):
        _handle_message(instance_name, message)
        handled += 1

    if handled == 0:
        integration = _find_integration_any_status(instance_name)
        if integration:
            _update_health(
                integration,
                last_webhook_at=datetime.now(timezone.utc).isoformat(),
                last_webhook_event="MESSAGES_UPSERT",
                last_webhook_error="payload sem mensagens processaveis",
                last_webhook_payload_shape=type(data).__name__,
            )
            db.session.commit()


def _handle_message(instance_name: str, msg_data: dict):
    """Extrai dados do payload, salva a mensagem e enfileira para processamento."""
    key = msg_data.get("key", {})
    remote_jid = key.get("remoteJid", "")
    sender_pn = key.get("senderPn", "")
    from_me = bool(key.get("fromMe", False))
    external_id = key.get("id", "")

    contact_external_id = canonical_external_id(remote_jid, sender_pn)
    if not contact_external_id:
        _mark_webhook_ignored(
            instance_name,
            "remoteJid inválido",
            remote_jid=remote_jid,
            external_id=external_id,
        )
        return

    # Extrai conteúdo da mensagem (suporta texto, imagem, figurinha, áudio, vídeo)
    message_obj = msg_data.get("message", {})
    push_name = msg_data.get("pushName", contact_external_id)

    content, content_type, caption, file_name = _extract_message_content(message_obj, msg_data, instance_name)

    if not content:
        _mark_webhook_ignored(
            instance_name,
            "mensagem sem conteúdo suportado",
            remote_jid=remote_jid,
            external_id=external_id,
            message_keys=list(message_obj.keys()) if isinstance(message_obj, dict) else [],
        )
        return

    # Encontra a integração WhatsApp pela instance_name
    integration = _find_integration(instance_name)
    if not integration:
        logger.warning(
            "Integração WhatsApp não encontrada para instance",
            extra={"instance": instance_name},
        )
        return

    workspace_id = integration.workspace_id
    _update_health(
        integration,
        last_webhook_at=datetime.now(timezone.utc).isoformat(),
        last_webhook_event="MESSAGES_UPSERT",
        last_remote_jid=remote_jid,
        last_sender_pn=sender_pn,
        last_message_external_id=external_id,
        last_webhook_error=None,
    )

    # Cria ou localiza o contato
    contact = None
    for candidate in lookup_external_ids(remote_jid, sender_pn):
        contact = Contact.query.filter_by(
            workspace_id=workspace_id,
            channel="whatsapp",
            external_id=candidate,
        ).first()
        if contact:
            break

    if not contact:
        contact = Contact(
            workspace_id=workspace_id,
            channel="whatsapp",
            external_id=contact_external_id,
            name=push_name,
        )
        db.session.add(contact)
        db.session.flush()
    else:
        # Atualiza o nome se ainda não estava definido
        if not contact.name and push_name:
            contact.name = push_name
    remember_contact_identity(contact, remote_jid, sender_pn, push_name)

    # Cria ou localiza a conversa aberta
    conversation = (
        Conversation.query.filter_by(
            workspace_id=workspace_id,
            contact_id=contact.id,
            channel="whatsapp",
        )
        .filter(Conversation.status != "closed")
        .first()
    )

    if not conversation:
        conversation = Conversation(
            workspace_id=workspace_id,
            contact_id=contact.id,
            channel="whatsapp",
            status="open",
        )
        db.session.add(conversation)
        db.session.flush()

    if external_id:
        existing = Message.query.filter_by(
            conversation_id=conversation.id,
            external_id=external_id,
        ).first()
        if existing:
            if caption and not existing.caption:
                existing.caption = caption
            db.session.commit()
            return

    # Salva a mensagem. Mensagens enviadas fora do CRM chegam como fromMe=True e
    # devem aparecer no histórico para manter a conversa atualizada.
    msg = Message(
        conversation_id=conversation.id,
        direction="outbound" if from_me else "inbound",
        content=content,
        content_type=content_type,
        caption=caption or None,
        file_name=file_name or None,
        status="sent" if from_me else "delivered",
        external_id=external_id,
    )
    db.session.add(msg)
    conversation.last_message_at = datetime.now(timezone.utc)
    if not from_me:
        conversation.unread_count = (conversation.unread_count or 0) + 1
    db.session.commit()

    logger.info(
        "Mensagem WhatsApp salva",
        extra={"message_id": msg.id, "conversation_id": conversation.id},
    )

    try:
        socketio.emit(
            "new_message",
            {"conversation_id": conversation.id, "message": msg.to_dict()},
            room=f"workspace_{workspace_id}",
        )
    except Exception as exc:
        logger.warning("Falha ao emitir evento SocketIO new_message | conv=%s error=%s", conversation.id, exc)

    if not from_me:
        # Enfileira para processamento de IA apenas para mensagens do cliente.
        try:
            rq_queue.enqueue(
                "app.tasks.process_message.run",
                msg.id,
                job_timeout=60,
            )
        except Exception as exc:
            logger.error("Falha ao enfileirar mensagem WhatsApp", extra={"error": str(exc)})


def _message_items(data) -> list[dict]:
    """Retorna mensagens em formatos comuns do webhook/consulta da Evolution."""
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if not isinstance(data, dict):
        return []

    for key in ("messages", "records"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = value.get("records") or value.get("messages") or value.get("data")
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
            return [value]

    if isinstance(data.get("data"), list):
        return [item for item in data["data"] if isinstance(item, dict)]
    if isinstance(data.get("data"), dict):
        return _message_items(data["data"])

    return [data] if isinstance(data.get("key"), dict) or isinstance(data.get("message"), dict) else []


def _extract_message_content(message_obj: dict, raw_msg: dict | None = None, instance_name: str | None = None) -> tuple[str, str, str, str]:
    """Extrai (content, content_type, caption, file_name) de um objeto de mensagem da Evolution API."""
    m = message_obj or {}

    for wrapper_key in ("ephemeralMessage", "viewOnceMessage", "documentWithCaptionMessage"):
        wrapped = (m.get(wrapper_key) or {}).get("message")
        if wrapped:
            return _extract_message_content(wrapped, raw_msg, instance_name)

    if text := (m.get("conversation") or (m.get("extendedTextMessage") or {}).get("text", "")):
        return text, "text", "", ""

    if img := m.get("imageMessage"):
        return _extract_media_content(raw_msg or {"message": message_obj}, img, "image", "[imagem]", instance_name)

    if sticker := m.get("stickerMessage"):
        return _extract_media_content(raw_msg or {"message": message_obj}, sticker, "sticker", "[figurinha]", instance_name)

    if aud := (m.get("audioMessage") or m.get("pttMessage")):
        return _extract_media_content(raw_msg or {"message": message_obj}, aud, "audio", "[audio]", instance_name)

    if vid := m.get("videoMessage"):
        return _extract_media_content(raw_msg or {"message": message_obj}, vid, "video", "[video]", instance_name)

    if doc := m.get("documentMessage"):
        return _extract_media_content(raw_msg or {"message": message_obj}, doc, "template", "[documento]", instance_name)

    if reaction := m.get("reactionMessage"):
        data = reaction.get("text") or ""
        return data or "[reação]", "text", "", ""

    return "", "text", "", ""


def _extract_media_content(
    raw_msg: dict,
    media_obj: dict,
    content_type: str,
    placeholder: str,
    instance_name: str | None = None,
) -> tuple[str, str, str, str]:
    caption = _extract_caption(media_obj)
    file_name = _extract_file_name(media_obj)
    if base64_content := media_obj.get("base64"):
        content = _media_data_url(base64_content, media_obj.get("mimetype") or media_obj.get("mimeType"), content_type)
        return content, content_type, caption, file_name

    if instance_name:
        try:
            from app.services import evolution as evo_svc
            media = evo_svc.get_media_base64(instance_name, raw_msg)
            if media.get("base64"):
                content = _media_data_url(media["base64"], media.get("mimetype") or media_obj.get("mimetype"), content_type)
                return content, content_type, caption, file_name
            logger.warning(
                "Evolution não retornou base64 de mídia | ext_id=%s content_type=%s media_keys=%s",
                (raw_msg.get("key") or {}).get("id"),
                content_type,
                list(media_obj.keys()),
            )
        except Exception as exc:
            logger.warning(
                "Falha ao baixar mídia Evolution | ext_id=%s error=%s",
                (raw_msg.get("key") or {}).get("id"),
                exc,
            )

    if thumbnail := _extract_thumbnail(media_obj):
        return _media_data_url(thumbnail, "image/jpeg", "image"), content_type, caption, file_name

    if direct_url := _extract_public_media_url(media_obj):
        return direct_url, content_type, caption, file_name

    return caption or placeholder, content_type, "", file_name


def _extract_caption(media_obj: dict) -> str:
    return (media_obj.get("caption") or media_obj.get("title") or "").strip()


def _extract_file_name(media_obj: dict) -> str:
    return (media_obj.get("fileName") or media_obj.get("filename") or "").strip()


def _extract_public_media_url(media_obj: dict) -> str:
    for key in ("mediaUrl", "url"):
        value = media_obj.get(key)
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            # URLs do WhatsApp/Baileys normalmente são criptografadas e não
            # renderizam direto no navegador; só usamos URL pública como último
            # recurso quando não parece ser CDN interna do WhatsApp.
            if "whatsapp.net" not in value and "mmg.whatsapp" not in value:
                return value
    return ""


def _extract_thumbnail(media_obj: dict) -> str:
    for key in ("jpegThumbnail", "thumbnail"):
        value = media_obj.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def _media_data_url(content: str, mimetype: str | None = None, content_type: str | None = None) -> str:
    if not content or content.startswith(("http://", "https://", "data:")):
        return content
    fallback_mime = {
        "image": "image/jpeg",
        "sticker": "image/webp",
        "audio": "audio/ogg",
        "video": "video/mp4",
        "template": "application/octet-stream",
    }.get(content_type or "", "application/octet-stream")
    return f"data:{mimetype or fallback_mime};base64,{content}"


def _mark_webhook_ignored(instance_name: str, reason: str, **fields):
    logger.warning("Mensagem WhatsApp ignorada | reason=%s", reason, extra=fields)
    integration = _find_integration_any_status(instance_name)
    if not integration:
        return
    _update_health(
        integration,
        last_webhook_at=datetime.now(timezone.utc).isoformat(),
        last_webhook_event="MESSAGES_UPSERT",
        last_webhook_ignored_reason=reason,
        last_webhook_ignored_fields=fields,
        last_webhook_error=None,
    )
    db.session.commit()


def _find_integration(instance_name: str) -> Integration | None:
    """Busca integração ativa pelo instance_name usando query JSON no banco."""
    return Integration.query.filter(
        Integration.channel == "whatsapp",
        Integration.status == "active",
        Integration.meta["instance_name"].as_string() == instance_name,
    ).first()


def _find_integration_any_status(instance_name: str) -> Integration | None:
    """Busca integração por instance_name independente do status."""
    return Integration.query.filter(
        Integration.channel == "whatsapp",
        Integration.meta["instance_name"].as_string() == instance_name,
    ).first()


def _update_health(integration: Integration, **fields):
    meta = dict(integration.meta or {})
    health = dict(meta.get("health") or {})
    health.update(fields)
    meta["health"] = health
    integration.meta = meta
