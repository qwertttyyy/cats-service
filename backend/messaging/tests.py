from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class WebSocketTicketApiTests(TestCase):
    """Проверяет REST endpoint выдачи одноразового WebSocket ticket."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="owner", password="StrongPassword123!"
        )

    def test_ws_ticket_requires_authentication(self):
        response = self.client.post("/api/ws-tickets/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ws_ticket_is_issued_for_authenticated_user(self):
        self.client.force_authenticate(self.user)

        response = self.client.post("/api/ws-tickets/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("ticket", response.json())
        self.assertGreater(response.json()["expires_in"], 0)


class ChatApiTests(TestCase):
    """
    Проверяет REST endpoints истории чата без реального MongoDB.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="owner", password="StrongPassword123!"
        )
        self.participant = User.objects.create_user(
            username="other", password="StrongPassword123!"
        )
        self.client.force_authenticate(self.user)

    @patch("messaging.views.list_user_chats")
    def test_user_can_get_chat_list(self, mocked_list_user_chats):
        mocked_list_user_chats.return_value = (
            1,
            [
                {
                    "chat_id": "chat-1",
                    "participant": {
                        "public_id": str(self.participant.public_id),
                        "username": "other",
                    },
                    "last_message": {"id": "message-1", "text": "Привет"},
                    "updated_at": "2026-05-08T10:00:00+03:00",
                }
            ],
        )

        response = self.client.get("/api/chats/?limit=20&offset=0")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["results"][0]["chat_id"], "chat-1")

    @patch("messaging.views.get_chat_messages")
    def test_user_can_get_chat_messages(self, mocked_get_chat_messages):
        mocked_get_chat_messages.return_value = (
            1,
            [
                {
                    "id": "message-1",
                    "chat_id": "chat-1",
                    "sender": {
                        "public_id": str(self.user.public_id),
                        "username": "owner",
                    },
                    "recipient": {
                        "public_id": str(self.participant.public_id),
                        "username": "other",
                    },
                    "text": "Привет",
                    "sent_at": "2026-05-08T10:00:00+03:00",
                }
            ],
        )

        response = self.client.get(
            f"/api/chats/{self.participant.public_id}/messages/?limit=20&offset=0"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["results"][0]["text"], "Привет")

    def test_user_cannot_open_chat_with_self(self):
        response = self.client.get(
            f"/api/chats/{self.user.public_id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json()["detail"], "Нельзя открыть чат с самим собой."
        )
