"""
Serviço de IA — chama a Claude API para gerar respostas da conversa.
Modelo: claude-sonnet-4-20250514
"""
import logging
import anthropic
from flask import current_app, g
from app.models import Agent, Conversation, Message

logger = logging.getLogger(__name__)

MAX_HISTORY = 20  # últimas mensagens incluídas no contexto


def _get_anthropic_client() -> anthropic.Anthropic:
    """Retorna um cliente Anthropic reutilizável dentro do contexto da requisição."""
    if not hasattr(g, "anthropic_client"):
        api_key = current_app.config.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY não configurado")
        g.anthropic_client = anthropic.Anthropic(api_key=api_key)
    return g.anthropic_client


def get_active_agent_for_conversation(conversation: Conversation) -> Agent | None:
    """
    Retorna o primeiro agente ativo do workspace que cobre o canal da conversa.
    """
    from app.extensions import db
    agents = (
        Agent.query.filter_by(workspace_id=conversation.workspace_id, enabled=True)
        .all()
    )
    channel = conversation.channel
    for agent in agents:
        channels = agent.channels or []
        if channel in channels:
            return agent
    return None


def build_messages(conversation: Conversation) -> list[dict]:
    """
    Monta a lista de mensagens no formato esperado pela API da Anthropic.
    Usa as últimas MAX_HISTORY mensagens da conversa.
    """
    messages = (
        conversation.messages
        .order_by(Message.created_at.desc())
        .limit(MAX_HISTORY)
        .all()[::-1]  # inverte para ordem cronológica
    )

    anthropic_messages = []
    for msg in messages:
        role = "user" if msg.direction == "inbound" else "assistant"
        anthropic_messages.append({"role": role, "content": msg.content})

    return anthropic_messages


def generate_reply(agent: Agent, conversation: Conversation) -> str:
    """
    Gera uma resposta da IA para a conversa informada.
    Retorna o texto gerado.
    """
    client = _get_anthropic_client()

    messages = build_messages(conversation)
    if not messages:
        logger.warning(
            "Conversa sem mensagens para gerar resposta",
            extra={"conversation_id": conversation.id},
        )
        return ""

    # Garante que o último turno seja do usuário
    if messages[-1]["role"] != "user":
        logger.debug("Último turno não é do usuário — sem resposta gerada")
        return ""

    try:
        response = client.messages.create(
            model=agent.model,
            max_tokens=1024,
            system=agent.system_prompt or "Você é um assistente prestativo.",
            messages=messages,
            temperature=agent.temperature,
        )
        reply_text = response.content[0].text if response.content else ""
        logger.info(
            "Resposta gerada pelo agente",
            extra={
                "agent_id": agent.id,
                "conversation_id": conversation.id,
                "tokens_used": response.usage.output_tokens,
            },
        )
        return reply_text
    except anthropic.APIError as exc:
        logger.error(
            "Erro na API da Anthropic",
            extra={"agent_id": agent.id, "error": str(exc)},
        )
        raise
