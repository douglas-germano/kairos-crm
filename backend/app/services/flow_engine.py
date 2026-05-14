"""
Flow Engine — interpreta o JSON de nodes/edges de um Flow e executa
a automação quando um trigger é ativado.

Nodes suportados no MVP:
  - TriggerNode   : gatilho (first_message | keyword | schedule)
  - MessageNode   : envia mensagem de texto fixo
  - ConditionNode : if/else sobre o conteúdo da última mensagem
  - AINode        : gera resposta da IA com prompt customizado
  - WebhookNode   : chama URL externa via POST
"""
import logging
import requests
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class FlowEngine:
    def __init__(self, flow, conversation, last_message_text: str):
        """
        :param flow: objeto Flow (com .nodes e .edges)
        :param conversation: objeto Conversation
        :param last_message_text: texto da última mensagem inbound
        """
        self.flow = flow
        self.conversation = conversation
        self.last_message_text = last_message_text
        self._nodes_by_id = {n["id"]: n for n in (flow.nodes or [])}
        self._edges = flow.edges or []

    # ─── Public ───────────────────────────────────────────────────────────────

    def should_trigger(self) -> bool:
        """Verifica se o trigger do fluxo deve ser disparado para a mensagem atual."""
        trigger_node = self._find_trigger_node()
        if not trigger_node:
            return False

        trigger_type = self.flow.trigger_type or trigger_node.get("data", {}).get("trigger_type", "")
        config = self.flow.trigger_config or trigger_node.get("data", {}).get("config", {})

        if trigger_type == "first_message":
            # Dispara somente se for a primeira mensagem da conversa
            from app.models import Message
            count = self.conversation.messages.count()
            return count <= 1

        if trigger_type == "keyword":
            keywords = config.get("keywords", [])
            text_lower = self.last_message_text.lower()
            return any(kw.lower() in text_lower for kw in keywords)

        if trigger_type == "schedule":
            # Schedules são processados por um worker externo — aqui sempre False
            return False

        # Trigger desconhecido: não dispara
        return False

    def run(self):
        """Executa o fluxo a partir do TriggerNode."""
        trigger_node = self._find_trigger_node()
        if not trigger_node:
            logger.warning("Nenhum TriggerNode encontrado no fluxo", extra={"flow_id": self.flow.id})
            return

        next_ids = self._get_next_node_ids(trigger_node["id"])
        for node_id in next_ids:
            self._execute_node(node_id)

    # ─── Private ──────────────────────────────────────────────────────────────

    def _find_trigger_node(self):
        for node in (self.flow.nodes or []):
            if node.get("type") == "TriggerNode":
                return node
        return None

    def _get_next_node_ids(self, source_id: str, handle: str | None = None) -> list[str]:
        """Retorna IDs dos nós conectados a source_id (filtrando por handle se informado)."""
        targets = []
        for edge in self._edges:
            if edge.get("source") == source_id:
                if handle is None or edge.get("sourceHandle") == handle:
                    targets.append(edge["target"])
        return targets

    def _execute_node(self, node_id: str):
        node = self._nodes_by_id.get(node_id)
        if not node:
            return

        node_type = node.get("type")
        data = node.get("data", {})

        if node_type == "MessageNode":
            self._handle_message_node(data, node_id)
        elif node_type == "ConditionNode":
            self._handle_condition_node(data, node_id)
        elif node_type == "AINode":
            self._handle_ai_node(data, node_id)
        elif node_type == "WebhookNode":
            self._handle_webhook_node(data, node_id)
        else:
            logger.debug("Node type desconhecido: %s", node_type)

    def _handle_message_node(self, data: dict, node_id: str):
        text = data.get("message", "")
        if not text:
            return
        self._send_reply(text)
        for next_id in self._get_next_node_ids(node_id):
            self._execute_node(next_id)

    def _handle_condition_node(self, data: dict, node_id: str):
        """if/else sobre o conteúdo da última mensagem."""
        condition_type = data.get("condition_type", "contains")
        value = data.get("value", "")
        text_lower = self.last_message_text.lower()

        if condition_type == "contains":
            matched = value.lower() in text_lower
        elif condition_type == "equals":
            matched = text_lower.strip() == value.lower().strip()
        elif condition_type == "starts_with":
            matched = text_lower.startswith(value.lower())
        else:
            matched = False

        handle = "true" if matched else "false"
        for next_id in self._get_next_node_ids(node_id, handle=handle):
            self._execute_node(next_id)

    def _handle_ai_node(self, data: dict, node_id: str):
        """Aciona o agente de IA com prompt customizado para esse passo."""
        from app.services.ai_agent_service import get_active_agent_for_conversation, generate_reply
        from app.models import Agent

        agent = get_active_agent_for_conversation(self.conversation)
        if not agent:
            logger.warning("Nenhum agente ativo encontrado para AINode", extra={"node_id": node_id})
            return

        custom_prompt = data.get("system_prompt")
        if custom_prompt:
            # Usa o prompt customizado do node, mantendo os outros campos do agente
            original_prompt = agent.system_prompt
            agent.system_prompt = custom_prompt
            try:
                reply = generate_reply(agent, self.conversation)
            finally:
                agent.system_prompt = original_prompt
        else:
            reply = generate_reply(agent, self.conversation)

        if reply:
            self._send_reply(reply)

        for next_id in self._get_next_node_ids(node_id):
            self._execute_node(next_id)

    def _handle_webhook_node(self, data: dict, node_id: str):
        """Chama URL externa via POST com payload configurável."""
        url = data.get("url", "")
        payload = data.get("payload", {})
        if not url:
            logger.warning("WebhookNode sem URL configurada", extra={"node_id": node_id})
            return

        # Substitui variáveis básicas no payload
        payload_rendered = {
            k: str(v).replace("{{message}}", self.last_message_text)
            .replace("{{conversation_id}}", str(self.conversation.id))
            for k, v in payload.items()
        }

        try:
            resp = requests.post(url, json=payload_rendered, timeout=10)
            logger.info(
                "WebhookNode chamado",
                extra={"url": url, "status": resp.status_code, "node_id": node_id},
            )
        except requests.RequestException as exc:
            logger.error(
                "Falha ao chamar WebhookNode",
                extra={"url": url, "error": str(exc)},
            )

        for next_id in self._get_next_node_ids(node_id):
            self._execute_node(next_id)

    def _send_reply(self, text: str):
        """Envia resposta pelo canal correto e salva no banco."""
        from app.extensions import db, socketio
        from app.models import Message, Contact, Integration
        from app.services.whatsapp_service import get_whatsapp_service
        from app.services.instagram_service import get_instagram_service

        channel = self.conversation.channel
        contact: Contact = self.conversation.contact
        workspace_id = self.conversation.workspace_id

        integration = Integration.query.filter_by(
            workspace_id=workspace_id, channel=channel, status="active"
        ).first()

        if not integration:
            logger.warning("Integração não encontrada para envio de resposta", extra={"channel": channel})
            return

        try:
            if channel == "whatsapp":
                svc = get_whatsapp_service(integration)
                result = svc.send_text(contact.external_id, text)
                ext_id = result.get("key", {}).get("id") if isinstance(result, dict) else None
            elif channel == "instagram":
                svc = get_instagram_service(integration)
                result = svc.send_text(contact.external_id, text)
                ext_id = result.get("message_id") if isinstance(result, dict) else None
            else:
                logger.warning("Canal desconhecido: %s", channel)
                return
        except Exception as exc:
            logger.error("Falha ao enviar resposta pelo canal %s: %s", channel, str(exc))
            return

        # Salva mensagem outbound
        msg = Message(
            conversation_id=self.conversation.id,
            direction="outbound",
            content=text,
            content_type="text",
            status="sent",
            external_id=ext_id,
        )
        db.session.add(msg)
        self.conversation.last_message_at = datetime.now(timezone.utc)
        db.session.commit()

        # Emite evento SocketIO
        try:
            socketio.emit(
                "agent_response_sent",
                {"conversation_id": self.conversation.id, "message": msg.to_dict()},
                room=f"workspace_{workspace_id}",
            )
        except Exception:
            pass
