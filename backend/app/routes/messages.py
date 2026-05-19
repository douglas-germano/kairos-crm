"""
Rotas REST para Mensagens.

GET  /api/messages/<conversation_id>        — histórico paginado de uma conversa
POST /api/messages/<conversation_id>        — envia mensagem outbound manualmente
POST /api/messages/<conversation_id>/sync   — sincroniza histórico do WhatsApp
"""
import logging
import traceback
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from app.extensions import db, socketio
from app.models import Conversation, Message, Integration, WorkspaceMember
from app.services.whatsapp_identity import remote_jids_for_contact

logger = logging.getLogger(__name__)
bp = Blueprint("messages", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id).first()
    return member.workspace_id if member else None


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

    # Paginação scroll infinito — cursor pela posição cronológica da mensagem.
    before_id = request.args.get("before_id", type=int)
    limit = min(int(request.args.get("limit", 50)), 100)

    query = Message.query.filter_by(conversation_id=conv.id)
    if before_id:
        cursor_message = Message.query.filter_by(
            id=before_id,
            conversation_id=conv.id,
        ).first()
        if cursor_message:
            query = query.filter(
                db.or_(
                    Message.created_at < cursor_message.created_at,
                    db.and_(
                        Message.created_at == cursor_message.created_at,
                        Message.id < cursor_message.id,
                    ),
                )
            )
    query = query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit)

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
    conv.last_message_at = datetime.utcnow()
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
    else:
        logger.warning("Mensagem não enviada — sem integração ativa | channel=%s conv=%s", channel, conv.id)
        msg.status = "failed"
        db.session.commit()

    # Emite evento real-time
    try:
        socketio.emit(
            "new_message",
            {"conversation_id": conv.id, "message": msg.to_dict()},
            room=f"workspace_{workspace_id}",
        )
    except Exception as exc:
        logger.warning("Falha ao emitir evento SocketIO new_message | conv=%s error=%s", conv.id, exc)

    return jsonify(msg.to_dict()), 201


# ── Helpers para parsear mensagens da Evolution API ────────────────────────────

def _extract_content(msg_obj: dict, instance_name: str | None = None) -> tuple[str, str]:
    """
    Extrai (content, content_type) de um objeto de mensagem da Evolution API.
    Retorna ("", "text") se não reconhecer o tipo.
    """
    m = msg_obj.get("message") or {}

    if text := (m.get("conversation") or (m.get("extendedTextMessage") or {}).get("text", "")):
        return text, "text"
    if img := m.get("imageMessage"):
        return _extract_media_content(msg_obj, img, "image", "[imagem]", instance_name)
    if sticker := m.get("stickerMessage"):
        return _extract_media_content(msg_obj, sticker, "sticker", "[figurinha]", instance_name)
    if aud := (m.get("audioMessage") or m.get("pttMessage")):
        return _extract_media_content(msg_obj, aud, "audio", "[áudio]", instance_name)
    if vid := m.get("videoMessage"):
        return _extract_media_content(msg_obj, vid, "video", "[vídeo]", instance_name)
    if doc := m.get("documentMessage"):
        return _extract_media_content(msg_obj, doc, "template", "[documento]", instance_name)

    return "", "text"


def _extract_media_content(
    raw_msg: dict,
    media_obj: dict,
    content_type: str,
    placeholder: str,
    instance_name: str | None = None,
) -> tuple[str, str]:
    content = (
        media_obj.get("base64")
        or media_obj.get("url")
        or media_obj.get("mediaUrl")
        or ""
    )
    if content:
        return _media_data_url(content, media_obj.get("mimetype") or media_obj.get("mimeType"), content_type), content_type

    if instance_name:
        try:
            from app.services import evolution as evo_svc
            media = evo_svc.get_media_base64(instance_name, raw_msg)
            if media.get("base64"):
                return _media_data_url(media["base64"], media.get("mimetype") or media_obj.get("mimetype"), content_type), content_type
        except Exception as exc:
            logger.warning(
                "Falha ao baixar mídia Evolution | ext_id=%s error=%s",
                (raw_msg.get("key") or {}).get("id"),
                exc,
            )

    caption = media_obj.get("caption") or media_obj.get("title") or ""
    return caption or placeholder, content_type


