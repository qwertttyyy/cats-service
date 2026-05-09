from django.urls import path

from messaging.views import (
    ChatListView,
    ChatMessageListView,
    WebSocketTicketView,
)

urlpatterns = [
    path("ws-tickets/", WebSocketTicketView.as_view(), name="ws-tickets"),
    path("chats/", ChatListView.as_view(), name="chats"),
    path(
        "chats/<uuid:participant_public_id>/messages/",
        ChatMessageListView.as_view(),
        name="chat-messages",
    ),
]
