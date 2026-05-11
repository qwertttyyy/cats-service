import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.core.cache import cache

logger = logging.getLogger(__name__)
User = get_user_model()


class WebSocketTicketAuthMiddleware:
    """
    Аутентифицирует WebSocket-подключение по одноразовому ticket.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        """Добавляет в scope пользователя или None до передачи консьюмеру."""

        scope = dict(scope)
        ticket = self._extract_ticket(scope)
        scope["user"] = await self._authenticate(ticket)
        return await self.app(scope, receive, send)

    @staticmethod
    def _extract_ticket(scope) -> str | None:
        """Достаёт ticket из URL вида /ws/messages/?ticket=..."""

        query_string = scope.get("query_string", b"").decode("utf-8")
        params = parse_qs(query_string)
        tickets = params.get("ticket") or []
        return tickets[0] if tickets else None

    @database_sync_to_async
    def _authenticate(self, ticket: str | None):
        """
        Проверяет ticket в cache, удаляет его и возвращает пользователя.
        """

        if not ticket:
            return None
        cache_key = f"ws_ticket:{ticket}"
        user_id = cache.get(cache_key)
        if not user_id:
            logger.warning(
                "Rejected websocket connection with invalid or expired ticket"
            )
            return None
        cache.delete(cache_key)
        try:
            return User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            logger.warning(
                f"Rejected websocket connection for missing user_id={user_id}"
            )
            return None
