"""
SocketIO event handlers — gerencia rooms por workspace para envio seletivo de eventos.

Eventos do cliente → servidor:
  join_workspace   { workspace_id }  — entra na sala do workspace
  leave_workspace  { workspace_id }  — sai da sala
"""
import logging
from flask_socketio import join_room, leave_room
from flask_jwt_extended import decode_token
from app.extensions import socketio

logger = logging.getLogger(__name__)


@socketio.on("join_workspace")
def on_join(data):
    workspace_id = data.get("workspace_id")
    token = data.get("token")

    if not workspace_id or not token:
        return

    try:
        decoded = decode_token(token)
        user_id = int(decoded.get("sub"))
    except Exception as exc:
        logger.warning("Token inválido no join_workspace", extra={"error": str(exc)})
        return

    # Verifica que o usuário realmente pertence ao workspace solicitado
    from app.models import WorkspaceMember
    member = WorkspaceMember.query.filter_by(
        user_id=user_id, workspace_id=workspace_id
    ).first()
    if not member:
        logger.warning(
            "Tentativa de acesso não autorizado a workspace via SocketIO",
            extra={"user_id": user_id, "workspace_id": workspace_id},
        )
        return

    room = f"workspace_{workspace_id}"
    join_room(room)
    logger.info("Cliente entrou na sala", extra={"user_id": user_id, "room": room})


@socketio.on("leave_workspace")
def on_leave(data):
    workspace_id = data.get("workspace_id")
    if workspace_id:
        room = f"workspace_{workspace_id}"
        leave_room(room)
        logger.info("Cliente saiu da sala", extra={"room": room})


@socketio.on("connect")
def on_connect():
    logger.debug("Novo cliente SocketIO conectado")


@socketio.on("disconnect")
def on_disconnect():
    logger.debug("Cliente SocketIO desconectado")
