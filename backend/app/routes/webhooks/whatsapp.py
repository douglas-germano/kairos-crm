import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.extensions import db, rq_queue
from app.models import Integration, Contact, Conversation, Message

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

    if event in _MESSAGE_EVENTS:
        _handle_messages(instance_name, data.get("data", {}))
    elif event in _CONNECTION_EVENTS:
        _handle_connection_update(instance_name, data.get("data", {}))
    else:
        logger.debug("Evento WhatsApp ignorado", extra={"event": event})

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
        db.session.commit()
        logger.info(
            "Status WhatsApp atualizado via CONNECTION_UPDATE",
            extra={"instance": instance_name, "state": state, "status": new_status},
        )


def _handle_messages(instance_name: str, data: dict):
    """Normaliza payloads da Evolution e processa uma ou mais mensagens."""
    messages = data.get("messages")
    if isinstance(messages, list):
        for message in messages:
            _handle_message(instance_name, message)
        return

    _handle_message(instance_name, data)


def _handle_message(instance_name: str, msg_data: dict):
    """Extrai dados do payload, salva a mensagem e enfileira para processamento."""
    key = msg_data.get("key", {})
    remote_jid = key.get("remoteJid", "")
    from_me = key.get("fromMe", False)
    external_id = key.get("id", "")

    # Ignora mensagens enviadas por nós mesmos
    if from_me:
        return

    # Extrai número removendo @s.whatsapp.net (ou @g.us para grupos)
    phone_number = remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
    if not phone_number:
        logger.warning("remoteJid inválido", extra={"remote_jid": remote_jid})
        return

    # Extrai conteúdo da mensagem (texto ou áudio)
    message_obj = msg_data.get("message", {})
    push_name = msg_data.get("pushName", phone_number)

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

    # Cria ou localiza o contato
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
            name=push_name,
        )
        db.session.add(contact)
        db.session.flush()
    else:
        # Atualiza o nome se ainda não estava definido
        if contact.name == contact.external_id and push_name:
            contact.name = push_name

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
