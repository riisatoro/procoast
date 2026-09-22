from django.urls import path

from .exports import ExportCsvView
from .views import DashboardStatsView, DashboardView

urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("exports/csv/", ExportCsvView.as_view(), name="export-csv"),
]
