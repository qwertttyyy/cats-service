from urllib.parse import urlencode

from rest_framework.response import Response

from messaging.views import DEFAULT_CHAT_PAGE_SIZE, MAX_CHAT_PAGE_SIZE


def get_limit_offset(request) -> tuple[int, int]:
    """
    Читает limit/offset из query params и ограничивает размер страницы.
    """

    try:
        limit = int(request.query_params.get("limit", DEFAULT_CHAT_PAGE_SIZE))
    except (TypeError, ValueError):
        limit = DEFAULT_CHAT_PAGE_SIZE
    try:
        offset = int(request.query_params.get("offset", 0))
    except (TypeError, ValueError):
        offset = 0
    return min(max(limit, 1), MAX_CHAT_PAGE_SIZE), max(offset, 0)


def paginated_response(
    request, count: int, results: list, limit: int, offset: int
) -> Response:
    """Возвращает MongoDB results в формате DRF LimitOffsetPagination."""

    def build_url(new_offset: int) -> str | None:
        if new_offset < 0 or new_offset >= count:
            return None
        params = request.query_params.copy()
        params["limit"] = str(limit)
        params["offset"] = str(new_offset)
        return f"{request.path}?{urlencode(params, doseq=True)}"

    next_offset = offset + limit
    previous_offset = offset - limit
    return Response(
        {
            "count": count,
            "next": build_url(next_offset) if next_offset < count else None,
            "previous": build_url(previous_offset) if offset > 0 else None,
            "results": results,
        }
    )
