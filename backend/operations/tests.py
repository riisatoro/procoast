from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from operations.activity import log_activity
from operations.models import (
    ActivityLog,
    DailyReport,
    Job,
    Material,
    MaterialSpending,
    NotificationRead,
    Project,
    ProjectMaterial,
    ProjectPeriod,
    ProjectTask,
    Warehouse,
)

User = get_user_model()


class PurgeArchivedProjectTests(TestCase):
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
        self.api = APIClient()

    def _auth(self, user):
        self.api.force_authenticate(user=user)

    def test_admin_can_purge_closed_project(self):
        project = Project.objects.create(name="Closed site", status=Project.Status.CLOSED)
        self._auth(self.admin)
        res = self.api.delete(f"/api/projects/{project.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Project.objects.filter(pk=project.pk).exists())

    def test_admin_can_purge_deleted_project(self):
        project = Project.objects.create(name="Deleted site", status=Project.Status.DELETED)
        self._auth(self.admin)
        res = self.api.delete(f"/api/projects/{project.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Project.objects.filter(pk=project.pk).exists())

    def test_admin_cannot_purge_open_project(self):
        project = Project.objects.create(name="Open site", status=Project.Status.OPEN)
        self._auth(self.admin)
        res = self.api.delete(f"/api/projects/{project.id}/")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(Project.objects.filter(pk=project.pk).exists())

    def test_worker_cannot_purge_archived_project(self):
        project = Project.objects.create(name="Closed site", status=Project.Status.CLOSED)
        self._auth(self.worker)
        res = self.api.delete(f"/api/projects/{project.id}/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Project.objects.filter(pk=project.pk).exists())


class NotificationReadTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@test.lv",
            password="pass",
            user_type=User.UserType.ADMIN,
            is_staff=True,
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.admin)
        log_activity(self.admin, "created", "project", 1, "Izveidots objekts")

    def test_list_returns_unread_activity(self):
        res = self.api.get("/api/notifications/")
        self.assertEqual(res.status_code, 200)
        items = res.data.get("items") or []
        self.assertTrue(items)
        self.assertTrue(all(item.get("unread") for item in items))
        self.assertEqual(res.data.get("unread"), len(items))

    def test_mark_one_read_hides_it_without_deleting_log(self):
        listed = self.api.get("/api/notifications/")
        notif_id = listed.data["items"][0]["id"]
        log_id = int(str(notif_id).split("-", 1)[1])
        res = self.api.post("/api/notifications/mark-read/", {"ids": [notif_id]}, format="json")
        self.assertEqual(res.status_code, 200)
        remaining_ids = [item["id"] for item in res.data.get("items") or []]
        self.assertNotIn(notif_id, remaining_ids)
        self.assertTrue(ActivityLog.objects.filter(pk=log_id).exists())
        self.assertTrue(
            NotificationRead.objects.filter(user=self.admin, notification_key=notif_id).exists()
        )

    def test_mark_all_read_clears_list(self):
        for index in range(30):
            log_activity(self.admin, "created", "project", index + 2, f"Log {index}")
        Project.objects.create(
            name="Late site",
            planned_days=5,
            start_date=date.today() - timedelta(days=20),
            status=Project.Status.OPEN,
        )
        listed = self.api.get("/api/notifications/")
        self.assertEqual(len(listed.data.get("items") or []), 24)
        res = self.api.post("/api/notifications/mark-read/", {"all": True}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("items"), [])
        self.assertEqual(res.data.get("unread"), 0)
        self.assertTrue(ActivityLog.objects.exists())
        listed = self.api.get("/api/notifications/")
        self.assertEqual(listed.data.get("items"), [])

    def test_worker_cannot_list_or_mark_notifications(self):
        worker = User.objects.create_user(
            username="worker",
            email="worker@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.api.force_authenticate(user=worker)
        listed = self.api.get("/api/notifications/")
        self.assertEqual(listed.status_code, 403)
        marked = self.api.post("/api/notifications/mark-read/", {"all": True}, format="json")
        self.assertEqual(marked.status_code, 403)


class ProjectScheduleTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@test.lv",
            password="pass",
            user_type=User.UserType.ADMIN,
            is_staff=True,
        )
        self.worker_a = User.objects.create_user(
            username="anna",
            email="anna@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.worker_b = User.objects.create_user(
            username="berns",
            email="berns@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.admin)

    def test_create_site_adds_calendar_job_for_each_assignee(self):
        res = self.api.post(
            "/api/projects/",
            {
                "name": "Multi crew site",
                "client": "Multi crew site",
                "assigned_to_ids": [self.worker_a.id, self.worker_b.id],
                "start_date": "2026-05-04",
                "end_date": "2026-05-15",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        jobs = Job.objects.filter(project_id=res.data["id"]).order_by("assigned_to_id")
        self.assertEqual(jobs.count(), 2)
        self.assertCountEqual(
            list(jobs.values_list("assigned_to_id", flat=True)),
            [self.worker_a.id, self.worker_b.id],
        )
        first = jobs.first()
        self.assertEqual(first.starts_at.date().isoformat(), "2026-05-04")
        self.assertEqual(first.ends_at.date().isoformat(), "2026-05-15")

    def test_admin_can_update_site_and_sync_jobs(self):
        created = self.api.post(
            "/api/projects/",
            {
                "name": "Edit me",
                "client": "Edit me",
                "assigned_to_ids": [self.worker_a.id],
                "start_date": "2026-05-04",
                "end_date": "2026-05-15",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        project_id = created.data["id"]
        res = self.api.patch(
            f"/api/projects/{project_id}/",
            {
                "client": "Renamed",
                "name": "Renamed",
                "assigned_to_ids": [self.worker_a.id, self.worker_b.id, self.admin.id],
                "start_date": "2026-06-01",
                "end_date": "2026-06-10",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["client"], "Renamed")
        assignee_ids = [row["id"] for row in res.data["assigned_to"]]
        self.assertCountEqual(assignee_ids, [self.worker_a.id, self.worker_b.id])
        self.assertNotIn(self.admin.id, assignee_ids)
        jobs = Job.objects.filter(project_id=project_id)
        self.assertEqual(jobs.count(), 2)
        self.assertCountEqual(
            list(jobs.values_list("assigned_to_id", flat=True)),
            [self.worker_a.id, self.worker_b.id],
        )
        self.assertTrue(all(job.starts_at.date().isoformat() == "2026-06-01" for job in jobs))
        self.assertTrue(all(job.ends_at.date().isoformat() == "2026-06-10" for job in jobs))

    def test_worker_cannot_update_project(self):
        project = Project.objects.create(name="Locked", client="Locked")
        self.api.force_authenticate(user=self.worker_a)
        res = self.api.patch(
            f"/api/projects/{project.id}/",
            {"client": "Hacked"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        project.refresh_from_db()
        self.assertEqual(project.client, "Locked")

    def test_create_does_not_assign_admin_by_default(self):
        res = self.api.post(
            "/api/projects/",
            {"name": "No crew", "client": "No crew"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["assigned_to"], [])
        self.assertEqual(Job.objects.filter(project_id=res.data["id"]).count(), 0)

    def test_admin_can_add_and_remove_materials_on_edit(self):
        created = self.api.post(
            "/api/projects/",
            {
                "name": "Mats",
                "client": "Mats",
                "assigned_to_ids": [self.worker_a.id],
                "start_date": "2026-05-04",
                "end_date": "2026-05-15",
                "total_m2": 100,
                "materials": [
                    {"name": "Primer", "quantity_needed": 10, "unit": "kg", "per_m2": "0.1"},
                    {"name": "Topcoat", "quantity_needed": 20, "unit": "kg", "per_m2": "0.2"},
                ],
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        project_id = created.data["id"]
        self.assertEqual(ProjectMaterial.objects.filter(project_id=project_id).count(), 2)

        res = self.api.patch(
            f"/api/projects/{project_id}/",
            {
                "materials": [
                    {"name": "Primer", "quantity_needed": 12, "unit": "kg", "per_m2": "0.12"},
                    {"name": "Quartz", "quantity_needed": 5, "unit": "kg"},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        detail = self.api.get(f"/api/projects/{project_id}/")
        names = [
            (row.get("material_detail") or {}).get("name")
            for row in detail.data.get("needed_materials") or []
        ]
        self.assertCountEqual(names, ["Primer", "Quartz"])
        primer = next(
            row for row in detail.data["needed_materials"] if row["material_detail"]["name"] == "Primer"
        )
        self.assertEqual(Decimal(str(primer["quantity_needed"])), Decimal("12"))

    def test_periods_round_trip_and_sum_planned_days(self):
        res = self.api.post(
            "/api/projects/",
            {
                "name": "Split weeks",
                "client": "Split weeks",
                "assigned_to_ids": [self.worker_a.id, self.worker_b.id],
                "periods": [
                    {"start_date": "2026-05-04", "end_date": "2026-05-06"},
                    {"start_date": "2026-05-18", "end_date": "2026-05-20"},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["start_date"], "2026-05-04")
        self.assertEqual(res.data["end_date"], "2026-05-20")
        self.assertEqual(res.data["planned_days"], 6)
        periods = res.data.get("periods") or []
        self.assertEqual(len(periods), 2)
        jobs = Job.objects.filter(project_id=res.data["id"])
        self.assertEqual(jobs.count(), 4)
        self.assertCountEqual(
            {(job.assigned_to_id, job.starts_at.date().isoformat(), job.ends_at.date().isoformat()) for job in jobs},
            {
                (self.worker_a.id, "2026-05-04", "2026-05-06"),
                (self.worker_b.id, "2026-05-04", "2026-05-06"),
                (self.worker_a.id, "2026-05-18", "2026-05-20"),
                (self.worker_b.id, "2026-05-18", "2026-05-20"),
            },
        )

        patched = self.api.patch(
            f"/api/projects/{res.data['id']}/",
            {
                "assigned_to_ids": [self.worker_a.id],
                "periods": [
                    {"start_date": "2026-05-04", "end_date": "2026-05-06"},
                    {"start_date": "2026-05-25", "end_date": "2026-05-26"},
                ],
            },
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.data["planned_days"], 5)
        self.assertEqual(Job.objects.filter(project_id=res.data["id"]).count(), 2)
        self.assertTrue(
            all(job.assigned_to_id == self.worker_a.id for job in Job.objects.filter(project_id=res.data["id"]))
        )

    def test_pause_week_does_not_mark_overdue(self):
        today = date.today()
        first_start = today - timedelta(days=12)
        first_end = first_start + timedelta(days=2)
        second_start = today + timedelta(days=7)
        second_end = second_start + timedelta(days=2)
        res = self.api.post(
            "/api/projects/",
            {
                "name": "Gap site",
                "client": "Gap site",
                "assigned_to_ids": [self.worker_a.id],
                "periods": [
                    {"start_date": first_start.isoformat(), "end_date": first_end.isoformat()},
                    {"start_date": second_start.isoformat(), "end_date": second_end.isoformat()},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["planned_days"], 6)
        self.assertEqual(res.data["elapsed_days"], 3)
        self.assertFalse(res.data["planned_days_exceeded"])
        project = Project.objects.get(pk=res.data["id"])
        self.assertEqual(project.elapsed_days(today), 3)
        self.assertEqual(project.overdue_days(today), 0)

        late_end = today - timedelta(days=8)
        late_start = late_end - timedelta(days=2)
        early_end = late_start - timedelta(days=8)
        early_start = early_end - timedelta(days=2)
        late = self.api.post(
            "/api/projects/",
            {
                "name": "Late gap",
                "client": "Late gap",
                "assigned_to_ids": [self.worker_a.id],
                "periods": [
                    {"start_date": early_start.isoformat(), "end_date": early_end.isoformat()},
                    {"start_date": late_start.isoformat(), "end_date": late_end.isoformat()},
                ],
            },
            format="json",
        )
        self.assertEqual(late.status_code, 201)
        self.assertTrue(late.data["planned_days_exceeded"])
        self.assertGreater(late.data["elapsed_days"], late.data["planned_days"])

    def test_calendar_multi_worker_create_adds_period_and_assignees(self):
        project = Project.objects.create(name="Cal site", client="Cal site")
        res = self.api.post(
            "/api/jobs/",
            {
                "project_id": project.id,
                "assigned_to_ids": [self.worker_a.id, self.worker_b.id],
                "starts_at": "2026-06-01T08:00:00",
                "ends_at": "2026-06-03T17:00:00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        project.refresh_from_db()
        self.assertCountEqual(
            list(project.assignees.values_list("id", flat=True)),
            [self.worker_a.id, self.worker_b.id],
        )
        self.assertEqual(project.periods.count(), 1)
        period = project.periods.get()
        self.assertEqual(period.start_date.isoformat(), "2026-06-01")
        self.assertEqual(period.end_date.isoformat(), "2026-06-03")
        self.assertEqual(project.planned_days, 3)
        self.assertEqual(Job.objects.filter(project=project).count(), 2)
        self.assertEqual(ProjectPeriod.objects.filter(project=project).count(), 1)


class MaterialReserveTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@test.lv",
            password="pass",
            user_type=User.UserType.ADMIN,
            is_staff=True,
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.admin)
        self.warehouse_a = Warehouse.objects.create(name="Riga", location="Riga")
        self.warehouse_b = Warehouse.objects.create(name="Liepaja", location="Liepaja")
        self.material = Material.objects.create(
            name="EP11",
            color="RAL7001",
            unit="kg",
            per_m2=Decimal("0.20"),
            warehouse=self.warehouse_a,
            stock=Decimal("100"),
            created_by=self.admin,
        )
        self.project = Project.objects.create(name="Site", client="Site")

    def test_add_material_reserves_stock_for_project(self):
        res = self.api.post(
            f"/api/projects/{self.project.id}/needed-materials/",
            {
                "warehouse": self.warehouse_a.id,
                "material": self.material.id,
                "quantity_needed": "40",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        detail = res.data.get("material_detail") or {}
        self.assertEqual(detail.get("warehouse"), self.warehouse_a.id)
        self.assertEqual(Decimal(str(detail.get("stock"))), Decimal("100"))
        self.assertEqual(Decimal(str(detail.get("reserved"))), Decimal("40"))
        self.assertEqual(Decimal(str(detail.get("available"))), Decimal("60"))
        linked = [row["id"] for row in detail.get("linked_projects") or []]
        self.assertIn(self.project.id, linked)
        self.assertTrue(
            ProjectMaterial.objects.filter(project=self.project, material=self.material).exists()
        )

        listed = self.api.get("/api/materials/")
        row = next(item for item in listed.data if item["id"] == self.material.id)
        self.assertEqual(Decimal(str(row["reserved"])), Decimal("40"))
        self.assertEqual(Decimal(str(row["available"])), Decimal("60"))
        self.assertEqual(Decimal(str(row["stock"])), Decimal("100"))

    def test_create_project_reserves_assigned_catalog_material(self):
        worker = User.objects.create_user(
            username="crew",
            email="crew@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        res = self.api.post(
            "/api/projects/",
            {
                "name": "Crew site",
                "client": "Crew site",
                "assigned_to_ids": [worker.id],
                "start_date": "2026-09-01",
                "end_date": "2026-09-10",
                "materials": [
                    {
                        "material": self.material.id,
                        "name": self.material.name,
                        "color": self.material.color,
                        "quantity_needed": "40",
                        "unit": "kg",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(
            ProjectMaterial.objects.filter(
                project_id=res.data["id"], material=self.material, quantity_needed=Decimal("40")
            ).exists()
        )
        listed = self.api.get("/api/materials/")
        row = next(item for item in listed.data if item["id"] == self.material.id)
        self.assertEqual(Decimal(str(row["stock"])), Decimal("100"))
        self.assertEqual(Decimal(str(row["reserved"])), Decimal("40"))
        self.assertEqual(Decimal(str(row["available"])), Decimal("60"))

    def test_create_project_assigns_color_per_material(self):
        res = self.api.post(
            "/api/projects/",
            {
                "name": "Color site",
                "client": "Color site",
                "materials": [
                    {
                        "name": "EP02 Color",
                        "color": "RAL7001",
                        "quantity_needed": "10",
                        "unit": "kg",
                    },
                    {
                        "material": self.material.id,
                        "name": self.material.name,
                        "color": "RAL7035",
                        "quantity_needed": "8",
                        "unit": "kg",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        detail = self.api.get(f"/api/projects/{res.data['id']}/")
        rows = detail.data.get("needed_materials") or []
        colors = {
            ((row.get("material_detail") or {}).get("name"), (row.get("material_detail") or {}).get("color"))
            for row in rows
        }
        self.assertIn(("EP02 Color", "RAL7001"), colors)
        self.assertIn((self.material.name, "RAL7035"), colors)
        self.assertFalse(
            ProjectMaterial.objects.filter(project_id=res.data["id"], material=self.material).exists()
        )
        variant = Material.objects.get(name=self.material.name, color="RAL7035")
        self.assertNotEqual(variant.id, self.material.id)

    def test_create_project_cannot_assign_more_than_available(self):
        res = self.api.post(
            "/api/projects/",
            {
                "name": "Too much",
                "client": "Too much",
                "materials": [
                    {
                        "material": self.material.id,
                        "name": self.material.name,
                        "quantity_needed": "150",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Project.objects.filter(name="Too much").exists())
        self.material.refresh_from_db()
        self.assertEqual(self.material.stock, Decimal("100"))
        listed = self.api.get("/api/materials/")
        row = next(item for item in listed.data if item["id"] == self.material.id)
        self.assertEqual(Decimal(str(row["reserved"])), Decimal("0"))
        self.assertEqual(Decimal(str(row["available"])), Decimal("100"))

    def test_cannot_reserve_more_than_available(self):
        self.api.post(
            f"/api/projects/{self.project.id}/needed-materials/",
            {"warehouse": self.warehouse_a.id, "material": self.material.id, "quantity_needed": "80"},
            format="json",
        )
        res = self.api.post(
            f"/api/projects/{self.project.id}/needed-materials/",
            {"warehouse": self.warehouse_a.id, "material": self.material.id, "quantity_needed": "30"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_warehouse_must_match_material(self):
        res = self.api.post(
            f"/api/projects/{self.project.id}/needed-materials/",
            {
                "warehouse": self.warehouse_b.id,
                "material": self.material.id,
                "quantity_needed": "10",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(
            ProjectMaterial.objects.filter(project=self.project, material=self.material).exists()
        )

    def test_taking_material_reduces_stock_and_reserved(self):
        self.api.post(
            f"/api/projects/{self.project.id}/needed-materials/",
            {"warehouse": self.warehouse_a.id, "material": self.material.id, "quantity_needed": "40"},
            format="json",
        )
        spend = self.api.post(
            f"/api/projects/{self.project.id}/spendings/",
            {"material": self.material.id, "quantity": "10"},
            format="json",
        )
        self.assertEqual(spend.status_code, 201)
        listed = self.api.get("/api/materials/")
        row = next(item for item in listed.data if item["id"] == self.material.id)
        self.assertEqual(Decimal(str(row["stock"])), Decimal("90"))
        self.assertEqual(Decimal(str(row["reserved"])), Decimal("30"))
        self.assertEqual(Decimal(str(row["available"])), Decimal("60"))

    def test_admin_can_create_warehouse_material_without_project(self):
        res = self.api.post(
            "/api/materials/",
            {
                "name": "EP99",
                "color": "RAL9001",
                "unit": "kg",
                "warehouse": self.warehouse_a.id,
                "stock": "25",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["name"], "EP99")
        self.assertEqual(res.data["warehouse"], self.warehouse_a.id)
        self.assertEqual(Decimal(str(res.data["stock"])), Decimal("25"))
        self.assertEqual(res.data["linked_projects"], [])
        self.assertTrue(
            Material.objects.filter(name="EP99", warehouse=self.warehouse_a).exists()
        )

    def test_admin_can_create_material_and_link_project(self):
        res = self.api.post(
            "/api/materials/",
            {
                "name": "EP50",
                "warehouse": self.warehouse_a.id,
                "stock": "10",
                "project": self.project.id,
                "quantity_needed": "4",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(
            ProjectMaterial.objects.filter(
                project=self.project,
                material_id=res.data["id"],
                quantity_needed=Decimal("4"),
            ).exists()
        )

    def test_worker_cannot_add_needed_material(self):
        worker = User.objects.create_user(
            username="worker-need",
            email="worker-need@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.api.force_authenticate(user=worker)
        res = self.api.post(
            f"/api/projects/{self.project.id}/needed-materials/",
            {
                "warehouse": self.warehouse_a.id,
                "material": self.material.id,
                "quantity_needed": "10",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.assertFalse(
            ProjectMaterial.objects.filter(project=self.project, material=self.material).exists()
        )

    def test_worker_cannot_create_warehouse_material(self):
        worker = User.objects.create_user(
            username="worker",
            email="worker@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.api.force_authenticate(user=worker)
        res = self.api.post(
            "/api/materials/",
            {
                "name": "EP99",
                "warehouse": self.warehouse_a.id,
                "stock": "10",
                "project": self.project.id,
                "quantity_needed": "5",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.assertFalse(Material.objects.filter(name="EP99").exists())


class DailyReportAccessTests(TestCase):
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
            first_name="Jānis",
            last_name="Roze",
        )
        self.other = User.objects.create_user(
            username="other",
            email="other@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.project = Project.objects.create(name="Atra Sistēma", status=Project.Status.IN_PROGRESS)
        self.report = DailyReport.objects.create(
            project=self.project,
            recorded_by=self.worker,
            work_date=date.today(),
            notes="Original note",
        )
        self.api = APIClient()

    def test_admin_can_retrieve_and_edit_any_report(self):
        self.api.force_authenticate(user=self.admin)
        res = self.api.get(f"/api/reports/{self.report.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("notes"), "Original note")
        res = self.api.patch(
            f"/api/reports/{self.report.id}/",
            {"notes": "Fixed by admin"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.notes, "Fixed by admin")

    def test_worker_can_retrieve_own_report_not_others(self):
        other_report = DailyReport.objects.create(
            project=self.project,
            recorded_by=self.other,
            work_date=date.today() - timedelta(days=1),
            notes="Other",
        )
        self.api.force_authenticate(user=self.worker)
        own = self.api.get(f"/api/reports/{self.report.id}/")
        self.assertEqual(own.status_code, 200)
        hidden = self.api.get(f"/api/reports/{other_report.id}/")
        self.assertEqual(hidden.status_code, 404)
        listed = self.api.get("/api/reports/")
        self.assertEqual(listed.status_code, 200)
        ids = {row["id"] for row in listed.data}
        self.assertIn(self.report.id, ids)
        self.assertNotIn(other_report.id, ids)

    def test_admin_notifications_include_report_id(self):
        self.api.force_authenticate(user=self.admin)
        res = self.api.get("/api/notifications/")
        self.assertEqual(res.status_code, 200)
        items = res.data.get("items") or []
        match = next((row for row in items if row.get("report_id") == self.report.id), None)
        self.assertIsNotNone(match)
        self.assertEqual(match.get("action"), "report_saved")
        self.assertEqual(match.get("project_id"), self.project.id)

    def test_report_saved_log_does_not_duplicate_notification(self):
        log_activity(
            self.worker,
            "report_saved",
            "report",
            self.report.id,
            f"Atskaite {self.report.work_date} · «{self.project.name}»",
        )
        self.api.force_authenticate(user=self.admin)
        res = self.api.get("/api/notifications/")
        report_items = [
            row for row in (res.data.get("items") or []) if row.get("report_id") == self.report.id
        ]
        self.assertEqual(len(report_items), 1)


class ExtraCoatAndCustomSystemTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@test.lv",
            password="pass",
            user_type=User.UserType.ADMIN,
            is_staff=True,
        )
        self.worker = User.objects.create_user(
            username="kristians",
            email="kristians@test.lv",
            password="pass",
            user_type=User.UserType.WORKER,
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.admin)
        self.warehouse = Warehouse.objects.create(name="Riga", location="Riga")
        self.ep02 = Material.objects.create(
            name="EP02 vai EP02 Color",
            color="RAL7001",
            unit="kg",
            per_m2=Decimal("0.50"),
            warehouse=self.warehouse,
            stock=Decimal("500"),
            created_by=self.admin,
        )
        self.ep11 = Material.objects.create(
            name="EP11",
            color="",
            unit="kg",
            per_m2=Decimal("2.50"),
            warehouse=self.warehouse,
            stock=Decimal("400"),
            created_by=self.admin,
        )
        self.pu23 = Material.objects.create(
            name="PU23 (matētais)",
            color="",
            unit="kg",
            per_m2=Decimal("0.10"),
            warehouse=self.warehouse,
            stock=Decimal("80"),
            created_by=self.admin,
        )
        self.extra_coat = Material.objects.create(
            name="EP50",
            color="RAL7035",
            unit="kg",
            per_m2=Decimal("0.20"),
            warehouse=self.warehouse,
            stock=Decimal("100"),
            created_by=self.admin,
        )
        self.quartz = Material.objects.create(
            name="Kvarca smilts 0.3-0.8mm",
            color="",
            unit="kg",
            per_m2=Decimal("2.00"),
            warehouse=self.warehouse,
            stock=Decimal("200"),
            created_by=self.admin,
        )

    def test_izl_extra_primer_extra_coat_and_kg_only_material(self):
        res = self.api.post(
            "/api/projects/",
            {
                "name": "IZL extra",
                "client": "IZL extra",
                "address": "Riga",
                "system": "Izlīdzinošā epoksīda sistēma",
                "assigned_to_ids": [self.worker.id],
                "total_m2": 100,
                "start_date": "2026-05-04",
                "end_date": "2026-05-15",
                "tasks": [
                    {"name": "Virsmas sagatavošana / slīpēšana", "unit": "m²", "quantity_total": 100},
                    {"name": "EP02 vai EP02 Color Grunts", "unit": "m²", "quantity_total": 100},
                    {"name": "EP02 vai EP02 Color Papildu grunts", "unit": "m²", "quantity_total": 100},
                    {"name": "EP02 vai EP02 Color 2. kārta", "unit": "m²", "quantity_total": 100},
                    {"name": "EP11 Izlīdzinošais slānis", "unit": "m²", "quantity_total": 100},
                    {"name": "PU23 (matētais) Finišs", "unit": "m²", "quantity_total": 100},
                    {"name": "EP50 Papildu", "unit": "m²", "quantity_total": 100},
                ],
                "materials": [
                    {
                        "material": self.ep02.id,
                        "name": self.ep02.name,
                        "color": self.ep02.color,
                        "quantity_needed": "150",
                        "unit": "kg",
                        "per_m2": "0.5",
                    },
                    {
                        "material": self.ep11.id,
                        "name": self.ep11.name,
                        "quantity_needed": "250",
                        "unit": "kg",
                        "per_m2": "2.5",
                    },
                    {
                        "material": self.pu23.id,
                        "name": self.pu23.name,
                        "quantity_needed": "10",
                        "unit": "kg",
                        "per_m2": "0.1",
                    },
                    {
                        "material": self.extra_coat.id,
                        "name": self.extra_coat.name,
                        "color": self.extra_coat.color,
                        "quantity_needed": "20",
                        "unit": "kg",
                        "per_m2": "0.2",
                    },
                    {
                        "material": self.quartz.id,
                        "name": self.quartz.name,
                        "quantity_needed": "50",
                        "unit": "kg",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        project_id = res.data["id"]
        names = list(
            ProjectTask.objects.filter(project_id=project_id).values_list("name", flat=True)
        )
        self.assertIn("EP02 vai EP02 Color Papildu grunts", names)
        self.assertIn("EP50 Papildu", names)
        self.assertNotIn(self.quartz.name, names)
        self.assertFalse(
            any("Kvarca" in name for name in names)
        )
        detail = self.api.get(f"/api/projects/{project_id}/")
        material_names = [
            (row.get("material_detail") or {}).get("name")
            for row in detail.data.get("needed_materials") or []
        ]
        self.assertIn(self.quartz.name, material_names)
        self.assertIn(self.extra_coat.name, material_names)

    def test_custom_system_two_coats(self):
        res = self.api.post(
            "/api/projects/",
            {
                "name": "Custom site",
                "client": "Custom site",
                "address": "Liepaja",
                "system": "Pielāgota sistēma",
                "assigned_to_ids": [self.worker.id],
                "total_m2": 80,
                "start_date": "2026-06-01",
                "end_date": "2026-06-10",
                "tasks": [
                    {"name": "Virsmas sagatavošana / slīpēšana", "unit": "m²", "quantity_total": 80},
                    {"name": "EP02 vai EP02 Color Grunts", "unit": "m²", "quantity_total": 80},
                    {"name": "EP11 Izlīdzinošais slānis", "unit": "m²", "quantity_total": 80},
                ],
                "materials": [
                    {
                        "material": self.ep02.id,
                        "name": self.ep02.name,
                        "color": self.ep02.color,
                        "quantity_needed": "40",
                        "unit": "kg",
                        "per_m2": "0.5",
                    },
                    {
                        "material": self.ep11.id,
                        "name": self.ep11.name,
                        "quantity_needed": "200",
                        "unit": "kg",
                        "per_m2": "2.5",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["system"], "Pielāgota sistēma")
        names = list(
            ProjectTask.objects.filter(project_id=res.data["id"]).order_by("sort_order").values_list("name", flat=True)
        )
        self.assertEqual(
            names,
            [
                "Virsmas sagatavošana / slīpēšana",
                "EP02 vai EP02 Color Grunts",
                "EP11 Izlīdzinošais slānis",
            ],
        )
        detail = self.api.get(f"/api/projects/{res.data['id']}/")
        material_names = [
            (row.get("material_detail") or {}).get("name")
            for row in detail.data.get("needed_materials") or []
        ]
        self.assertCountEqual(material_names, [self.ep02.name, self.ep11.name])

    def test_edit_hydrates_extra_coats(self):
        created = self.api.post(
            "/api/projects/",
            {
                "name": "Edit coats",
                "client": "Edit coats",
                "system": "Izlīdzinošā epoksīda sistēma",
                "total_m2": 50,
                "tasks": [
                    {"name": "Virsmas sagatavošana / slīpēšana", "unit": "m²", "quantity_total": 50},
                    {"name": "EP02 vai EP02 Color Grunts", "unit": "m²", "quantity_total": 50},
                ],
                "materials": [
                    {
                        "material": self.ep02.id,
                        "name": self.ep02.name,
                        "color": self.ep02.color,
                        "quantity_needed": "25",
                        "unit": "kg",
                        "per_m2": "0.5",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        project_id = created.data["id"]
        patched = self.api.patch(
            f"/api/projects/{project_id}/",
            {
                "tasks": [
                    {"name": "Virsmas sagatavošana / slīpēšana", "unit": "m²", "quantity_total": 50},
                    {"name": "EP02 vai EP02 Color Grunts", "unit": "m²", "quantity_total": 50},
                    {"name": "EP50 Papildu", "unit": "m²", "quantity_total": 50},
                ],
                "materials": [
                    {
                        "material": self.ep02.id,
                        "name": self.ep02.name,
                        "color": self.ep02.color,
                        "quantity_needed": "25",
                        "unit": "kg",
                        "per_m2": "0.5",
                    },
                    {
                        "material": self.extra_coat.id,
                        "name": self.extra_coat.name,
                        "color": self.extra_coat.color,
                        "quantity_needed": "10",
                        "unit": "kg",
                        "per_m2": "0.2",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        detail = self.api.get(f"/api/projects/{project_id}/")
        task_names = [row["name"] for row in detail.data.get("tasks") or []]
        self.assertIn("EP50 Papildu", task_names)
        self.assertIn("EP02 vai EP02 Color Grunts", task_names)
        material_names = [
            (row.get("material_detail") or {}).get("name")
            for row in detail.data.get("needed_materials") or []
        ]
        self.assertCountEqual(material_names, [self.ep02.name, self.extra_coat.name])
