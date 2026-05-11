from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction

from messaging.models import Chat, ChatMessage
from messaging.serializers import ChatMessageSerializer

User = get_user_model()


def get_ordered_participants(
    first_user: User, second_user: User
) -> tuple[User, User]:
    """Возвращает участников в стабильном порядке для unique constraint."""

    if str(first_user.public_id) <= str(second_user.public_id):
        return first_user, second_user
    return second_user, first_user


def get_or_create_chat(first_user: User, second_user: User) -> Chat:
    """Возвращает личный чат двух пользователей или создаёт его."""

    participant_one, participant_two = get_ordered_participants(
        first_user, second_user
    )
    chat, _ = Chat.objects.get_or_create(
        participant_one=participant_one,
        participant_two=participant_two,
    )
    return chat


def create_message(sender: User, recipient: User, text: str) -> dict[str, Any]:
    """Сохраняет личное сообщение и возвращает публичный payload."""

    with transaction.atomic():
        chat = get_or_create_chat(sender, recipient)
        message = ChatMessage.objects.create(
            chat=chat,
            sender=sender,
            recipient=recipient,
            text=text,
        )
    return ChatMessageSerializer(message).data


def get_chat_messages_queryset(current_user: User, participant: User):
    """Возвращает queryset истории личного чата от новых сообщений к старым."""

    participant_one, participant_two = get_ordered_participants(
        current_user, participant
    )
    return ChatMessage.objects.filter(
        chat__participant_one=participant_one,
        chat__participant_two=participant_two,
    ).select_related(
        "chat",
        "sender",
        "recipient",
    )
