"""
Rotas REST para Mensagens.

GET  /api/messages/<conversation_id>        — histórico paginado de uma conversa
POST /api/messages/<conversation_id>        — envia mensagem outbound manualmente
POST /api/messages/<conversation_id>/sync   — sincroniza histórico do WhatsApp
"""
import logging
import traceback
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db, socketio
from app.models import Conversation, Message, Integration, WorkspaceMember

logger = logging.getLogger(__name__)
bp = Blueprint("messages", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    return member.workspace_id if member else None


def _remote_jid_for_contact(external_id: str) -> str:
    """Preserva JIDs já vindos da Evolution, como @lid, e completa números manuais."""
    external_id = (external_id or "").strip()
    if "@" in external_id:
        return external_id
    return f"{external_id}@s.whatsapp.net"


@bp.get("/<int:conversation_id>")
@jwt_required()
def list_messages(conversation_id: int):
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    # Paginação scroll infinito — cursor-based (before_id)
    before_id = request.args.get("before_id", type=int)
    limit = min(int(request.args.get("limit", 50)), 100)

    query = Message.query.filter_by(conversation_id=conv.id)
    if before_id:
        query = query.filter(Message.id < before_id)
    query = query.order_by(Message.id.desc()).limit(limit)

    messages = list(reversed(query.all()))
    return jsonify([m.to_dict() for m in messages])


@bp.post("/<int:conversation_id>")
@jwt_required()
def send_message(conversation_id: int):
    """Envio manual de mensagem outbound pelo operador humano."""
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    content = data.get("content", "").strip()
    content_type = data.get("content_type", "text")
    if not content:
        return jsonify({"error": "content é obrigatório", "code": "MISSING_CONTENT"}), 400

    conv = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first_or_404()

    channel = conv.channel
    contact = conv.contact
    integration = Integration.query.filter_by(
        workspace_id=workspace_id, channel=channel, status="active"
    ).first()

    # Salva a mensagem antes de enviar — o operador vê o que digitou independente do resultado
    msg = Message(
        conversation_id=conv.id,
        direction="outbound",
        content=content,
        content_type=content_type,
        status="sent",
        external_id=None,
    )
    db.session.add(msg)
    conv.last_message_at = datetime.now(timezone.utc)
    db.session.commit()

    # Tenta enviar pelo canal — falhas não removem a mensagem do banco
    if integration:
        try:
            if channel == "whatsapp":
                from app.services.whatsapp_service import get_whatsapp_service
                svc = get_whatsapp_service(integration)
                if content_type == "audio":
                    result = svc.send_audio(contact.external_id, content)
                else:
                    result = svc.send_text(contact.external_id, content)
                ext_id = result.get("key", {}).get("id") if isinstance(result, dict) else None
                msg.external_id = ext_id
            elif channel == "instagram":
                from app.services.instagram_service import get_instagram_service
                svc = get_instagram_service(integration)
                result = svc.send_text(contact.external_id, content)
                ext_id = result.get("message_id") if isinstance(result, dict) else None
                msg.external_id = ext_id
            db.session.commit()
        except Exception as exc:
            logger.error("Falha ao enviar mensagem pelo canal | channel=%s error=%s", channel, str(exc))
            msg.status = "failed"
            db.session.commit()

    # Emite evento real-time
    try:
        socketio.emit(
            "new_message",
            {"conversation_id": conv.id, "message": msg.to_dict()},
            room=f"workspace_{workspace_id}",
        )
    except Exception:
        pass

    return jsonify(msg.to_dict()), 201


# ── Helpers para parsear mensagens da Evolution API ────────────────────────────

def _extract_content(msg_obj: dict) -> tuple[str, str]:
    """
    Extrai (content, content_type) de um objeto de mensagem da Evolution API.
    Retorna ("", "text") se não reconhecer o tipo.
    """
    m = msg_obj.get("message") or {}

    if text := (m.get("conversation") or (m.get("extendedTextMessage") or {}).get("text", "")):
        return text, "text"
    if img := m.get("imageMessage"):
        return img.get("url") or img.get("caption") or "[imagem]", "image"
    if aud := (m.get("audioMessage") or m.get("pttMessage")):
        return aud.get("url") or "[áudio]", "audio"
    if vid := m.get("videoMessage"):
        return vid.get("url") or vid.get("caption") or "[vídeo]", "video"
    if doc := m.get("documentMessage"):
        return doc.get("url") or doc.get("title") or "[documento]", "template"

    return "", "text"


@bp.post("/<int:conversation_id>/sync")
@jwt_required()
def sync_messages(conversation_id: int):
    """
    Sincroniza o histórico de mensagens WhatsApp via Evolution API.
    Insere apenas mensagens que ainda não existem no banco (dedup por external_id).
    """
    from app.services import evolution as evo_svc
    from app.services.evolution import EvolutionError

    try:
        user_id = int(get_jwt_identity())
        workspace_id = _get_workspace_id(user_id)
        if not workspace_id:
            return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

        conv = Conversation.query.filter_by(
            id=conversation_id, workspace_id=workspace_id
        ).first_or_404()

        if conv.channel != "whatsapp":
            return jsonify({"error": "Sync disponível apenas para WhatsApp", "code": "UNSUPPORTED_CHANNEL"}), 400

        integration = Integration.query.filter_by(
            workspace_id=workspace_id, channel="whatsapp", status="active"
        ).first()
        if not integration:
            return jsonify({"error": "Nenhuma integração WhatsApp ativa", "code": "NO_INTEGRATION"}), 400

        remote_jid = _remote_jid_for_contact(conv.contact.external_id)
        instance_name = f"kairos-crm-{user_id}"

        print(f"[sync] Buscando mensagens instance={instance_name} jid={remote_jid}", flush=True)

        try:
            raw_msgs = evo_svc.find_messages(instance_name, remote_jid, limit=200)
        except EvolutionError as exc:
            logger.error("Falha ao buscar histórico Evolution API | error=%s", str(exc))
            return jsonify({"error": str(exc), "code": "EVOLUTION_ERROR"}), 502

        first_sample = raw_msgs[0] if raw_msgs else "none"
        print(f"[sync] Evolution retornou {len(raw_msgs)} mensagens | first={first_sample}", flush=True)

        # IDs já existentes no banco para esta conversa (evita duplicatas)
        existing_ids = {
            row[0]
            for row in db.session.query(Message.external_id)
            .filter(Message.conversation_id == conv.id, Message.external_id.isnot(None))
            .all()
        }

        inserted = 0
        for raw in raw_msgs:
            key = raw.get("key") or {}
            ext_id = key.get("id")
            if not ext_id or ext_id in existing_ids:
                continue

            content, content_type = _extract_content(raw)
            if not content:
                continue

            direction = "outbound" if key.get("fromMe") else "inbound"
            ts = raw.get("messageTimestamp")
            # Use naive UTC datetimes — PostgreSQL column is TIMESTAMP WITHOUT TIME ZONE
            created_at = datetime.utcfromtimestamp(int(ts)) if ts else datetime.utcnow()

            msg = Message(
                conversation_id=conv.id,
                direction=direction,
                content=content,
                content_type=content_type,
                status="read" if direction == "inbound" else "delivered",
                external_id=ext_id,
                created_at=created_at,
            )
            db.session.add(msg)
            existing_ids.add(ext_id)
            inserted += 1

        conv.synced_at = datetime.utcnow()
        db.session.commit()

        print(f"[sync] Commit OK inserted={inserted}", flush=True)
        logger.info(
            "Histórico WhatsApp sincronizado | conversation=%s inserted=%s total=%s",
            conv.id, inserted, len(raw_msgs),
        )
        return jsonify({"synced": inserted, "total": len(raw_msgs)})

    except Exception as exc:
        db.session.rollback()
        tb = traceback.format_exc()
        print(f"[sync] ERRO INESPERADO: {exc}\n{tb}", flush=True)
        logger.error("Erro inesperado no sync | conversation=%s error=%s trace=%s", conversation_id, str(exc), tb)
        return jsonify({"error": "Erro interno ao sincronizar", "code": "INTERNAL_ERROR"}), 500
