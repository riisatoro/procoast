from django.contrib import admin
from django.urls import include, path

from procoast.health import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("dashboard.urls")),
    path("api/", include("operations.urls")),
]
