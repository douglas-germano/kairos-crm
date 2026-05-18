import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
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


@bp.post("/whatsapp")
def receive():
    """Recebe mensagens e eventos do WhatsApp via Evolution API webhooks."""
    data = request.get_json(silent=True) or {}

    event = data.get("event", "")
    instance_name = data.get("instance")

    try:
        if event in _MESSAGE_EVENTS:
            _handle_messages(instance_name, data.get("data", {}))
        elif event in _CONNECTION_EVENTS:
            _handle_connection_update(instance_name, data.get("data", {}))
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
                last_webhook_at=datetime.utcnow().isoformat(),
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
        last_connection_event_at=datetime.utcnow().isoformat(),
        last_webhook_error=None,
    )
    db.session.commit()
    logger.info(
        "Status WhatsApp atualizado via CONNECTION_UPDATE",
        extra={"instance": instance_name, "state": state, "status": integration.status},
    )


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
                last_webhook_at=datetime.utcnow().isoformat(),
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

    content, content_type = _extract_message_content(message_obj)

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
        last_webhook_at=datetime.utcnow().isoformat(),
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
            db.session.commit()
            return

    # Salva a mensagem. Mensagens enviadas fora do CRM chegam como fromMe=True e
    # devem aparecer no histórico para manter a conversa atualizada.
    msg = Message(
        conversation_id=conversation.id,
        direction="outbound" if from_me else "inbound",
        content=content,
        content_type=content_type,
        status="sent" if from_me else "delivered",
        external_id=external_id,
    )
    db.session.add(msg)
    conversation.last_message_at = datetime.utcnow()
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


def _extract_message_content(message_obj: dict) -> tuple[str, str]:
    """Extrai (content, content_type) de um objeto de mensagem da Evolution API."""
    m = message_obj or {}

    for wrapper_key in ("ephemeralMessage", "viewOnceMessage", "documentWithCaptionMessage"):
        wrapped = (m.get(wrapper_key) or {}).get("message")
        if wrapped:
            return _extract_message_content(wrapped)

    if text := (m.get("conversation") or (m.get("extendedTextMessage") or {}).get("text", "")):
        return text, "text"

    if img := m.get("imageMessage"):
        data = img.get("base64") or img.get("url") or img.get("caption") or ""
        return data or "[imagem]", "image"

    if sticker := m.get("stickerMessage"):
        data = sticker.get("base64") or sticker.get("url") or ""
        return data or "[figurinha]", "sticker"

    if aud := (m.get("audioMessage") or m.get("pttMessage")):
        data = aud.get("base64") or aud.get("url") or ""
        return data or "[audio]", "audio"

    if vid := m.get("videoMessage"):
        data = vid.get("url") or vid.get("caption") or ""
        return data or "[video]", "video"

    if doc := m.get("documentMessage"):
        data = doc.get("url") or doc.get("title") or ""
        return data or "[documento]", "template"

    if reaction := m.get("reactionMessage"):
        data = reaction.get("text") or ""
        return data or "[reação]", "text"

    return "", "text"


def _mark_webhook_ignored(instance_name: str, reason: str, **fields):
    logger.warning("Mensagem WhatsApp ignorada | reason=%s", reason, extra=fields)
    integration = _find_integration_any_status(instance_name)
    if not integration:
        return
    _update_health(
        integration,
        last_webhook_at=datetime.utcnow().isoformat(),
        last_webhook_event="MESSAGES_UPSERT",
        last_webhook_ignored_reason=reason,
        last_webhook_ignored_fields=fields,
        last_webhook_error=None,
    )
    db.session.commit()


def _find_integration(instance_name: str) -> Integration | None:
    """Busca integração ativa pelo instance_name — usada para processar mensagens."""
    integrations = Integration.query.filter_by(
        channel="whatsapp", status="active"
    ).all()
    for integ in integrations:
        if integ.meta and integ.meta.get("instance_name") == instance_name:
            return integ
    return None


def _find_integration_any_status(instance_name: str) -> Integration | None:
    """Busca integração por instance_name independente do status — usada para atualizar conexão."""
    integrations = Integration.query.filter_by(channel="whatsapp").all()
    for integ in integrations:
        if integ.meta and integ.meta.get("instance_name") == instance_name:
            return integ
    return None


def _update_health(integration: Integration, **fields):
    meta = dict(integration.meta or {})
    health = dict(meta.get("health") or {})
    health.update(fields)
    meta["health"] = health
    integration.meta = meta
