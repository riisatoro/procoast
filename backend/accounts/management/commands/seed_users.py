import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create Django admin from env vars"

    def handle(self, *args, **options):
        username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
        if not username or not password:
            self.stdout.write(self.style.WARNING("DJANGO_SUPERUSER_* not set, skip"))
            return
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email or f"{username}@procoat.lv",
                "name": username,
                "user_type": User.UserType.ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created admin user {username}"))
        elif not user.check_password(password):
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.user_type = User.UserType.ADMIN
            if email:
                user.email = email
            user.save()
            self.stdout.write(self.style.WARNING(f"Updated admin user {username}"))
