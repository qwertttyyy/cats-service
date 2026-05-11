from rest_framework import serializers

from messaging.models import ChatMessage


class ChatMessageUserSerializer(serializers.Serializer):
    """Минимальные данные пользователя для сообщений"""

    public_id = serializers.UUIDField(read_only=True)
    username = serializers.CharField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)


class WebSocketTicketResponseSerializer(serializers.Serializer):
    """
    Ответ эндпоинта выдачи одноразового WebSocket ticket.
    """

    ticket = serializers.CharField(read_only=True)
    expires_in = serializers.IntegerField(read_only=True)


class ChatMessageSerializer(serializers.ModelSerializer):
    """Публичное представление сообщения."""

    id = serializers.CharField(read_only=True)
    chat_id = serializers.UUIDField(
        source="chat.public_id", format="hex", read_only=True
    )
    sender = ChatMessageUserSerializer(read_only=True)
    recipient = ChatMessageUserSerializer(read_only=True)

    class Meta:
        model = ChatMessage
        fields = ("id", "chat_id", "sender", "recipient", "text", "sent_at")
        read_only_fields = fields
