"""
Queue helpers — thin wrappers para enfileirar tasks no RQ.
"""
import logging
from app.extensions import rq_queue

logger = logging.getLogger(__name__)


def enqueue_process_message(message_id: int) -> None:
    """Enfileira a task de processamento de mensagem inbound."""
    try:
        job = rq_queue.enqueue(
            "app.tasks.process_message.run",
            message_id,
            job_timeout=60,
        )
        logger.debug("Mensagem enfileirada", extra={"message_id": message_id, "job_id": job.id})
    except Exception as exc:
        logger.error("Falha ao enfileirar mensagem", extra={"message_id": message_id, "error": str(exc)})
        raise
