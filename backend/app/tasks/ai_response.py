"""
Task de geração de resposta da IA (pode ser enfileirada separadamente
quando se quer apenas a etapa de IA sem o pipeline completo).
"""
import logging

logger = logging.getLogger(__name__)


def run(conversation_id: int):
    """Gera e envia a resposta da IA para a conversa informada."""
    from app import create_app
    from app.extensions import db
    from app.models import Conversation
    from app.services.ai_agent_service import get_active_agent_for_conversation

    app = create_app()
    with app.app_context():
        conversation: Conversation = db.session.get(Conversation, conversation_id)
        if not conversation:
            logger.warning("Conversa não encontrada", extra={"conversation_id": conversation_id})
            return

        if not conversation.ai_enabled:
            logger.debug("ai_enabled=False, ignorando", extra={"conversation_id": conversation_id})
            return

        agent = get_active_agent_for_conversation(conversation)
        if not agent:
            logger.info("Nenhum agente ativo para o canal", extra={"channel": conversation.channel})
            return

        # Reutiliza o helper do process_message
        from app.tasks.process_message import _process_ai_reply
        _process_ai_reply(agent, conversation, conversation.workspace_id, db, None)
