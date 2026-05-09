from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema

from messaging.serializers import (
    ChatMessageSerializer,
    ChatSummarySerializer,
    WebSocketTicketResponseSerializer,
)

ws_ticket_schema = {
    "post": extend_schema(
        request=None, responses={201: WebSocketTicketResponseSerializer}
    ),
}


chat_list_schema = {
    "get": extend_schema(
        parameters=[
            OpenApiParameter(
                "limit", OpenApiTypes.INT, OpenApiParameter.QUERY
            ),
            OpenApiParameter(
                "offset", OpenApiTypes.INT, OpenApiParameter.QUERY
            ),
        ],
        responses={200: ChatSummarySerializer(many=True)},
    ),
}


chat_message_list_schema = {
    "get": extend_schema(
        parameters=[
            OpenApiParameter(
                "participant_public_id",
                OpenApiTypes.UUID,
                OpenApiParameter.PATH,
            ),
            OpenApiParameter(
                "limit", OpenApiTypes.INT, OpenApiParameter.QUERY
            ),
            OpenApiParameter(
                "offset", OpenApiTypes.INT, OpenApiParameter.QUERY
            ),
        ],
        responses={200: ChatMessageSerializer(many=True)},
    ),
}
