# Cats Service

Cats Service - проект для заводчиков кошек.

В приложении можно зарегистрироваться, вести список своих кошек, смотреть других заводчиков и обмениваться личными сообщениями. Проект состоит из backend API, frontend-приложения и инфраструктуры для запуска через Docker Compose.

## Стек

- Backend: Python, Django, Django REST Framework, Django Channels
- Frontend: Angular, Angular Material
- База данных: MySQL
- Чаты: MongoDB для истории сообщений, Redis для WebSocket/Channels
- Авторизация: JWT
- Документация API: OpenAPI, Swagger UI, ReDoc
- Инфраструктура: Docker Compose, Nginx, Daphne

## Структура проекта

- `backend/` - Django API, авторизация, коты, заводчики, чаты и WebSocket
- `frontend/` - Angular-приложение
- `nginx/` - внутренний Nginx для проксирования frontend, API, media/static и WebSocket
- `deploy/` - пример внешней Nginx-конфигурации для сервера
- `docker-compose.yml` - основной запуск проекта
- `.env.example` - пример переменных окружения

## Быстрый запуск через Docker

Скопируйте пример окружения:

```bash
cp .env.example .env
```

При необходимости отредактируйте `.env`: поменяйте секретный ключ, пароли баз данных, домены и порты.

Запустите проект:

```bash
docker compose up --build
```

После запуска приложение будет доступно по адресу:

```text
http://127.0.0.1:8080/
```

Полезные адреса:

- Frontend: `http://127.0.0.1:8080/`
- Swagger UI: `http://127.0.0.1:8080/api/docs/`
- ReDoc: `http://127.0.0.1:8080/api/redoc/`
- OpenAPI schema: `http://127.0.0.1:8080/api/schema/`
- Django admin: `http://127.0.0.1:8080/admin/`

Создать администратора:

```bash
docker compose exec backend python manage.py createsuperuser
```

Остановить проект:

```bash
docker compose down
```

Остановить проект и удалить локальные volumes с данными:

```bash
docker compose down -v
```

## Локальная разработка backend

Backend можно запускать отдельно. Если `MYSQL_HOST` не задан, Django использует SQLite.

```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py runserver
```

Тесты и проверки:

```bash
uv run python manage.py test
uv run ruff check .
```

Для полноценной работы чатов нужны Redis и MongoDB. Проще всего поднимать их через Docker Compose.

## Локальная разработка frontend

```bash
cd frontend
npm install
npm start
```

По умолчанию Angular dev server работает на:

```text
http://localhost:4200/
```

Для production-сборки:

```bash
npm run build
```

## API

Основные возможности API:

- регистрация и JWT-авторизация
- получение текущего пользователя
- список заводчиков
- CRUD для кошек
- справочник типов шерсти
- получение WebSocket ticket
- список чатов и история сообщений

Документация API доступна после запуска проекта в Swagger UI:

```text
http://127.0.0.1:8080/api/docs/
```

## Развёртывание

Базовый сценарий развёртывания:

1. Скопировать проект на сервер.
2. Создать `.env` из `.env.example`.
3. Заменить секреты, пароли, домены и trusted origins.
4. Запустить `docker compose up --build -d`.
5. Настроить внешний Nginx или другой reverse proxy.

Пример внешней Nginx-конфигурации находится в:

```text
deploy/nginx-external.example.conf
```

В production наружу обычно открывают только внешний Nginx, а контейнерный Nginx оставляют доступным на локальном интерфейсе.

## Данные

Данные MySQL, MongoDB, Redis, media и static хранятся в Docker volumes.
