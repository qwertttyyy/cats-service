# Cats Service

Pet-проект сервиса заводчиков котов: Django 6, Django REST Framework, JWT, MySQL, MongoDB, Redis, Django Channels, Daphne, Angular 21, Angular Material, Docker Compose и внутренний Nginx.

## Структура backend

Backend остаётся в папке `backend/` без дополнительного вложенного `backend/backend`.

- `cats` — пользователи, заводчики, коты, типы шерсти, REST API для этих сущностей.
- `messaging` — REST endpoints чатов, WebSocket ticket, Channels middleware, routing, consumer сообщений и MongoDB-слой истории.
- `config` — настройки Django, URLConf и ASGI/WGI entrypoints.

## Версии

Стабильные версии пакетов проверены по PyPI 7-8 мая 2026 года и зафиксированы в `backend/pyproject.toml`: Django 6.0.5, DRF 3.17.1, Channels 4.3.2, channels-redis 4.3.0, Daphne 4.2.1, Simple JWT 5.5.1, drf-spectacular 0.29.0, django-cors-headers 4.9.0, PyMySQL 1.1.3, Pillow 12.2.0, redis-py 7.4.0, PyMongo 4.17.0.

Frontend использует Angular `21.2.x`, Angular CLI `21.2.x`, Angular Material `21.2.x`, TypeScript `5.9.x` и RxJS `7.8.x`. Актуальная совместимость Angular v21 проверена по официальной документации Angular: Node `^20.19.0 || ^22.12.0 || ^24.0.0`, TypeScript `>=5.9.0 <6.0.0`, RxJS `^6.5.3 || ^7.4.0`. Docker build frontend использует Node 22.

Docker-образ backend использует Python 3.14 как актуальную стабильную ветку, подходящую для Django 6.x. Для локальной разработки в `pyproject.toml` указан минимум Python 3.12, потому что это нижняя поддерживаемая версия для Django 6.

Для MySQL выбран `PyMySQL`: он не требует локальных системных dev-библиотек и нормально работает с MySQL в контейнере. Если позже понадобится нативный драйвер, замену на `mysqlclient` можно сделать точечно в зависимостях и адаптере подключения.

## Переменные окружения

Создайте `.env` из примера:

```bash
cp .env.example .env
```

Перед запуском на общем сервере поменяйте `DJANGO_SECRET_KEY`, пароли MySQL и остальные секреты. В `docker-compose.yml` не используется `env_file`: все переменные явно перечислены в `environment` и подставляются из `.env`.

По умолчанию используется `Europe/Moscow` и `ru-ru`, потому что API возвращает русскоязычные сообщения валидации и поле `age_display`.

## Запуск через Docker

```bash
docker compose up --build
```

Entrypoint backend ждёт MySQL, затем выполняет:

```bash
python manage.py collectstatic --noinput
python manage.py migrate --noinput
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Создание суперпользователя:

```bash
docker compose exec backend python manage.py createsuperuser
```

Локальные адреса при значениях из `.env.example`:

- приложение через внутренний Nginx: `http://127.0.0.1:8080/`
- Swagger UI: `http://127.0.0.1:8080/api/docs/`
- OpenAPI schema: `http://127.0.0.1:8080/api/schema/`
- ReDoc: `http://127.0.0.1:8080/api/redoc/`
- Django admin: `http://127.0.0.1:8080/admin/`

На сервере лучше наружу отдавать только внешний серверный Nginx, который проксирует во внутренний Nginx container на `127.0.0.1:${NGINX_EXTERNAL_PORT}`. Пример лежит в `deploy/nginx-external.example.conf`.

## Локальный backend без Docker

Если `MYSQL_HOST` не задан, настройки используют SQLite. Это удобно для быстрых тестов:

```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py test
```

Для реальной WebSocket-доставки нужен Redis, а для истории чатов нужна MongoDB. Их проще поднять через Docker Compose.

## REST API

Аутентификация:

- `POST /api/auth/register/`
- `POST /api/auth/token/`
- `POST /api/auth/token/refresh/`
- `POST /api/auth/token/verify/`
- `GET /api/users/me/`

Заводчики:

- `GET /api/breeders/?search=ivan&limit=20&offset=0`

Коты:

- `GET /api/cats/`
- `POST /api/cats/`
- `GET /api/cats/{public_id}/`
- `PATCH /api/cats/{public_id}/`
- `DELETE /api/cats/{public_id}/`
- `GET /api/coat-types/`

