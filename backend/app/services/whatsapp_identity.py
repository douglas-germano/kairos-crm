"""
Normalização de identidade WhatsApp para payloads da Evolution API.

A Evolution pode alternar entre JIDs telefônicos (`@s.whatsapp.net`) e LID
(`@lid`) para o mesmo contato. Estes helpers mantêm aliases conhecidos no
metadata do contato para que webhook e sync encontrem a mesma conversa.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Iterable


def normalize_phone(value: str | None) -> str:
    """Retorna apenas dígitos de um telefone/JID telefônico."""
    return re.sub(r"[^\d]", "", value or "")


def normalize_jid(value: str | None) -> str:
    """Normaliza JIDs preservando o identificador técnico da Evolution."""
    return (value or "").strip().lower()


def phone_from_jid(value: str | None) -> str:
    """Extrai telefone quando o identificador contém um número."""
    jid = normalize_jid(value)
    if jid.endswith("@s.whatsapp.net"):
        return normalize_phone(jid.removesuffix("@s.whatsapp.net"))
    return normalize_phone(jid)


def canonical_external_id(remote_jid: str | None, sender_pn: str | None = None) -> str:
    """
    Escolhe o identificador principal do contato.

    - `@lid` é preservado porque costuma ser o identificador real do chat.
    - `@g.us` é preservado para não misturar grupos com telefones.
    - `@s.whatsapp.net` vira telefone puro para manter compatibilidade com
      contatos criados manualmente.
    - se o remote_jid não for útil, usa senderPn como fallback.
    """
    jid = normalize_jid(remote_jid)
    if jid.endswith("@lid") or jid.endswith("@g.us"):
        return jid
    phone = phone_from_jid(jid)
    if phone:
        return phone
    sender_phone = phone_from_jid(sender_pn)
    if sender_phone:
        return sender_phone
    return jid


def lookup_external_ids(remote_jid: str | None, sender_pn: str | None = None) -> list[str]:
    """IDs que podem representar o mesmo contato no banco."""
    ids = [
        canonical_external_id(remote_jid, sender_pn),
        normalize_jid(remote_jid),
        phone_from_jid(remote_jid),
        phone_from_jid(sender_pn),
    ]
    return _unique(value for value in ids if value)


def remote_jids_for_contact(contact) -> list[str]:
    """Monta os JIDs que devem ser tentados no sync de histórico."""
    meta = contact.metadata_ or {}
    whatsapp = meta.get("whatsapp") or {}
    values: list[str] = []

    external_id = normalize_jid(contact.external_id)
    if external_id:
        values.append(_as_remote_jid(external_id))

    for jid in whatsapp.get("jids") or []:
        values.append(_as_remote_jid(jid))

    for phone in whatsapp.get("phones") or []:
        phone = normalize_phone(phone)
        if phone:
            values.append(f"{phone}@s.whatsapp.net")

    last_remote_jid = whatsapp.get("last_remote_jid")
    if last_remote_jid:
        values.append(_as_remote_jid(last_remote_jid))

    return _unique(value for value in values if value)


def contact_has_phone(contact, phone: str) -> bool:
    """Confere se um contato já é conhecido por este telefone."""
    normalized = normalize_phone(phone)
    if not normalized:
        return False
    if phone_from_jid(contact.external_id) == normalized:
        return True
    meta = contact.metadata_ or {}
    whatsapp = meta.get("whatsapp") or {}
    return normalized in {normalize_phone(value) for value in whatsapp.get("phones") or []}


def remember_contact_identity(contact, remote_jid: str | None, sender_pn: str | None = None, push_name: str | None = None):
    """Grava aliases WhatsApp conhecidos em Contact.metadata_."""
    meta = dict(contact.metadata_ or {})
    whatsapp = dict(meta.get("whatsapp") or {})
    jids = list(whatsapp.get("jids") or [])
    phones = list(whatsapp.get("phones") or [])

    remote = normalize_jid(remote_jid)
    sender = normalize_jid(sender_pn)

    if remote and "@" in remote:
        _append_unique(jids, remote)
        whatsapp["last_remote_jid"] = remote

    for value in (remote, sender):
        phone = phone_from_jid(value)
        if phone:
            _append_unique(phones, phone)

    if sender and "@" in sender:
        _append_unique(jids, sender)
        whatsapp["last_sender_pn"] = sender

    if push_name:
        whatsapp["last_push_name"] = push_name

    whatsapp["last_seen_at"] = datetime.now(timezone.utc).isoformat()
    whatsapp["jids"] = jids
    whatsapp["phones"] = phones
    meta["whatsapp"] = whatsapp
    contact.metadata_ = meta


def _as_remote_jid(value: str) -> str:
    value = normalize_jid(value)
    if "@" in value:
        return value
    phone = normalize_phone(value)
    return f"{phone}@s.whatsapp.net" if phone else value


def _append_unique(items: list[str], value: str):
    if value and value not in items:
        items.append(value)


def _unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result
