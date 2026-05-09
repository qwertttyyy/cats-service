from rest_framework import serializers


class WebSocketTicketResponseSerializer(serializers.Serializer):
    """
    Описывает ответ endpoint-а выдачи одноразового WebSocket ticket.
    """

    ticket = serializers.CharField(read_only=True)
    expires_in = serializers.IntegerField(read_only=True)


class ChatMessageSerializer(serializers.Serializer):
    """Публичное представление сообщения из MongoDB."""

    id = serializers.CharField(read_only=True)
    chat_id = serializers.CharField(read_only=True)
    sender = serializers.DictField(read_only=True)
    recipient = serializers.DictField(read_only=True)
    text = serializers.CharField(read_only=True)
    sent_at = serializers.DateTimeField(read_only=True)


class ChatSummarySerializer(serializers.Serializer):
    """Краткое представление чата для списка диалогов."""

    chat_id = serializers.CharField(read_only=True)
    participant = serializers.DictField(read_only=True)
    last_message = ChatMessageSerializer(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
