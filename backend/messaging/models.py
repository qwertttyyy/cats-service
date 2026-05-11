import uuid

from django.conf import settings
from django.db import models


class ChatMessage(models.Model):
    """Сообщение личного чата между двумя пользователями."""

    chat = models.ForeignKey(
        "messaging.Chat",
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_messages",
    )
    text = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-sent_at", "-id"]
        indexes = [
            models.Index(fields=["chat_id", "-sent_at", "-id"]),
        ]

    def __str__(self) -> str:
        return f"{self.sender_id}->{self.recipient_id}: {self.text[:32]}"


class Chat(models.Model):
    """Личный чат двух пользователей."""

    public_id = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False, db_index=True
    )
    participant_one = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chats_as_participant_one",
    )
    participant_two = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chats_as_participant_two",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["participant_one", "participant_two"],
                name="unique_private_chat_participants",
            ),
        ]

    def __str__(self) -> str:
        return str(self.public_id)
