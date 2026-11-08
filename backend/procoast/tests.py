from django.test import TestCase


class HealthTests(TestCase):
    def test_health_is_public_when_database_is_up(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
