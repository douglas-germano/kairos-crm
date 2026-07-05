"""
Task principal de processamento de mensagens inbound.

Fluxo:
  1. Carrega a mensagem e a conversa do banco
  2. Emite evento SocketIO `new_message` para o frontend
  3. Verifica se ai_enabled = True e existe agente ativo para o canal
  4. Se sim: gera resposta da IA, envia via canal, salva outbound, emite `agent_response_sent`
  5. Se fluxo ativo: executa o flow engine
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def run(message_id: int):
    """Entry point chamado pelo RQ worker."""
    # Imports dentro da função para garantir app context no worker
    from app import create_app
    from app.extensions import db, socketio
    from app.models import Message, Conversation
    from app.services.ai_agent_service import get_active_agent_for_conversation, generate_reply
    from app.services.flow_engine import FlowEngine

    app = create_app()
    with app.app_context():
        msg: Message = db.session.get(Message, message_id)
        if not msg:
            logger.warning("Mensagem não encontrada", extra={"message_id": message_id})
            return

        conversation: Conversation = db.session.get(Conversation, msg.conversation_id)
        if not conversation:
            logger.warning("Conversa não encontrada", extra={"conversation_id": msg.conversation_id})
            return

        workspace_id = conversation.workspace_id
        # new_message já foi emitido de forma síncrona pelo webhook (whatsapp.py /
        # instagram.py) ao salvar a mensagem — não reemitir aqui.

        # ── 2. Verifica flows ativos ──────────────────────────────────────────
        from app.models import Flow, Agent
        active_flows_run = False
        agents_in_ws = Agent.query.filter_by(workspace_id=workspace_id, enabled=True).all()
        for agent in agents_in_ws:
            if conversation.channel not in (agent.channels or []):
                continue
            flows = agent.flows.filter_by(active=True).all()
            for flow in flows:
                engine = FlowEngine(flow, conversation, msg.content)
                if engine.should_trigger():
                    logger.info(
                        "Flow disparado",
                        extra={"flow_id": flow.id, "message_id": message_id},
                    )
                    engine.run()
                    active_flows_run = True
                    break  # apenas um flow por agente por mensagem no MVP
            if active_flows_run:
                break

        # ── 3. IA direta (sem flow) ───────────────────────────────────────────
        if not active_flows_run and conversation.ai_enabled:
            agent = get_active_agent_for_conversation(conversation)
            if agent:
                _process_ai_reply(agent, conversation, workspace_id, db, socketio)
            else:
                logger.info(
                    "ai_enabled=True mas nenhum agente ativo para o canal",
                    extra={"conversation_id": conversation.id, "channel": conversation.channel},
                )


def _emit_agent_typing(socketio, workspace_id: int, conversation_id: int, is_typing: bool):
    try:
        socketio.emit(
            "agent_typing",
            {"conversation_id": conversation_id, "is_typing": is_typing},
            room=f"workspace_{workspace_id}",
        )
    except Exception:
        pass


def _process_ai_reply(agent, conversation, workspace_id: int, db, socketio):
    """Gera e envia resposta da IA, salva no banco e emite evento SocketIO."""
    from app.services.ai_agent_service import generate_reply
    from app.services.whatsapp_service import get_whatsapp_service
    from app.services.instagram_service import get_instagram_service
    from app.models import Message, Integration

    _emit_agent_typing(socketio, workspace_id, conversation.id, True)
    try:
        reply_text = generate_reply(agent, conversation)
    except Exception as exc:
        logger.error(
            "Falha ao gerar resposta da IA",
            extra={"agent_id": agent.id, "conversation_id": conversation.id, "error": str(exc)},
        )
        return
    finally:
        _emit_agent_typing(socketio, workspace_id, conversation.id, False)

    if not reply_text:
        return

    # Envia pelo canal correto
    channel = conversation.channel
    contact = conversation.contact
    integration = Integration.query.filter_by(
        workspace_id=workspace_id, channel=channel, status="active"
    ).first()

    ext_id = None
    if integration:
        try:
            if channel == "whatsapp":
                svc = get_whatsapp_service(integration)
                result = svc.send_text(contact.external_id, reply_text)
                ext_id = result.get("key", {}).get("id") if isinstance(result, dict) else None
            elif channel == "instagram":
                svc = get_instagram_service(integration)
                result = svc.send_text(contact.external_id, reply_text)
                ext_id = result.get("message_id") if isinstance(result, dict) else None
        except Exception as exc:
            logger.error(
                "Falha ao enviar resposta da IA via canal",
                extra={"channel": channel, "error": str(exc)},
            )

    # Salva mensagem outbound
    out_msg = Message(
        conversation_id=conversation.id,
        direction="outbound",
        content=reply_text,
        content_type="text",
        status="sent",
        external_id=ext_id,
    )
    db.session.add(out_msg)
    conversation.last_message_at = datetime.now(timezone.utc)
    db.session.commit()

    logger.info(
        "Resposta da IA enviada",
        extra={"message_id": out_msg.id, "conversation_id": conversation.id},
    )

    # Emite evento SocketIO
    try:
        socketio.emit(
            "agent_response_sent",
            {"conversation_id": conversation.id, "message": out_msg.to_dict()},
            room=f"workspace_{workspace_id}",
        )
    except Exception:
        pass
