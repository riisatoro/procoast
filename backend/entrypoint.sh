#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py seed_users
python manage.py load_dump
python manage.py collectstatic --noinput

WORKERS="${GUNICORN_WORKERS:-3}"
TIMEOUT="${GUNICORN_TIMEOUT:-60}"
BIND="${GUNICORN_BIND:-0.0.0.0:8000}"

RELOAD_ARGS=""
case "${GUNICORN_RELOAD:-1}" in
  1|true|yes|TRUE|YES)
    RELOAD_ARGS="--reload"
    ;;
esac

exec gunicorn procoast.wsgi:application \
  --bind "$BIND" \
  --workers "$WORKERS" \
  --timeout "$TIMEOUT" \
  --worker-tmp-dir /dev/shm \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  $RELOAD_ARGS
