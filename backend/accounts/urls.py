from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, MeView, UserDetailView, UserListCreateView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", UserListCreateView.as_view(), name="users"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user-detail"),
]
