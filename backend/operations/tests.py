from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from operations.activity import log_activity
from operations.models import ActivityLog, Job, Material, MaterialSpending, NotificationRead, Project, ProjectMaterial, Warehouse

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
