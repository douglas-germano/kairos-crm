"""
SocketIO event handlers — gerencia rooms por workspace para envio seletivo de eventos.

Eventos do cliente → servidor:
  join_workspace   { workspace_id, token }               — entra na sala do workspace
  leave_workspace  { workspace_id }                       — sai da sala
  typing           { workspace_id, conversation_id, token, is_typing } — indicador de digitação do operador
"""
import logging
from flask_socketio import join_room, leave_room
from flask_jwt_extended import decode_token
from app.extensions import socketio

logger = logging.getLogger(__name__)


def _authorized_user_id(workspace_id, token) -> int | None:
    """Decodifica o JWT e confirma que o usuário pertence ao workspace. Retorna None se inválido."""
    if not workspace_id or not token:
        return None
    try:
        decoded = decode_token(token)
        user_id = int(decoded.get("sub"))
    except Exception as exc:
        logger.warning("Token inválido em evento SocketIO", extra={"error": str(exc)})
        return None

    from app.models import WorkspaceMember
    member = WorkspaceMember.query.filter_by(user_id=user_id, workspace_id=workspace_id).first()
    if not member:
        logger.warning(
            "Tentativa de acesso não autorizado a workspace via SocketIO",
            extra={"user_id": user_id, "workspace_id": workspace_id},
        )
        return None
    return user_id


@socketio.on("join_workspace")
def on_join(data):
    workspace_id = data.get("workspace_id")
    token = data.get("token")
    user_id = _authorized_user_id(workspace_id, token)
    if not user_id:
        return

    room = f"workspace_{workspace_id}"
    join_room(room)
    logger.info("Cliente entrou na sala", extra={"user_id": user_id, "room": room})


@socketio.on("typing")
def on_typing(data):
    """Repassa o indicador de digitação de um operador aos demais membros do workspace."""
    workspace_id = data.get("workspace_id")
    token = data.get("token")
    conversation_id = data.get("conversation_id")
    user_id = _authorized_user_id(workspace_id, token)
    if not user_id or not conversation_id:
        return

    from app.extensions import db
    from app.models import User
    user = db.session.get(User, user_id)

    socketio.emit(
        "operator_typing",
        {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "user_name": user.name if user else None,
            "is_typing": bool(data.get("is_typing")),
        },
        room=f"workspace_{workspace_id}",
    )


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
