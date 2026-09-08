from rest_framework.routers import DefaultRouter

from .views import (
    ActivityLogViewSet,
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

urlpatterns = router.urls
