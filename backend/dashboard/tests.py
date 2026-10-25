from datetime import date, datetime, time
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from operations.models import DailyReport, Job, Material, MaterialSpending, Project, ProjectMaterial, Warehouse

User = get_user_model()


class DashboardAccessTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@test.lv",
            password="pass",
            user_type=User.UserType.ADMIN,
            is_staff=True,
        )
        self.worker = User.objects.create_user(
            username="worker",
            email="worker@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.project = Project.objects.create(name="Site A", client="Client A")
        self.api = APIClient()

    def _auth(self, user):
        self.api.force_authenticate(user=user)

    def test_worker_can_read_dashboard_stats(self):
        self._auth(self.worker)
        res = self.api.get("/api/dashboard/stats/")
        self.assertEqual(res.status_code, 200)
        items = res.data.get("projects", {}).get("items") or []
        self.assertTrue(any(row["id"] == self.project.id for row in items))

    def test_worker_cannot_close_project_from_dashboard(self):
        self._auth(self.worker)
        res = self.api.post(f"/api/projects/{self.project.id}/close/")
        self.assertEqual(res.status_code, 403)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, Project.Status.OPEN)

    def test_worker_cannot_discard_project_from_dashboard(self):
        self._auth(self.worker)
        res = self.api.post(f"/api/projects/{self.project.id}/discard/")
        self.assertEqual(res.status_code, 403)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, Project.Status.OPEN)


def _at(day, hour=9):
    return timezone.make_aware(datetime.combine(day, time(hour, 0)))


class DashboardPeriodFilterTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@test.lv",
            password="pass",
            user_type=User.UserType.ADMIN,
            is_staff=True,
        )
        self.worker = User.objects.create_user(
            username="worker",
            email="worker@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.project = Project.objects.create(name="Site A", client="Client A")
        self.api = APIClient()
        self.api.force_authenticate(user=self.admin)

    def _job(self, start, end=None):
        return Job.objects.create(
            project=self.project,
            assigned_to=self.worker,
            starts_at=_at(start),
            ends_at=_at(end or start, 17),
        )

    def test_period_jobs_include_start_and_end_dates(self):
        start = self._job(date(2026, 9, 1))
        end = self._job(date(2026, 9, 10))
        inside = self._job(date(2026, 9, 5))
        before = self._job(date(2026, 8, 31))
        after = self._job(date(2026, 9, 11))
        overlap_start = self._job(date(2026, 8, 20), date(2026, 9, 1))
        overlap_end = self._job(date(2026, 9, 10), date(2026, 9, 20))
        res = self.api.get("/api/dashboard/stats/?from=2026-09-01&to=2026-09-10")
        self.assertEqual(res.status_code, 200)
        ids = {row["id"] for row in res.data.get("period_jobs") or []}
        self.assertEqual(
            ids,
            {start.id, end.id, inside.id, overlap_start.id, overlap_end.id},
        )
        self.assertNotIn(before.id, ids)
        self.assertNotIn(after.id, ids)
        self.assertEqual(res.data["period"]["from"], "2026-09-01")
        self.assertEqual(res.data["period"]["to"], "2026-09-10")
        self.assertEqual(res.data["period"]["jobs"], 5)

    def test_active_projects_ignore_selected_period(self):
        may = self.api.get("/api/dashboard/stats/?from=2026-05-01&to=2026-05-31")
        oct_ = self.api.get("/api/dashboard/stats/?from=2026-10-01&to=2026-10-31")
        self.assertEqual(may.status_code, 200)
        self.assertEqual(oct_.status_code, 200)
        self.assertEqual(may.data["projects"]["active"], oct_.data["projects"]["active"])
        self.assertEqual(
            {row["id"] for row in may.data["projects"]["items"]},
            {row["id"] for row in oct_.data["projects"]["items"]},
        )

    def test_today_reports_stay_on_current_day(self):
        today = timezone.localdate()
        DailyReport.objects.create(
            project=self.project,
            recorded_by=self.worker,
            work_date=today,
            notes="today",
        )
        DailyReport.objects.create(
            project=self.project,
            recorded_by=self.admin,
            work_date=date(2026, 5, 6),
            notes="may",
        )
        res = self.api.get("/api/dashboard/stats/?from=2026-05-01&to=2026-05-31")
        self.assertEqual(res.status_code, 200)
        dates = {row["work_date"] for row in res.data.get("today_reports") or []}
        self.assertEqual(dates, {today.isoformat()})
        later = self.api.get("/api/dashboard/stats/?from=2026-10-01&to=2026-10-31")
        later_dates = {row["work_date"] for row in later.data.get("today_reports") or []}
        self.assertEqual(later_dates, {today.isoformat()})

    def test_today_jobs_stay_on_current_day(self):
        today = timezone.localdate()
        current = self._job(today)
        historical = self._job(date(2026, 5, 6))
        res = self.api.get("/api/dashboard/stats/?from=2026-05-01&to=2026-05-31")
        self.assertEqual(res.status_code, 200)
        today_ids = {row["id"] for row in res.data.get("today_jobs") or []}
        period_ids = {row["id"] for row in res.data.get("period_jobs") or []}
        self.assertIn(current.id, today_ids)
        self.assertNotIn(historical.id, today_ids)
        self.assertIn(historical.id, period_ids)

    def test_material_spent_follows_period(self):
        warehouse = Warehouse.objects.create(name="Main")
        material = Material.objects.create(name="EP11", warehouse=warehouse, unit="kg")
        ProjectMaterial.objects.create(
            project=self.project,
            material=material,
            quantity_needed=Decimal("100"),
        )
        may_row = MaterialSpending.objects.create(
            project=self.project,
            material=material,
            quantity=Decimal("40"),
            recorded_by=self.worker,
        )
        MaterialSpending.objects.filter(pk=may_row.pk).update(
            created_at=timezone.make_aware(datetime.combine(date(2026, 5, 6), time(12, 0)))
        )
        oct_row = MaterialSpending.objects.create(
            project=self.project,
            material=material,
            quantity=Decimal("15"),
            recorded_by=self.worker,
        )
        MaterialSpending.objects.filter(pk=oct_row.pk).update(
            created_at=timezone.make_aware(datetime.combine(date(2026, 10, 10), time(12, 0)))
        )
        may = self.api.get("/api/dashboard/stats/?from=2026-05-01&to=2026-05-31")
        oct_ = self.api.get("/api/dashboard/stats/?from=2026-10-01&to=2026-10-31")
        self.assertEqual(Decimal(res_spent(may, material.id)), Decimal("40"))
        self.assertEqual(Decimal(res_spent(oct_, material.id)), Decimal("15"))
        self.api.force_authenticate(user=self.worker)
        worker_may = self.api.get("/api/dashboard/stats/?from=2026-05-01&to=2026-05-31")
        self.assertEqual(worker_may.status_code, 200)
        self.assertEqual(Decimal(res_spent(worker_may, material.id)), Decimal("40"))
        self.assertEqual(worker_may.data["period"]["from"], "2026-05-01")


def res_spent(res, material_id):
    for row in res.data.get("material_usage") or []:
        if row["id"] == material_id:
            return str(Decimal(row["spent"]))
    return None

