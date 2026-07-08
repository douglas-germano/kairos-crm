"""
Serviço de insights da Meta Graph API para o painel de monitoramento
(dados da conta e uso do rate limit da API).

Cobre apenas integrações Instagram hoje — é a única integração do Kairos que
usa a Meta Graph API de fato (WhatsApp roda via Evolution API, não oficial).
"""
import json
import logging

import requests

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


class MetaInsightsError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def get_instagram_insights(integration) -> dict:
    """
    Busca dados operacionais da conta Instagram conectada: informações da
    conta (seguidores, posts) e uso do rate limit da Graph API, extraído do
    header x-business-use-case-usage retornado pela própria chamada.
    """
    creds = integration.get_credentials()
    access_token = creds.get("access_token")
    ig_user_id = creds.get("ig_user_id")
    if not access_token or not ig_user_id:
        raise MetaInsightsError("Integração sem credenciais válidas", status=400)

    try:
        resp = requests.get(
            f"{GRAPH_BASE}/{ig_user_id}",
            params={
                "fields": "username,name,followers_count,media_count",
                "access_token": access_token,
            },
            timeout=15,
        )
        resp.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        body = {}
        try:
            body = exc.response.json()
        except ValueError:
            pass
        message = body.get("error", {}).get("message") or str(exc)
        logger.error("Falha ao buscar insights do Instagram | error=%s", message)
        raise MetaInsightsError(message, status=exc.response.status_code)
    except requests.exceptions.RequestException as exc:
        logger.error("Falha de rede ao buscar insights do Instagram | error=%s", str(exc))
        raise MetaInsightsError(str(exc))

    account = resp.json()

    return {
        "account": {
            "username": account.get("username"),
            "name": account.get("name"),
            "followers_count": account.get("followers_count"),
            "media_count": account.get("media_count"),
        },
        "api_usage": _parse_usage_header(resp.headers),
    }


def _parse_usage_header(headers) -> dict | None:
    """
    Extrai o percentual de uso do rate limit da Graph API do header
    x-business-use-case-usage (chave = ID da conta, valor = lista de
    métricas) ou x-app-usage (formato plano, sem chave por conta).
    """
    raw = headers.get("x-business-use-case-usage") or headers.get("x-app-usage")
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        return None

    if not isinstance(parsed, dict):
        return None

    if all(k in parsed for k in ("call_count", "total_cputime", "total_time")):
        entry = parsed
    else:
        entry = None
        for entries in parsed.values():
            if isinstance(entries, list) and entries:
                entry = entries[0]
                break
        if entry is None:
            return None

    return {
        "call_count_pct": entry.get("call_count"),
        "total_cputime_pct": entry.get("total_cputime"),
        "total_time_pct": entry.get("total_time"),
    }
