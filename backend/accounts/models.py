from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class UserType(models.TextChoices):
        ADMIN = "admin", "Admin"
        WORKER = "worker", "Worker"

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150, blank=True)
    initials = models.CharField(max_length=8, blank=True)
    user_type = models.CharField(
        max_length=16,
        choices=UserType.choices,
        default=UserType.WORKER,
    )

    REQUIRED_FIELDS = ["email"]

    def save(self, *args, **kwargs):
        if not self.name:
            full = f"{self.first_name} {self.last_name}".strip()
            self.name = full or self.username
        if not self.initials and self.name:
            parts = [p for p in self.name.split() if p]
            self.initials = "".join(p[0] for p in parts[:2]).upper()
        if self.is_superuser:
            self.user_type = self.UserType.ADMIN
        super().save(*args, **kwargs)
