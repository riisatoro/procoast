from rest_framework.permissions import BasePermission


class IsAdminType(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (getattr(user, "user_type", None) == "admin" or user.is_superuser)
        )
