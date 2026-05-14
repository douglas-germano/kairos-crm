"""
Serviço de envio de mensagens via Instagram usando a Meta Graph API.
As credenciais (access_token, ig_user_id) ficam na tabela integrations,
criptografadas com Fernet.
"""
import logging
import requests

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


class InstagramService:
    def __init__(self, access_token: str, ig_user_id: str):
        self.access_token = access_token
        self.ig_user_id = ig_user_id
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def send_text(self, recipient_id: str, text: str) -> dict:
        """
        Envia mensagem de texto via Instagram Messaging.
        :param recipient_id: IGSID do destinatário
        :param text: conteúdo da mensagem
        """
        url = f"{GRAPH_BASE}/{self.ig_user_id}/messages"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": text},
        }
        try:
            resp = requests.post(url, json=payload, headers=self.headers, timeout=15)
            resp.raise_for_status()
            logger.info(
                "Mensagem Instagram enviada",
                extra={"recipient": recipient_id, "ig_user_id": self.ig_user_id},
            )
            return resp.json()
        except requests.RequestException as exc:
            logger.error(
                "Falha ao enviar mensagem Instagram",
                extra={"recipient": recipient_id, "error": str(exc)},
            )
            raise

    def send_image(self, recipient_id: str, image_url: str) -> dict:
        """
        Envia imagem via Instagram Messaging.
        :param recipient_id: IGSID do destinatário
        :param image_url: URL pública da imagem
        """
        url = f"{GRAPH_BASE}/{self.ig_user_id}/messages"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "image",
                    "payload": {"url": image_url, "is_reusable": True},
                }
            },
        }
        try:
            resp = requests.post(url, json=payload, headers=self.headers, timeout=30)
            resp.raise_for_status()
            logger.info(
                "Imagem Instagram enviada",
                extra={"recipient": recipient_id},
            )
            return resp.json()
        except requests.RequestException as exc:
            logger.error(
                "Falha ao enviar imagem Instagram",
                extra={"recipient": recipient_id, "error": str(exc)},
            )
            raise


def get_instagram_service(integration) -> "InstagramService":
    """
    Constrói um InstagramService a partir de um objeto Integration.
    """
    creds = integration.get_credentials()
    return InstagramService(
        access_token=creds.get("access_token", ""),
        ig_user_id=creds.get("ig_user_id", ""),
    )
