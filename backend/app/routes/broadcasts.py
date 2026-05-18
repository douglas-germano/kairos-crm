"""
Rotas REST para Broadcasts (disparos em massa via WhatsApp).

GET    /api/broadcasts              — lista todos os broadcasts do workspace
POST   /api/broadcasts              — cria novo broadcast com contatos selecionados
GET    /api/broadcasts/<id>         — detalhes + primeiros 50 destinatários
POST   /api/broadcasts/<id>/send    — enfileira o envio
DELETE /api/broadcasts/<id>         — exclui (somente draft ou completed/failed)
"""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db, rq_queue
from app.models import Contact, WorkspaceMember
from app.models.broadcast import Broadcast, BroadcastRecipient

logger = logging.getLogger(__name__)
bp = Blueprint("broadcasts", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id).first()
    return member.workspace_id if member else None


@bp.get("")
@jwt_required()
def list_broadcasts():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    broadcasts = (
        Broadcast.query.filter_by(workspace_id=workspace_id)
        .order_by(Broadcast.created_at.desc())
        .all()
    )
    return jsonify([b.to_dict() for b in broadcasts])


@bp.post("")
@jwt_required()
def create_broadcast():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    message = data.get("message", "").strip()
    contact_ids = data.get("contact_ids") or []

    if not name:
        return jsonify({"error": "name é obrigatório", "code": "MISSING_FIELD"}), 400
    if not message:
        return jsonify({"error": "message é obrigatório", "code": "MISSING_FIELD"}), 400
    if not contact_ids:
        return jsonify({"error": "Selecione ao menos um contato", "code": "MISSING_FIELD"}), 400

    contacts = Contact.query.filter(
        Contact.workspace_id == workspace_id,
        Contact.id.in_(contact_ids),
        Contact.channel == "whatsapp",
    ).all()

    if not contacts:
        return jsonify({"error": "Nenhum contato WhatsApp válido selecionado", "code": "NO_VALID_CONTACTS"}), 400

    broadcast = Broadcast(
        workspace_id=workspace_id,
        name=name,
        message=message,
        status="draft",
        total_count=len(contacts),
    )
    db.session.add(broadcast)
    db.session.flush()

    for contact in contacts:
        db.session.add(BroadcastRecipient(broadcast_id=broadcast.id, contact_id=contact.id))

    db.session.commit()
    logger.info("Broadcast criado | id=%s contacts=%s", broadcast.id, len(contacts))
    return jsonify(broadcast.to_dict()), 201


@bp.get("/<int:broadcast_id>")
@jwt_required()
def get_broadcast(broadcast_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    broadcast = Broadcast.query.filter_by(id=broadcast_id, workspace_id=workspace_id).first_or_404()
    result = broadcast.to_dict()
    result["recipients"] = [r.to_dict() for r in broadcast.recipients[:50]]
    return jsonify(result)


@bp.post("/<int:broadcast_id>/send")
@jwt_required()
def send_broadcast(broadcast_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    broadcast = Broadcast.query.filter_by(id=broadcast_id, workspace_id=workspace_id).first_or_404()

    if broadcast.status == "sending":
        return jsonify({"error": "Broadcast já está sendo processado", "code": "ALREADY_SENDING"}), 409
    if broadcast.status == "completed":
        return jsonify({"error": "Broadcast já foi enviado", "code": "ALREADY_COMPLETED"}), 409

    from app.tasks import send_broadcast as send_broadcast_task
    rq_queue.enqueue(send_broadcast_task.run, broadcast_id)

    logger.info("Broadcast enfileirado | id=%s", broadcast_id)
    return jsonify({"queued": True, "broadcast_id": broadcast_id})


@bp.delete("/<int:broadcast_id>")
@jwt_required()
def delete_broadcast(broadcast_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    broadcast = Broadcast.query.filter_by(id=broadcast_id, workspace_id=workspace_id).first_or_404()

    if broadcast.status == "sending":
        return jsonify({"error": "Não é possível excluir um broadcast em andamento", "code": "BROADCAST_SENDING"}), 409

    db.session.delete(broadcast)
    db.session.commit()
    return jsonify({"deleted": True, "broadcast_id": broadcast_id})
