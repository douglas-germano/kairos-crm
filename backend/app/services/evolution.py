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
        "groupsIgnore": True,
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
    payload = {
        "webhook": {
            "enabled": True,
            "url": webhook_url,
            "webhookByEvents": False,
            "webhookBase64": True,
            "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        }
    }
    return _request("POST", f"/webhook/set/{instance_name}", json=payload)


def find_messages(instance_name: str, remote_jid: str, limit: int = 100, offset: int = 0) -> list:
    """Busca histórico de mensagens de um chat específico via Evolution API."""
    payload = {
        "where": {"key": {"remoteJid": remote_jid}},
        "limit": limit,
        "offset": offset,
    }
    result = _request("POST", f"/chat/findMessages/{instance_name}", json=payload)

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
    return [m for m in items if isinstance(m, dict)]


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
