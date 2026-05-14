import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from app.extensions import db, rq_queue
from app.models import Integration, Contact, Conversation, Message

logger = logging.getLogger(__name__)
bp = Blueprint("webhook_instagram", __name__)


@bp.get("/instagram")
def verify():
    """Meta chama este endpoint para verificar o webhook na configuração."""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token == current_app.config["META_VERIFY_TOKEN"]:
        logger.info("Webhook Instagram verificado com sucesso")
        return challenge, 200

    logger.warning("Falha na verificação do webhook Instagram", extra={"token": token})
    return jsonify({"error": "Verificação falhou", "code": "VERIFY_FAILED"}), 403


@bp.post("/instagram")
def receive():
    """Recebe mensagens/eventos do Instagram via Meta Webhooks."""
    data = request.get_json(silent=True) or {}

    if data.get("object") != "instagram":
        return jsonify({"status": "ignored"}), 200

    for entry in data.get("entry", []):
        ig_user_id = entry.get("id")
        for event in entry.get("messaging", []):
            _handle_messaging_event(ig_user_id, event)

    # Retorna 200 imediatamente — processamento pesado vai para a fila
    return jsonify({"status": "ok"}), 200


def _handle_messaging_event(ig_user_id: str, event: dict):
    """Salva a mensagem e enfileira para processamento."""
    sender_id = event.get("sender", {}).get("id")
    recipient_id = event.get("recipient", {}).get("id")
    message = event.get("message", {})
    text = message.get("text", "")
    mid = message.get("mid", "")

    # Ignora mensagens sem texto (por hora só suportamos texto no MVP)
    if not text or not sender_id:
        return

    # Ignora eco (mensagem enviada por nós mesmos)
    if sender_id == ig_user_id:
        return

    # Encontra a integração pelo ig_user_id (recipient)
    integration = _find_integration(ig_user_id or recipient_id)
    if not integration:
        logger.warning("Integração não encontrada para ig_user_id", extra={"ig_user_id": ig_user_id})
        return

    workspace_id = integration.workspace_id

    # Cria ou localiza o contato
    contact = Contact.query.filter_by(
        workspace_id=workspace_id,
        channel="instagram",
        external_id=sender_id,
    ).first()

    if not contact:
        contact = Contact(
            workspace_id=workspace_id,
            channel="instagram",
            external_id=sender_id,
            name=sender_id,  # será atualizado quando buscarmos o perfil
        )
        db.session.add(contact)
        db.session.flush()

    # Cria ou localiza a conversa
    conversation = Conversation.query.filter_by(
        workspace_id=workspace_id,
        contact_id=contact.id,
        channel="instagram",
    ).filter(Conversation.status != "closed").first()

    if not conversation:
        conversation = Conversation(
            workspace_id=workspace_id,
            contact_id=contact.id,
            channel="instagram",
            status="open",
        )
        db.session.add(conversation)
        db.session.flush()

    # Salva a mensagem
    msg = Message(
        conversation_id=conversation.id,
        direction="inbound",
        content=text,
        content_type="text",
        status="delivered",
        external_id=mid,
    )
    db.session.add(msg)
    conversation.last_message_at = datetime.now(timezone.utc)
    db.session.commit()

    logger.info("Mensagem Instagram salva", extra={
        "message_id": msg.id, "conversation_id": conversation.id
    })

    # Enfileira para processamento de IA
    try:
        rq_queue.enqueue(
            "app.tasks.process_message.run",
            msg.id,
            job_timeout=60,
        )
    except Exception as e:
        logger.error("Falha ao enfileirar mensagem", extra={"error": str(e)})


def _find_integration(ig_user_id: str) -> Integration | None:
    """Busca integração ativa pelo ig_user_id armazenado em meta."""
    integrations = Integration.query.filter_by(channel="instagram", status="active").all()
    for integ in integrations:
        if integ.meta and integ.meta.get("ig_user_id") == ig_user_id:
            return integ
    return None
