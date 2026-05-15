#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting gunicorn..."
exec gunicorn \
  --worker-class eventlet \
  -w 1 \
  --bind "0.0.0.0:${PORT:-5000}" \
  --timeout 120 \
  --log-level "${LOG_LEVEL:-info}" \
  wsgi:app
