import logging
from datetime import datetime, timezone
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
    messages = data.get("messages")
    if isinstance(messages, list):
        for message in messages:
            _handle_message(instance_name, message)
        return
    if isinstance(messages, dict):
        records = messages.get("records") or messages.get("messages") or []
        if isinstance(records, list):
            for message in records:
                if isinstance(message, dict):
                    _handle_message(instance_name, message)
            return

    _handle_message(instance_name, data)


def _handle_message(instance_name: str, msg_data: dict):
    """Extrai dados do payload, salva a mensagem e enfileira para processamento."""
    key = msg_data.get("key", {})
    remote_jid = key.get("remoteJid", "")
    sender_pn = key.get("senderPn", "")
    from_me = key.get("fromMe", False)
    external_id = key.get("id", "")

    # Ignora mensagens enviadas por nós mesmos
    if from_me:
        return

    contact_external_id = canonical_external_id(remote_jid, sender_pn)
    if not contact_external_id:
        logger.warning("remoteJid inválido", extra={"remote_jid": remote_jid})
        return

    # Extrai conteúdo da mensagem (texto ou áudio)
    message_obj = msg_data.get("message", {})
    push_name = msg_data.get("pushName", contact_external_id)

    text = (
        message_obj.get("conversation")
        or message_obj.get("extendedTextMessage", {}).get("text")
        or ""
    )
    audio_b64 = (
        message_obj.get("audioMessage", {}).get("base64")
        or message_obj.get("pttMessage", {}).get("base64")
        or ""
    )

    if not text and not audio_b64:
        logger.debug("Mensagem sem conteúdo suportado ignorada", extra={"jid": remote_jid})
        return

    content = text or audio_b64
    content_type = "text" if text else "audio"

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

    # Salva a mensagem
    msg = Message(
        conversation_id=conversation.id,
        direction="inbound",
        content=content,
        content_type=content_type,
        status="delivered",
        external_id=external_id,
    )
    db.session.add(msg)
    conversation.last_message_at = datetime.now(timezone.utc)
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
    except Exception:
        pass

    # Enfileira para processamento de IA
    try:
        rq_queue.enqueue(
            "app.tasks.process_message.run",
            msg.id,
            job_timeout=60,
        )
    except Exception as exc:
        logger.error("Falha ao enfileirar mensagem WhatsApp", extra={"error": str(exc)})


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
