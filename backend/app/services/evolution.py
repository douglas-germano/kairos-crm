"""
Serviço de abstração para a Evolution API.

Gerencia criação de instâncias, QR code e estado de conexão WhatsApp.
"""
import logging
import requests
from flask import current_app

logger = logging.getLogger(__name__)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _base_url() -> str:
    url = current_app.config.get("EVOLUTION_API_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("EVOLUTION_API_URL não configurada")
    return url


def _headers() -> dict:
    key = current_app.config.get("EVOLUTION_API_KEY", "")
    return {"apikey": key, "Content-Type": "application/json"}


def _request(method: str, path: str, **kwargs) -> dict:
    """Faz uma requisição à Evolution API e retorna o JSON da resposta."""
    url = f"{_base_url()}{path}"
    try:
        resp = requests.request(method, url, headers=_headers(), timeout=15, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError as exc:
        body = {}
        try:
            body = exc.response.json()
        except Exception:
            pass
        status_code = exc.response.status_code
        error_msg = body.get("message") or body.get("error") or str(exc)
        logger.error(
            "Evolution API HTTP error | status=%s path=%s body=%s",
            status_code, path, body,
        )
        raise EvolutionError(error_msg, status=status_code)
    except requests.exceptions.RequestException as exc:
        logger.error("Evolution API request error | error=%s", str(exc))
        raise EvolutionError(str(exc))


# ─── Exception ────────────────────────────────────────────────────────────────

class EvolutionError(Exception):
    def __init__(self, message: str, status: int = 500):
        super().__init__(message)
        self.status = status


# ─── Instance management ──────────────────────────────────────────────────────

def create_instance(instance_name: str, webhook_url: str) -> dict:
    """
    Cria uma instância WhatsApp na Evolution API.

    Retorna o payload completo incluindo QR code base64 quando disponível.
    O webhook é configurado para receber eventos MESSAGES_UPSERT e CONNECTION_UPDATE.
    """
    payload = {
        "instanceName": instance_name,
        "integration": "WHATSAPP-BAILEYS",
        "qrcode": True,
        "groupsIgnore": False,
        "readMessages": False,
        "alwaysOnline": True,
        "webhook": {
            "enabled": True,
            "url": webhook_url,
            "byEvents": False,
            "base64": True,
            "events": [
                "MESSAGES_UPSERT",
                "CONNECTION_UPDATE",
                "QRCODE_UPDATED",
            ],
        },
    }
    return _request("POST", "/instance/create", json=payload)


def get_qr(instance_name: str) -> dict:
    """
    Gera / atualiza o QR code de uma instância existente.

    Retorna { pairingCode, code, count } onde `code` é a string bruta do QR.
    """
    return _request("GET", f"/instance/connect/{instance_name}")


def connection_state(instance_name: str) -> dict:
    """
    Retorna o estado atual de conexão de uma instância.

    Estados possíveis: 'open' | 'close' | 'connecting'
    """
    return _request("GET", f"/instance/connectionState/{instance_name}")


def delete_instance(instance_name: str) -> dict:
    """Remove / desconecta permanentemente uma instância."""
    return _request("DELETE", f"/instance/delete/{instance_name}")


def set_webhook(instance_name: str, webhook_url: str) -> dict:
    """Atualiza (ou cria) a configuração de webhook de uma instância existente."""
    webhook = {
        "enabled": True,
        "url": webhook_url,
        "webhookByEvents": False,
        "webhookBase64": True,
        "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
    }
    try:
        return _request("POST", f"/webhook/set/{instance_name}", json={"webhook": webhook})
    except EvolutionError as exc:
        # Algumas builds da Evolution v2 aceitam o corpo plano documentado; a
        # instância em produção exige {"webhook": {...}}. Mantemos fallback para
        # evitar regressão se o servidor for atualizado.
        if exc.status == 400:
            return _request("POST", f"/webhook/set/{instance_name}", json=webhook)
        raise


def set_settings(
    instance_name: str,
    *,
    groups_ignore: bool = False,
    sync_full_history: bool = True,
) -> dict:
    """Ajusta a instância para manter chats e histórico disponíveis para sync."""
    payload = {
        "rejectCall": False,
        "msgCall": "",
        "groupsIgnore": groups_ignore,
        "alwaysOnline": True,
        "readMessages": False,
        "readStatus": False,
        "syncFullHistory": sync_full_history,
    }
    return _request("POST", f"/settings/set/{instance_name}", json=payload)


def find_messages(instance_name: str, remote_jid: str, limit: int = 100, offset: int = 0) -> list:
    """Busca histórico de mensagens de um chat específico via Evolution API."""
    payload = {
        "where": {"key": {"remoteJid": remote_jid}},
        "limit": limit,
        "offset": offset,
    }
    result = _request("POST", f"/chat/findMessages/{instance_name}", json=payload)

    # Log do resultado bruto para diagnóstico de formato
    result_type = type(result).__name__
    sample = str(result)[:300] if result else "empty"
    print(f"[find_messages] type={result_type} sample={sample}", flush=True)

    # Normaliza qualquer formato da Evolution API para uma lista plana de objetos
    if isinstance(result, list):
        items = result
    elif isinstance(result, dict):
        # Pode ser {"messages": [...]} ou {"messages": {"total": N, "records": [...]}}
        inner = result.get("messages") or result.get("records") or []
        if isinstance(inner, list):
            items = inner
        elif isinstance(inner, dict):
            items = inner.get("records") or inner.get("messages") or []
        else:
            items = []
    else:
        items = []

    # Filtra apenas dicts (descarta IDs textuais que a API pode incluir)
    filtered = [m for m in items if isinstance(m, dict)]
    print(f"[find_messages] items_total={len(items)} items_dict={len(filtered)}", flush=True)
    return filtered


def get_media_base64(instance_name: str, message: dict) -> dict:
    """Baixa a mídia de uma mensagem e retorna os dados normalizados."""
    result = _request("POST", f"/chat/getBase64FromMediaMessage/{instance_name}", json={
        "message": message,
        "convertToMp4": False,
    })

    if isinstance(result, str):
        return {"base64": result}
    if not isinstance(result, dict):
        return {}

    base64_value = _find_first_string(result, {"base64", "media", "file", "buffer"})
    mimetype = _find_first_string(result, {"mimetype", "mimeType", "mediaType"})
    return {"base64": base64_value, "mimetype": mimetype}


def _find_first_string(value, keys: set[str]) -> str:
    """Procura recursivamente uma string em respostas variáveis da Evolution."""
    if isinstance(value, dict):
        for key in keys:
            found = value.get(key)
            if isinstance(found, str) and found:
                return found
        for nested in value.values():
            found = _find_first_string(nested, keys)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _find_first_string(item, keys)
            if found:
                return found
    return ""


def find_chats(instance_name: str, limit: int = 200, offset: int = 0) -> list:
    """Busca a lista de chats conhecidos pela instância WhatsApp."""
    payload = {
        "where": {},
        "take": limit,
        "skip": offset,
        "orderBy": {"updatedAt": "desc"},
    }
    result = _request("POST", f"/chat/findChats/{instance_name}", json=payload)

    if isinstance(result, list):
        items = result
    elif isinstance(result, dict):
        inner = result.get("chats") or result.get("records") or result.get("data") or []
        if isinstance(inner, list):
            items = inner
        elif isinstance(inner, dict):
            items = inner.get("records") or inner.get("chats") or inner.get("data") or []
        else:
            items = []
    else:
        items = []

    return [chat for chat in items if isinstance(chat, dict)]


def fetch_instance(instance_name: str) -> dict | None:
    """Busca dados de uma instância. Retorna None se não existir."""
    try:
        result = _request("GET", f"/instance/fetchInstances?instanceName={instance_name}")
        # A API retorna uma lista
        if isinstance(result, list) and result:
            return result[0]
        return None
    except EvolutionError as exc:
        if exc.status == 404:
            return None
        raise
