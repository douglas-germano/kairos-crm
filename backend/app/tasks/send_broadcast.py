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
    from app.models import Integration
    from app.models.broadcast import Broadcast, BroadcastRecipient
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

        integration = Integration.query.filter_by(
            workspace_id=broadcast.workspace_id,
            channel="whatsapp",
            status="active",
        ).first()

        if not integration:
            broadcast.status = "failed"
            db.session.commit()
            logger.error("Nenhuma integração WhatsApp ativa para o broadcast | id=%s", broadcast_id)
            return

        svc = get_whatsapp_service(integration)

        recipients = BroadcastRecipient.query.filter_by(
            broadcast_id=broadcast_id,
            status="pending",
        ).all()

        for recipient in recipients:
            contact = recipient.contact
            try:
                svc.send_text(contact.external_id, broadcast.message)
                recipient.status = "sent"
                recipient.sent_at = datetime.now(timezone.utc)
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
