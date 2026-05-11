import logging
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from drf_spectacular.utils import extend_schema_view
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from messaging.schemas import (
    chat_message_list_schema,
    ws_ticket_schema,
)
from messaging.serializers import ChatMessageSerializer
from messaging.services import get_chat_messages_queryset

logger = logging.getLogger(__name__)
User = get_user_model()


class ChatMessageLimitOffsetPagination(LimitOffsetPagination):
    default_limit = 50
    max_limit = 100


@extend_schema_view(**ws_ticket_schema)
class WebSocketTicketView(APIView):
    """
    Выдаёт короткоживущий ticket для подключения к WebSocket.
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        """
        Сохраняет ticket в cache с TTL и привязывает к пользователю.
        """

        ticket = secrets.token_urlsafe(32)
        ttl = settings.WS_TICKET_TTL_SECONDS
        cache.set(f"ws_ticket:{ticket}", request.user.id, timeout=ttl)
        logger.info(
            f"Issued websocket ticket user_id={request.user.id} ttl={ttl}"
        )
        return Response(
            {"ticket": ticket, "expires_in": ttl},
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(**chat_message_list_schema)
class ChatMessageListView(ListAPIView):
    """Возвращает историю личного чата с выбранным пользователем."""

    permission_classes = (IsAuthenticated,)
    serializer_class = ChatMessageSerializer
    pagination_class = ChatMessageLimitOffsetPagination

    def get(self, request, participant_public_id):
        """
        Находит собеседника по public_id и отдаёт историю личного чата.
        """

        try:
            participant = User.objects.get(
                public_id=participant_public_id, is_active=True
            )
        except User.DoesNotExist:
            return Response(
                {"detail": "Собеседник не найден."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if participant.id == request.user.id:
            return Response(
                {"detail": "Нельзя открыть чат с самим собой."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.participant = participant
        return super().get(request, participant_public_id)

    def get_queryset(self):
        return get_chat_messages_queryset(
            self.request.user, self.participant
        ).order_by("-sent_at", "-id")

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(reversed(page), many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
