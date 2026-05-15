"""
Serviço de envio de mensagens via WhatsApp usando a Evolution API.
As credenciais (api_url, api_key, instance_name) ficam na tabela integrations,
criptografadas com Fernet.
"""
import logging
import requests

logger = logging.getLogger(__name__)


class WhatsAppService:
    def __init__(self, api_url: str, api_key: str, instance_name: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.instance_name = instance_name
        self.headers = {
            "apikey": api_key,
            "Content-Type": "application/json",
        }

    def send_text(self, to: str, text: str) -> dict:
        """
        Envia mensagem de texto.
        :param to: número no formato 5565999999999 (sem @s.whatsapp.net)
        :param text: conteúdo da mensagem
        """
        url = f"{self.api_url}/message/sendText/{self.instance_name}"
        # Formato Evolution API v2: number sem sufixo, campo "text" direto
        payload = {
            "number": to,
            "text": text,
        }
        try:
            resp = requests.post(url, json=payload, headers=self.headers, timeout=15)
            resp.raise_for_status()
            logger.info(
                "Mensagem WhatsApp enviada",
                extra={"to": to, "instance": self.instance_name},
            )
            return resp.json()
        except requests.RequestException as exc:
            logger.error(
                "Falha ao enviar mensagem WhatsApp",
                extra={"to": to, "error": str(exc)},
            )
            raise

    def send_media(self, to: str, media_url: str, caption: str = "", media_type: str = "image") -> dict:
        """
        Envia mídia (image, audio, video, document).
        :param to: número no formato 5565999999999
        :param media_url: URL pública da mídia
        :param caption: legenda (opcional)
        :param media_type: image | audio | video | document
        """
        url = f"{self.api_url}/message/sendMedia/{self.instance_name}"
        payload = {
            "number": f"{to}@s.whatsapp.net",
            "options": {"delay": 1200},
            "mediaMessage": {
                "mediatype": media_type,
                "media": media_url,
                "caption": caption,
            },
        }
        try:
            resp = requests.post(url, json=payload, headers=self.headers, timeout=30)
            resp.raise_for_status()
            logger.info(
                "Mídia WhatsApp enviada",
                extra={"to": to, "type": media_type, "instance": self.instance_name},
            )
            return resp.json()
        except requests.RequestException as exc:
            logger.error(
                "Falha ao enviar mídia WhatsApp",
                extra={"to": to, "error": str(exc)},
            )
            raise


def get_whatsapp_service(integration) -> "WhatsAppService":
    """
    Constrói um WhatsAppService a partir de um objeto Integration.
    Usa fallback para variáveis de ambiente se as credentials estiverem vazias
    (pode ocorrer se a integração foi criada antes de um bug fix).
    """
    from flask import current_app
    creds = integration.get_credentials()
    meta = integration.meta or {}
    api_url = creds.get("api_url") or current_app.config.get("EVOLUTION_API_URL", "")
    api_key = creds.get("api_key") or current_app.config.get("EVOLUTION_API_KEY", "")
    instance_name = meta.get("instance_name") or creds.get("instance_name") or ""
    return WhatsAppService(api_url=api_url, api_key=api_key, instance_name=instance_name)
