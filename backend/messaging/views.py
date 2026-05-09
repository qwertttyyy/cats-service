import logging
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from drf_spectacular.utils import extend_schema_view
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from messaging.mongo import get_chat_messages, list_user_chats
from messaging.pagination import get_limit_offset, paginated_response
from messaging.schemas import (
    chat_list_schema,
    chat_message_list_schema,
    ws_ticket_schema,
)

logger = logging.getLogger(__name__)
User = get_user_model()

DEFAULT_CHAT_PAGE_SIZE = 20
MAX_CHAT_PAGE_SIZE = 100


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


@extend_schema_view(**chat_list_schema)
class ChatListView(APIView):
    """Возвращает список личных чатов текущего пользователя из MongoDB."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Отдаёт чаты, отсортированные по времени последнего сообщения."""

        limit, offset = get_limit_offset(request)
        count, chats = list_user_chats(
            request.user, limit=limit, offset=offset
        )
        return paginated_response(request, count, chats, limit, offset)


@extend_schema_view(**chat_message_list_schema)
class ChatMessageListView(APIView):
    """Возвращает историю личного чата с выбранным пользователем."""

    permission_classes = (IsAuthenticated,)

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

        limit, offset = get_limit_offset(request)
        count, messages = get_chat_messages(
            request.user, participant, limit=limit, offset=offset
        )
        return paginated_response(request, count, messages, limit, offset)
