from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityLogViewSet,
    CalendarSettingsView,
    CoatingSystemViewSet,
    DailyReportViewSet,
    JobViewSet,
    MaterialViewSet,
    NotificationsViewSet,
    ProjectViewSet,
    ToolTypeViewSet,
    ToolViewSet,
    WarehouseViewSet,
)

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("materials", MaterialViewSet, basename="material")
router.register("tool-types", ToolTypeViewSet, basename="tool-type")
router.register("instruments", ToolViewSet, basename="instrument")
router.register("projects", ProjectViewSet, basename="project")
router.register("jobs", JobViewSet, basename="job")
router.register("activity", ActivityLogViewSet, basename="activity")
router.register("reports", DailyReportViewSet, basename="report")
router.register("notifications", NotificationsViewSet, basename="notification")
router.register("systems", CoatingSystemViewSet, basename="system")

urlpatterns = [
    *router.urls,
    path("calendar-settings/", CalendarSettingsView.as_view(), name="calendar-settings"),
]
