from django.urls import path

from messaging.consumers import MessageConsumer

websocket_urlpatterns = [
    path("ws/messages/", MessageConsumer.as_asgi()),
]
