#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py seed_users
python manage.py load_dump
python manage.py runserver 0.0.0.0:8010
