#!/bin/sh
set -e

echo "[start] Iniciando RQ worker em background..."
rq worker default --url "$REDIS_URL" &

echo "[start] Iniciando Gunicorn..."
exec gunicorn \
  --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
  -w 1 \
  --bind "0.0.0.0:${PORT:-8080}" \
  --timeout 120 \
  wsgi:app
