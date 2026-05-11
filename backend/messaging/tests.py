from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from messaging.services import (
    create_message,
    get_chat_messages_queryset,
)

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
    Проверяет REST endpoints истории чата без реальной БД сообщений.
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

    def test_user_can_get_chat_messages(self):
        create_message(self.user, self.participant, "Привет")

        response = self.client.get(
            f"/api/chats/{self.participant.public_id}/messages/?limit=20&offset=0"
        )
        message = response.json()["results"][0]

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(message["text"], "Привет")
        self.assertEqual(
            set(message["sender"]),
            {"public_id", "username", "first_name", "last_name"},
        )
        self.assertEqual(
            message["sender"]["public_id"], str(self.user.public_id)
        )
        self.assertNotIn("date_joined", message["sender"])

    def test_chat_messages_default_limit_is_50(self):
        for index in range(55):
            create_message(self.user, self.participant, f"Сообщение {index}")

        response = self.client.get(
            f"/api/chats/{self.participant.public_id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 55)
        self.assertEqual(len(response.json()["results"]), 50)

    def test_user_cannot_open_chat_with_self(self):
        response = self.client.get(
            f"/api/chats/{self.user.public_id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json()["detail"], "Нельзя открыть чат с самим собой."
        )


class ChatMessageStorageTests(TestCase):
    """Проверяет хранение сообщений в основной SQL-базе."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="owner", password="StrongPassword123!"
        )
        self.participant = User.objects.create_user(
            username="other", password="StrongPassword123!"
        )

    def test_chat_history_is_returned_in_chronological_order(self):
        create_message(self.user, self.participant, "Первое")
        create_message(self.participant, self.user, "Второе")

        messages = list(
            get_chat_messages_queryset(self.user, self.participant).order_by(
                "sent_at", "id"
            )
        )

        self.assertEqual(len(messages), 2)
        self.assertEqual(
            [message.text for message in messages], ["Первое", "Второе"]
        )

    def test_chat_id_is_uuid_hex(self):
        message = create_message(self.user, self.participant, "Привет")

        self.assertEqual(len(message["chat_id"]), 32)
        self.assertTrue(message["chat_id"].isalnum())
        self.assertIsInstance(message["sent_at"], str)
