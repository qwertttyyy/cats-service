# Frontend Cats Service

Angular-приложение для REST API и realtime-чата Cats Service.

## Стек

- Angular `21.2.x`
- Angular Material `21.2.x`
- TypeScript `5.9.x`
- RxJS `7.8.x`
- Standalone components
- Angular Router
- Reactive Forms
- HttpClient + JWT interceptor
- WebSocket API для сообщений
- Nginx runtime container

Angular v21 официально поддерживает Node `^20.19.0 || ^22.12.0 || ^24.0.0`, поэтому Docker build использует `node:22-alpine`.

## Локальный запуск

```bash
cd frontend
npm ci
npm start
```

По умолчанию `npm start` поднимает `ng serve` на `http://localhost:4200` и проксирует:

- `/api` -> `http://127.0.0.1:8000`
- `/media` -> `http://127.0.0.1:8000`
- `/ws` -> `ws://127.0.0.1:8000`

Если backend доступен только через общий Docker Nginx, откройте адрес из `NGINX_EXTERNAL_PORT` вместо отдельного `ng serve`.

## Environment

Файлы:

- `src/environments/environment.ts`
- `src/environments/environment.production.ts`

Основные параметры:

```ts
apiUrl: '/api'
wsUrl: null
```

Если `wsUrl` равен `null`, приложение вычисляет WebSocket URL из текущего origin:

- `http` -> `ws://host/ws`
- `https` -> `wss://host/ws`

В production localhost не захардкожен.

## Production build

```bash
cd frontend
npm run build -- --configuration production
```

Dockerfile собирает Angular в build stage и отдаёт `dist/frontend/browser` через Nginx со SPA fallback:

```nginx
try_files $uri $uri/ /index.html;
```

## Docker Compose

Из корня монорепозитория:

```bash
cp .env.example .env
docker compose up --build
```

Frontend container слушает `80` внутри Docker-сети. Общий `nginx` service проксирует `/api`, `/ws`, `/media`, `/static` на backend и все остальные routes на frontend.

## Auth flow

1. Регистрация: `POST /api/auth/register/`
2. Вход: `POST /api/auth/token/`
3. Профиль: `GET /api/users/me/`
4. Refresh: `POST /api/auth/token/refresh/`

Access token хранится в памяти приложения. Refresh token хранится в `localStorage`, потому что backend использует Bearer JWT без httpOnly cookie. При logout refresh token удаляется, WebSocket закрывается.

## Cats flow

- `GET /api/cats/` — список моих котов
- `POST /api/cats/` — создание через `FormData`
- `GET /api/cats/{public_id}/` — карточка
- `PATCH /api/cats/{public_id}/` — обновление через `FormData`
- `DELETE /api/cats/{public_id}/` — удаление
- `GET /api/coat-types/` — справочник типов шерсти, кэшируется на время жизни вкладки

Возраст вводится как годы и месяцы, а в API отправляется одним числом `age_months`.

## Messages flow

- `GET /api/breeders/?search=&limit=20&offset=0` — список заводчиков с поиском и автоподгрузкой
- `GET /api/chats/{participant_public_id}/messages/?limit=50&offset=0` — история чата из MongoDB
- `POST /api/ws-tickets/` — одноразовый ticket для WebSocket
- `/ws/messages/?ticket=...` — realtime-канал

Payload отправки:

```json
{
  "type": "private_message",
  "recipient_id": "uuid",
  "text": "Привет"
}
```

Входящее событие:

```json
{
  "type": "private_message",
  "message": {
    "id": "...",
    "chat_id": "...",
    "sender": {},
    "recipient": {},
    "text": "Привет",
    "sent_at": "2026-05-08T12:00:00Z"
  }
}
```

## Что проверить вручную

1. Зарегистрировать двух пользователей.
2. Войти первым пользователем, добавить кота с фото и без фото.
3. Проверить редактирование и удаление кота.
4. Открыть Messages, найти второго пользователя.
5. Войти вторым пользователем в другой вкладке/браузере.
6. Отправить сообщение и убедиться, что оно приходит realtime.
7. Обновить страницу Messages и проверить загрузку истории из MongoDB.
