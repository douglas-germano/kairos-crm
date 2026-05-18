"""
Rotas REST para Contatos.

GET  /api/contacts          — lista com busca e paginação
POST /api/contacts          — cria contato individual
POST /api/contacts/import   — importação em massa via CSV
"""
import csv
import io
import logging
import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Contact, WorkspaceMember

logger = logging.getLogger(__name__)
bp = Blueprint("contacts", __name__)


def _get_workspace_id(user_id: int) -> int | None:
    member = WorkspaceMember.query.filter_by(user_id=user_id, role="owner").first()
    return member.workspace_id if member else None


def _normalize_phone(phone: str) -> str:
    return re.sub(r"[^\d]", "", phone)


@bp.get("")
@jwt_required()
def list_contacts():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    search = request.args.get("search", "").strip()
    channel = request.args.get("channel", "")
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 50)), 100)

    query = Contact.query.filter_by(workspace_id=workspace_id)
    if channel:
        query = query.filter_by(channel=channel)
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(Contact.name.ilike(like), Contact.external_id.ilike(like))
        )
    query = query.order_by(Contact.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "items": [c.to_dict() for c in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
    })


@bp.post("")
@jwt_required()
def create_contact():
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    data = request.get_json() or {}
    channel = data.get("channel", "whatsapp")
    external_id = _normalize_phone(data.get("external_id", "").strip()) if channel == "whatsapp" else data.get("external_id", "").strip()
    name = data.get("name", "").strip()

    if not external_id:
        return jsonify({"error": "external_id é obrigatório", "code": "MISSING_FIELD"}), 400

    existing = Contact.query.filter_by(
        workspace_id=workspace_id, channel=channel, external_id=external_id
    ).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    contact = Contact(
        workspace_id=workspace_id,
        channel=channel,
        external_id=external_id,
        name=name or external_id,
    )
    db.session.add(contact)
    db.session.commit()
    return jsonify(contact.to_dict()), 201


@bp.post("/import")
@jwt_required()
def import_contacts():
    """
    Importação em massa via CSV.

    Formato esperado (com cabeçalho):
      name,phone[,channel]

    - channel: whatsapp (padrão) | instagram
    - Linhas duplicadas (mesmo external_id + canal) são ignoradas.
    """
    user_id = int(get_jwt_identity())
    workspace_id = _get_workspace_id(user_id)
    if not workspace_id:
        return jsonify({"error": "Workspace não encontrado", "code": "NO_WORKSPACE"}), 404

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Arquivo CSV não enviado", "code": "MISSING_FILE"}), 400

    try:
        content = file.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        content = file.read().decode("latin-1")

    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        return jsonify({"error": "CSV vazio ou sem cabeçalho", "code": "INVALID_CSV"}), 400

    # Normaliza nomes de colunas (case-insensitive, sem espaços)
    fieldnames = [f.strip().lower() for f in reader.fieldnames]
    phone_col = next((f for f in fieldnames if f in ("phone", "telefone", "numero", "número", "whatsapp")), None)
    name_col = next((f for f in fieldnames if f in ("name", "nome")), None)
    channel_col = next((f for f in fieldnames if f in ("channel", "canal")), None)

    if not phone_col:
        return jsonify({"error": "Coluna 'phone' ou 'telefone' não encontrada", "code": "MISSING_COLUMN"}), 400

    imported = 0
    skipped = 0
    errors = []

    existing_ids = {
        (row[0], row[1])
        for row in db.session.query(Contact.channel, Contact.external_id)
        .filter_by(workspace_id=workspace_id)
        .all()
    }

    for i, row in enumerate(reader, start=2):
        # Re-mapeia usando fieldnames normalizados
        normalized_row = {k.strip().lower(): v for k, v in row.items()}

        raw_phone = normalized_row.get(phone_col, "").strip()
        name = normalized_row.get(name_col, "").strip() if name_col else ""
        channel = normalized_row.get(channel_col, "whatsapp").strip().lower() if channel_col else "whatsapp"

        if channel not in ("whatsapp", "instagram"):
            channel = "whatsapp"

        if channel == "whatsapp":
            ext_id = _normalize_phone(raw_phone)
            if len(ext_id) < 8:
                errors.append({"row": i, "reason": f"Número inválido: {raw_phone}"})
                continue
        else:
            ext_id = raw_phone
            if not ext_id:
                errors.append({"row": i, "reason": "external_id vazio"})
                continue

        if (channel, ext_id) in existing_ids:
            skipped += 1
            continue

        contact = Contact(
            workspace_id=workspace_id,
            channel=channel,
            external_id=ext_id,
            name=name or ext_id,
        )
        db.session.add(contact)
        existing_ids.add((channel, ext_id))
        imported += 1

    db.session.commit()

    logger.info(
        "Importação de contatos concluída | imported=%s skipped=%s errors=%s",
        imported, skipped, len(errors),
    )
    return jsonify({"imported": imported, "skipped": skipped, "errors": errors})
