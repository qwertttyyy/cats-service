import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth import get_user_model

from messaging.mongo import create_message

logger = logging.getLogger(__name__)
User = get_user_model()


class MessageConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer для приватных сообщений с историей в MongoDB.
    """

    async def connect(self):
        """
        Принимает пользователя и подписывает его на личную группу.
        """

        self.user = self.scope.get("user")
        if self.user is None:
            logger.warning(
                f"Rejected websocket connect path={self.scope.get('path')}"
            )
            await self.close(code=4401)
            return

        self.group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"Accepted websocket connect user_id={self.user.id}")

    async def disconnect(self, close_code):
        """
        Удаляет канал пользователя из личной группы.
        """

        group_name = getattr(self, "group_name", None)
        if group_name:
            await self.channel_layer.group_discard(
                group_name, self.channel_name
            )
            logger.info(
                f"Disconnected websocket user_id={self.user.id} "
                f"code={close_code}"
            )

    async def receive_json(self, content, **kwargs):
        """
        Валидирует JSON и отправляет сообщение через channel layer.
        """

        if content.get("type") != "private_message":
            await self.send_error("Неподдерживаемый тип сообщения.")
            return

        recipient_id = str(content.get("recipient_id", "")).strip()
        text = str(content.get("text", "")).strip()
        if not text:
            await self.send_error("Текст сообщения не может быть пустым.")
            return
        if len(text) > settings.CHAT_MESSAGE_MAX_LENGTH:
            message = (
                f"Текст сообщения не должен быть длиннее "
                f"{settings.CHAT_MESSAGE_MAX_LENGTH} символов."
            )
            await self.send_error(message)
            return
        if not recipient_id:
            await self.send_error("Укажите получателя сообщения.")
            return

        recipient = await self.get_recipient(recipient_id)
        if recipient is None:
            await self.send_error("Получатель не найден.")
            return
        if recipient.id == self.user.id:
            await self.send_error("Нельзя отправить сообщение самому себе.")
            return

        message = await self.create_stored_message(self.user, recipient, text)
        websocket_message = {
            **message,
            "sent_at": message["sent_at"].isoformat(),
        }
        await self.channel_layer.group_send(
            f"user_{recipient.id}",
            {
                "type": "chat_message.event",
                "message": websocket_message,
            },
        )
        await self.channel_layer.group_send(
            f"user_{self.user.id}",
            {
                "type": "chat_message.event",
                "message": websocket_message,
            },
        )
        await self.send_json(
            {
                "type": "message_ack",
                "message_id": message["id"],
                "chat_id": message["chat_id"],
                "recipient_id": recipient_id,
                "sent_at": websocket_message["sent_at"],
            }
        )

    async def chat_message_event(self, event):
        """Отправляет получателю входящее приватное сообщение."""

        message = event["message"]
        await self.send_json(
            {
                "type": "private_message",
                "message": message,
            }
        )

    async def send_error(self, message: str):
        """Возвращает клиенту безопасное error-событие и пишет его в лог."""

        logger.info(
            f"Websocket error user_id={getattr(self.user, 'id', None)} "
            f"message={message}"
        )
        await self.send_json({"type": "error", "error": message})

    @database_sync_to_async
    def get_recipient(self, public_id: str):
        """Ищет активного получателя по публичному UUID."""

        try:
            return User.objects.get(public_id=public_id, is_active=True)
        except (User.DoesNotExist, ValueError):
            return None

    @database_sync_to_async
    def create_stored_message(self, sender, recipient, text: str):
        """Сохраняет сообщение в MongoDB перед realtime-доставкой."""

        return create_message(sender=sender, recipient=recipient, text=text)