WebSocket ticket:

- `POST /api/ws-tickets/`

Чаты:

- `GET /api/chats/?limit=20&offset=0`
- `GET /api/chats/{participant_public_id}/messages/?limit=20&offset=0`

Все endpoints, кроме регистрации и JWT endpoints, требуют заголовок `Authorization: Bearer <access>`.

## Примеры REST-запросов

Регистрация:

```bash
curl -X POST http://127.0.0.1:8080/api/auth/register/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"ivan","password":"StrongPassword123!","first_name":"Ivan"}'
```

Получение JWT:

```bash
curl -X POST http://127.0.0.1:8080/api/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"ivan","password":"StrongPassword123!"}'
```

Создание кота с multipart/form-data:

```bash
curl -X POST http://127.0.0.1:8080/api/cats/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'name=Murka' \
  -F 'age_months=14' \
  -F 'breed=Siberian' \
  -F 'coat_type=short' \
  -F 'photo=@/path/to/photo.jpg'
```

Возраст хранится в `age_months` от `0` до `480`. В ответе дополнительно приходит read-only поле `age_display`: `3 месяца`, `1 год 2 месяца`, `5 лет`.

## REST-чаты

Список чатов строится по сообщениям в MongoDB и сортируется по последнему сообщению:

```bash
curl http://127.0.0.1:8080/api/chats/?limit=20\&offset=0 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

История личного чата с конкретным заводчиком:

```bash
curl http://127.0.0.1:8080/api/chats/<participant_public_id>/messages/?limit=20\&offset=0 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Ответы имеют формат `count`, `next`, `previous`, `results`. Сообщения в истории возвращаются в хронологическом порядке внутри выбранного окна.

## WebSocket-сообщения

OpenAPI не описывает WebSocket полноценно, поэтому flow описан текстом.

1. Получить JWT access token.
2. Запросить одноразовый ticket:

```bash
curl -X POST http://127.0.0.1:8080/api/ws-tickets/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

3. Подключиться:

```text
ws://127.0.0.1:8080/ws/messages/?ticket=<ticket>
```

4. Отправить приватное сообщение. `recipient_id` — это `public_id` пользователя-получателя:

```json
{
  "type": "private_message",
  "recipient_id": "f8a43e8e-b05a-4d44-885e-8b9e9b25a810",
  "text": "Привет"
}
```

Сообщение сохраняется в MongoDB, затем доставляется в realtime. Отправитель получает ack:

```json
{
  "type": "message_ack",
  "message_id": "663c...",
  "chat_id": "public-id-1:public-id-2",
  "recipient_id": "f8a43e8e-b05a-4d44-885e-8b9e9b25a810",
  "sent_at": "2026-05-08T12:00:00+03:00"
}
```

Получатель и все активные соединения отправителя получают realtime-событие:

```json
{
  "type": "private_message",
  "message": {
    "id": "663c...",
    "chat_id": "public-id-1:public-id-2",
    "sender": {
      "public_id": "...",
      "username": "ivan",
      "first_name": "Ivan",
      "last_name": "",
      "date_joined": "..."
    },
    "recipient": {
      "public_id": "...",
      "username": "petr",
      "first_name": "",
      "last_name": "",
      "date_joined": "..."
    },
    "text": "Привет",
    "sent_at": "2026-05-08T12:00:00+03:00"
  }
}
```

Сообщения не хранятся в MySQL. История чатов хранится в MongoDB collection из переменной `MONGODB_CHAT_MESSAGES_COLLECTION`.

Ручная проверка через `websocat`:

```bash
websocat 'ws://127.0.0.1:8080/ws/messages/?ticket=<ticket>'
```

## Frontend

Angular-приложение лежит в `frontend/` и использует standalone components, Angular Router, Reactive Forms, HttpClient, JWT interceptor и WebSocketService.

Локальный запуск frontend:

```bash
cd frontend
npm ci
npm start
```

`npm start` запускает `ng serve` и проксирует `/api`, `/media`, `/ws` на локальный backend `127.0.0.1:8000`. Для production-сборки:

```bash
cd frontend
npm run build -- --configuration production
```

Подробности по frontend flow описаны в `frontend/README.md`.

Основные frontend routes:

- `/login` — вход
- `/register` — регистрация
- `/cats` — список моих котов
- `/cats/new` — создание кота
- `/cats/:publicId/edit` — редактирование кота
- `/messages` — заводчики и realtime-чат
