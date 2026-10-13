from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class AuthSessionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="admin",
            email="admin@test.lv",
            password="pass",
            user_type=User.UserType.ADMIN,
        )
        self.api = APIClient()

    def test_login_returns_tokens_and_user(self):
        res = self.api.post(
            "/api/auth/login/",
            {"login": "admin", "password": "pass"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get("access"))
        self.assertTrue(res.data.get("refresh"))
        self.assertEqual(res.data["user"]["username"], "admin")

    def test_me_restores_session_with_access_token(self):
        refresh = RefreshToken.for_user(self.user)
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        res = self.api.get("/api/auth/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["username"], "admin")

    def test_refresh_issues_new_access_token(self):
        refresh = RefreshToken.for_user(self.user)
        res = self.api.post(
            "/api/auth/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get("access"))
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        me = self.api.get("/api/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["username"], "admin")
