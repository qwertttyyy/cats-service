#!/usr/bin/env sh
set -eu

mkdir -p /app/staticfiles /app/media

# ждём пока поднимется бд
if [ -n "${MYSQL_HOST:-}" ]; then
  python - <<'PY'
import os
import socket
import time

host = os.environ["MYSQL_HOST"]
port = int(os.environ.get("MYSQL_PORT", "3306"))
deadline = time.time() + 60

while True:
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError as exc:
        if time.time() > deadline:
            raise SystemExit(f"MySQL is not available at {host}:{port}: {exc}")
        print(f"Waiting for MySQL at {host}:{port}...")
        time.sleep(2)
PY
fi

python manage.py collectstatic --noinput
python manage.py migrate --noinput

exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
