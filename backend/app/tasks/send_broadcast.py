"""
Task RQ para envio de broadcasts em massa via WhatsApp.

Processa os destinatários sequencialmente com delay entre envios
para evitar bloqueio por rate limiting da Evolution API.
"""
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

SEND_DELAY_SECONDS = 1.2


def run(broadcast_id: int):
    """Entry point chamado pelo RQ worker."""
    from app import create_app
    from app.extensions import db, socketio
    from app.models.broadcast import Broadcast, BroadcastRecipient
    from app.services.channel_routing import resolve_channel_integration
    from app.services.whatsapp_service import get_whatsapp_service

    app = create_app()
    with app.app_context():
        broadcast = db.session.get(Broadcast, broadcast_id)
        if not broadcast:
            logger.warning("Broadcast não encontrado", extra={"broadcast_id": broadcast_id})
            return

        if broadcast.status == "sending":
            logger.warning("Broadcast já está sendo enviado", extra={"broadcast_id": broadcast_id})
            return

        broadcast.status = "sending"
        broadcast.started_at = datetime.now(timezone.utc)
        broadcast.sent_count = 0
        broadcast.failed_count = 0
        db.session.commit()

        if not resolve_channel_integration(broadcast.workspace_id, "whatsapp"):
            broadcast.status = "failed"
            db.session.commit()
            logger.error("Nenhuma integração WhatsApp ativa para o broadcast | id=%s", broadcast_id)
            return

        # Um workspace pode ter mais de um número WhatsApp ativo — cada destinatário é
        # enviado pela conexão de onde o contato foi visto por último (resolve_channel_integration
        # já cai para a primeira integração ativa quando o contato não aponta pra nenhuma,
        # cobrindo workspaces de conexão única e contatos migrados antes dessa coluna existir).
        services_by_integration: dict[int, object] = {}

        def _service_for(contact) -> object:
            integration = resolve_channel_integration(broadcast.workspace_id, "whatsapp", contact=contact)
            if integration.id not in services_by_integration:
                services_by_integration[integration.id] = get_whatsapp_service(integration)
            return services_by_integration[integration.id]

        recipients = BroadcastRecipient.query.filter_by(
            broadcast_id=broadcast_id,
            status="pending",
        ).all()

        for recipient in recipients:
            contact = recipient.contact
            try:
                svc = _service_for(contact)
                result = svc.send_text(contact.external_id, broadcast.message)
                recipient.status = "sent"
                recipient.sent_at = datetime.now(timezone.utc)
                # Guarda o ID da mensagem para rastrear confirmações de entrega/leitura
                ext_id = (result or {}).get("key", {}).get("id")
                if ext_id:
                    recipient.message_external_id = ext_id
                broadcast.sent_count += 1
            except Exception as exc:
                recipient.status = "failed"
                recipient.error_message = str(exc)[:500]
                broadcast.failed_count += 1
                logger.error(
                    "Falha ao enviar broadcast | id=%s contact=%s error=%s",
                    broadcast_id, contact.external_id, exc,
                )
            db.session.commit()
            time.sleep(SEND_DELAY_SECONDS)

        broadcast.status = "completed"
        broadcast.completed_at = datetime.now(timezone.utc)
        db.session.commit()

        try:
            socketio.emit(
                "broadcast_completed",
                {
                    "broadcast_id": broadcast_id,
                    "sent": broadcast.sent_count,
                    "failed": broadcast.failed_count,
                },
                room=f"workspace_{broadcast.workspace_id}",
            )
        except Exception:
            pass

        logger.info(
            "Broadcast concluído | id=%s sent=%s failed=%s",
            broadcast_id, broadcast.sent_count, broadcast.failed_count,
        )
