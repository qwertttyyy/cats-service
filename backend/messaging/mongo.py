from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from pymongo import ASCENDING, DESCENDING, MongoClient

from cats.serializers import UserSerializer

User = get_user_model()


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    """Создаёт singleton PyMongo client для операций с историей чатов."""

    return MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=3000)


@lru_cache(maxsize=1)
def get_messages_collection():
    """Возвращает MongoDB collection с сообщениями и лениво создаёт индексы."""

    database = get_mongo_client()[settings.MONGODB_DATABASE]
    collection = database[settings.MONGODB_CHAT_MESSAGES_COLLECTION]
    collection.create_index([("chat_id", ASCENDING), ("sent_at", DESCENDING)])
    collection.create_index(
        [("participants", ASCENDING), ("sent_at", DESCENDING)]
    )
    return collection


def build_chat_id(first_public_id: str, second_public_id: str) -> str:
    """Строит стабильный id личного чата из двух public_id пользователей."""

    return ":".join(sorted([str(first_public_id), str(second_public_id)]))


def serialize_user_for_chat(user: User) -> dict[str, Any]:
    """Сериализует пользователя для вложения в сообщение или summary чата."""

    return UserSerializer(user).data


def serialize_message(document: dict[str, Any]) -> dict[str, Any]:
    """Преобразует MongoDB document в JSON payload API/WebSocket."""

    payload = {
        "id": str(document["_id"]),
        "chat_id": document["chat_id"],
        "sender": document["sender"],
        "recipient": document["recipient"],
        "text": document["text"],
        "sent_at": document["sent_at"],
    }
    return payload


def create_message(sender: User, recipient: User, text: str) -> dict[str, Any]:
    """Сохраняет личное сообщение в MongoDB и возвращает публичный payload."""

    sender_public_id = str(sender.public_id)
    recipient_public_id = str(recipient.public_id)
    document = {
        "chat_id": build_chat_id(sender_public_id, recipient_public_id),
        "participants": [sender_public_id, recipient_public_id],
        "sender_public_id": sender_public_id,
        "recipient_public_id": recipient_public_id,
        "sender": serialize_user_for_chat(sender),
        "recipient": serialize_user_for_chat(recipient),
        "text": text,
        "sent_at": datetime.now(UTC),
    }
    result = get_messages_collection().insert_one(document)
    document["_id"] = result.inserted_id
    return serialize_message(document)


def get_chat_messages(
    current_user: User, participant: User, limit: int, offset: int
) -> tuple[int, list[dict[str, Any]]]:
    """Возвращает окно истории личного чата в хронологическом порядке."""

    chat_id = build_chat_id(
        str(current_user.public_id), str(participant.public_id)
    )
    collection = get_messages_collection()
    query = {"chat_id": chat_id}
    total = collection.count_documents(query)
    documents = list(
        collection.find(query)
        .sort("sent_at", DESCENDING)
        .skip(offset)
        .limit(limit)
    )
    return total, [
        serialize_message(document) for document in reversed(documents)
    ]


def list_user_chats(
    current_user: User, limit: int, offset: int
) -> tuple[int, list[dict[str, Any]]]:
    """
    Собирает список чатов по последнему сообщению в каждом чате.
    """

    current_public_id = str(current_user.public_id)
    collection = get_messages_collection()
    pipeline = [
        {"$match": {"participants": current_public_id}},
        {"$sort": {"sent_at": -1}},
        {
            "$group": {
                "_id": "$chat_id",
                "last_message": {"$first": "$$ROOT"},
                "updated_at": {"$first": "$sent_at"},
            }
        },
        {"$sort": {"updated_at": -1}},
        {
            "$facet": {
                "metadata": [{"$count": "total"}],
                "items": [{"$skip": offset}, {"$limit": limit}],
            }
        },
    ]
    result = list(collection.aggregate(pipeline))
    if not result:
        return 0, []

    total = result[0]["metadata"][0]["total"] if result[0]["metadata"] else 0
    items = []
    for item in result[0]["items"]:
        last_message = serialize_message(item["last_message"])
        participant_public_id = next(
            public_id
            for public_id in item["last_message"]["participants"]
            if public_id != current_public_id
        )
        participant = _get_user_payload_by_public_id(participant_public_id)
        if not participant:
            continue
        items.append(
            {
                "chat_id": item["_id"],
                "participant": participant,
                "last_message": last_message,
                "updated_at": item["updated_at"],
            }
        )
    return total, items


def _get_user_payload_by_public_id(public_id: str) -> dict[str, Any] | None:
    """Достаёт безопасный payload пользователя для summary чата."""

    try:
        user = User.objects.get(public_id=public_id, is_active=True)
    except (User.DoesNotExist, ValueError):
        return None
    return serialize_user_for_chat(user)
