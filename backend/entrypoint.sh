#!/bin/sh
set -eu

python manage.py migrate --noinput
python manage.py seed_users
python manage.py load_dump
python manage.py collectstatic --noinput

WORKERS="${GUNICORN_WORKERS:-1}"
TIMEOUT="${GUNICORN_TIMEOUT:-60}"
BIND="${GUNICORN_BIND:-0.0.0.0:8000}"
MAX_REQUESTS="${GUNICORN_MAX_REQUESTS:-1000}"
MAX_REQUESTS_JITTER="${GUNICORN_MAX_REQUESTS_JITTER:-100}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-30}"
HEALTH_FAIL_THRESHOLD="${HEALTH_FAIL_THRESHOLD:-3}"
HEALTH_START_PERIOD="${HEALTH_START_PERIOD:-20}"
PORT="${BIND##*:}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/health/}"

RELOAD_ARGS=""
case "${GUNICORN_RELOAD:-1}" in
  1|true|yes|TRUE|YES)
    RELOAD_ARGS="--reload"
    ;;
esac

GUNICORN_PID=""
SHUTTING_DOWN=0

health_ok() {
  HEALTH_URL="$HEALTH_URL" python -c 'import os, urllib.request; urllib.request.urlopen(os.environ["HEALTH_URL"], timeout=5)' >/dev/null 2>&1
}

stop_gunicorn() {
  pid="$1"
  if [ -z "$pid" ]; then
    return 0
  fi
  kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  i=0
  while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 10 ]; do
    sleep 1
    i=$((i + 1))
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
  wait "$pid" 2>/dev/null || true
}

launch_gunicorn() {
  echo "starting gunicorn on ${BIND}"
  # New session so a restart signal reaches gunicorn and its workers together.
  python -c 'import os, sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' \
    gunicorn procoast.wsgi:application \
    --bind "$BIND" \
    --workers "$WORKERS" \
    --timeout "$TIMEOUT" \
    --graceful-timeout "$TIMEOUT" \
    --max-requests "$MAX_REQUESTS" \
    --max-requests-jitter "$MAX_REQUESTS_JITTER" \
    --worker-tmp-dir /dev/shm \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    $RELOAD_ARGS &
  GUNICORN_PID=$!
}

on_signal() {
  SHUTTING_DOWN=1
  echo "stopping procoast-be"
  stop_gunicorn "$GUNICORN_PID"
  exit 0
}

trap on_signal TERM INT

set +e
launch_gunicorn
failures=0
grace="$HEALTH_START_PERIOD"

while [ "$SHUTTING_DOWN" -eq 0 ]; do
  sleep "$HEALTH_INTERVAL" &
  SLEEP_PID=$!
  wait "$SLEEP_PID"
  if [ "$SHUTTING_DOWN" -eq 1 ]; then
    break
  fi

  if ! kill -0 "$GUNICORN_PID" 2>/dev/null; then
    echo "gunicorn exited unexpectedly; restarting"
    wait "$GUNICORN_PID" 2>/dev/null || true
    sleep 2
    launch_gunicorn
    failures=0
    grace="$HEALTH_START_PERIOD"
    continue
  fi

  if [ "$grace" -gt 0 ]; then
    grace=$((grace - HEALTH_INTERVAL))
    continue
  fi

  if health_ok; then
    failures=0
    continue
  fi

  failures=$((failures + 1))
  echo "procoast-be health check failed (${failures}/${HEALTH_FAIL_THRESHOLD})"
  if [ "$failures" -ge "$HEALTH_FAIL_THRESHOLD" ]; then
    echo "restarting procoast-be after repeated health check failures"
    stop_gunicorn "$GUNICORN_PID"
    sleep 1
    launch_gunicorn
    failures=0
    grace="$HEALTH_START_PERIOD"
  fi
done