def _media_data_url(content: str, mimetype: str | None = None, content_type: str | None = None) -> str:
    if not content or content.startswith(("http://", "https://", "data:")):
        return content
    fallback_mime = {
        "image": "image/jpeg",
        "sticker": "image/webp",
        "audio": "audio/ogg",
        "video": "video/mp4",
        "template": "application/octet-stream",
    }.get(content_type or "", "application/octet-stream")
    return f"data:{mimetype or fallback_mime};base64,{content}"


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

        remote_jids = remote_jids_for_contact(conv.contact)
        instance_name = f"kairos-crm-{user_id}"

        logger.debug("Buscando mensagens | instance=%s jids=%s", instance_name, remote_jids)

        raw_msgs: list[dict] = []
        sync_errors: list[dict] = []
        seen_raw_ids: set[str] = set()
        for remote_jid in remote_jids:
            try:
                jid_messages = evo_svc.find_messages(instance_name, remote_jid, limit=200)
            except EvolutionError as exc:
                sync_errors.append({"jid": remote_jid, "error": str(exc)})
                logger.error("Falha ao buscar histórico Evolution API | jid=%s error=%s", remote_jid, str(exc))
                continue

            for raw in jid_messages:
                ext_id = (raw.get("key") or {}).get("id")
                dedupe_key = ext_id or f"{remote_jid}:{raw.get('messageTimestamp')}:{len(raw_msgs)}"
                if dedupe_key in seen_raw_ids:
                    continue
                seen_raw_ids.add(dedupe_key)
                raw_msgs.append(raw)

        if not raw_msgs and sync_errors:
            _update_integration_health(
                integration,
                last_sync_at=datetime.utcnow().isoformat(),
                last_sync_status="error",
                last_sync_errors=sync_errors,
                last_sync_jids=remote_jids,
            )
            db.session.commit()
            return jsonify({"error": sync_errors[0]["error"], "code": "EVOLUTION_ERROR", "details": sync_errors}), 502

        logger.debug("Evolution retornou %s mensagens | conv=%s", len(raw_msgs), conv.id)

        # Mensagens já existentes no banco para esta conversa (evita duplicatas
        # e permite preencher mídias que antes foram salvas como placeholder).
        existing_messages = {
            msg.external_id: msg
            for msg in Message.query
            .filter(Message.conversation_id == conv.id, Message.external_id.isnot(None))
            .all()
        }
        existing_ids = set(existing_messages)

        inserted = 0
        updated_media = 0
        for raw in raw_msgs:
            key = raw.get("key") or {}
            ext_id = key.get("id")
            if not ext_id:
                continue

            existing_msg = existing_messages.get(ext_id)
            if existing_msg:
                if _should_refresh_media(existing_msg):
                    content, content_type = _extract_content(raw, instance_name)
                    if content and not _is_placeholder(content):
                        existing_msg.content = content
                        existing_msg.content_type = content_type
                        updated_media += 1
                continue

            content, content_type = _extract_content(raw, instance_name)
            if not content:
                continue

            direction = "outbound" if key.get("fromMe") else "inbound"
            ts = raw.get("messageTimestamp")
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
            try:
                with db.session.begin_nested():
                    db.session.add(msg)
                existing_ids.add(ext_id)
                existing_messages[ext_id] = msg
                inserted += 1
            except IntegrityError:
                logger.warning("Mensagem duplicada ignorada no sync | ext_id=%s conv=%s", ext_id, conv.id)

        conv.synced_at = datetime.utcnow()
        conv.last_message_at = (
            db.session.query(db.func.max(Message.created_at))
            .filter(Message.conversation_id == conv.id)
            .scalar()
            or conv.last_message_at
        )
        _update_integration_health(
            integration,
            last_sync_at=datetime.utcnow().isoformat(),
            last_sync_status="partial" if sync_errors else "ok",
            last_sync_inserted=inserted,
            last_sync_media_updated=updated_media,
            last_sync_total=len(raw_msgs),
            last_sync_jids=remote_jids,
            last_sync_errors=sync_errors,
        )
        db.session.commit()

        logger.info(
            "Histórico WhatsApp sincronizado | conversation=%s inserted=%s total=%s",
            conv.id, inserted, len(raw_msgs),
        )
        return jsonify({
            "synced": inserted,
            "media_updated": updated_media,
            "total": len(raw_msgs),
            "jids": remote_jids,
            "errors": sync_errors,
        })

    except Exception as exc:
        db.session.rollback()
        tb = traceback.format_exc()
        logger.error("Erro inesperado no sync | conversation=%s error=%s trace=%s", conversation_id, str(exc), tb)
        return jsonify({"error": "Erro interno ao sincronizar", "code": "INTERNAL_ERROR"}), 500


def _update_integration_health(integration: Integration, **fields):
    meta = dict(integration.meta or {})
    health = dict(meta.get("health") or {})
    health.update(fields)
    meta["health"] = health
    integration.meta = meta


def _is_placeholder(content: str) -> bool:
    return bool(content) and content.startswith("[") and content.endswith("]")


def _should_refresh_media(message: Message) -> bool:
    return message.content_type in {"image", "sticker", "audio", "video", "template"} and (
        not message.content
        or _is_placeholder(message.content)
        or not message.content.startswith(("http://", "https://", "data:"))
    )
