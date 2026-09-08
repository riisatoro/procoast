from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "name", "user_type", "is_active", "is_staff")
    list_filter = ("user_type", "is_active", "is_staff", "is_superuser")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("ProCoat", {"fields": ("name", "initials", "user_type")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("ProCoat", {"fields": ("email", "name", "initials", "user_type")}),
    )
