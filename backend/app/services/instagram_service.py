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
        return self._send_attachment_by_url(recipient_id, image_url, "image")

    def send_media(self, recipient_id: str, content_b64: str, media_type: str = "image", mime_type: str | None = None) -> dict:
        """
        Envia imagem/vídeo enviando o binário diretamente para a Attachment Upload API
        (não requer hospedagem pública do arquivo).
        :param recipient_id: IGSID do destinatário
        :param content_b64: conteúdo em base64 (sem prefixo data:)
        :param media_type: image | video
        """
        import base64
        binary = base64.b64decode(content_b64)
        filename = f"upload.{'mp4' if media_type == 'video' else 'jpg'}"
        content_type = mime_type or ("video/mp4" if media_type == "video" else "image/jpeg")

        upload_url = f"{GRAPH_BASE}/{self.ig_user_id}/message_attachments"
        files = {
            "filedata": (filename, binary, content_type),
        }
        data = {
            "message": '{"attachment":{"type":"%s","payload":{"is_reusable":true}}}' % media_type,
            "access_token": self.access_token,
        }
        try:
            resp = requests.post(upload_url, data=data, files=files, timeout=60)
            resp.raise_for_status()
            attachment_id = resp.json().get("attachment_id")
        except requests.RequestException as exc:
            logger.error(
                "Falha ao subir anexo Instagram",
                extra={"recipient": recipient_id, "media_type": media_type, "error": str(exc)},
            )
            raise

        return self._send_attachment_by_id(recipient_id, attachment_id, media_type)

    def _send_attachment_by_url(self, recipient_id: str, url_: str, media_type: str) -> dict:
        url = f"{GRAPH_BASE}/{self.ig_user_id}/messages"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": media_type,
                    "payload": {"url": url_, "is_reusable": True},
                }
            },
        }
        try:
            resp = requests.post(url, json=payload, headers=self.headers, timeout=30)
            resp.raise_for_status()
            logger.info("Mídia Instagram enviada (url)", extra={"recipient": recipient_id, "media_type": media_type})
            return resp.json()
        except requests.RequestException as exc:
            logger.error(
                "Falha ao enviar mídia Instagram (url)",
                extra={"recipient": recipient_id, "error": str(exc)},
            )
            raise

    def _send_attachment_by_id(self, recipient_id: str, attachment_id: str | None, media_type: str) -> dict:
        url = f"{GRAPH_BASE}/{self.ig_user_id}/messages"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": media_type,
                    "payload": {"attachment_id": attachment_id},
                }
            },
        }
        try:
            resp = requests.post(url, json=payload, headers=self.headers, timeout=30)
            resp.raise_for_status()
            logger.info("Mídia Instagram enviada (upload)", extra={"recipient": recipient_id, "media_type": media_type})
            return resp.json()
        except requests.RequestException as exc:
            logger.error(
                "Falha ao enviar mídia Instagram (upload)",
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
