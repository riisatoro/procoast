import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime
from django.utils import timezone

from operations.models import (
    CalendarHoliday,
    CalendarSettings,
    CoatingSystem,
    CoatingSystemLayer,
    DailyReport,
    DailyReportTask,
    Job,
    Material,
    MaterialSpending,
    Project,
    ProjectMaterial,
    ProjectTask,
    Tool,
    ToolType,
    Warehouse,
)

User = get_user_model()
DUMP_PATH = Path(__file__).resolve().parents[2] / "data" / "initial_dump.json"


def dec(value, default="0"):
    if value in (None, ""):
        return Decimal(default)
    return Decimal(str(value))


def parse_dt(value):
    if not value:
        return None
    parsed = parse_datetime(str(value))
    if parsed is None:
        day = parse_date(str(value))
        if day is None:
            return None
        parsed = datetime.combine(day, datetime.min.time())
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


class Command(BaseCommand):
    help = "Load initial dump, updating existing records by natural keys"

    def add_arguments(self, parser):
        parser.add_argument("--path", default=str(DUMP_PATH))

    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.exists():
            self.stderr.write(self.style.ERROR(f"Dump not found: {path}"))
            return
        data = json.loads(path.read_text(encoding="utf-8"))
        with transaction.atomic():
            users = self.load_users(data.get("users") or [])
            warehouse = self.load_warehouse(data.get("warehouse") or {}, users)
            self.load_tools(data.get("tool_types") or [], data.get("tools") or [], warehouse, users)
            materials = self.load_materials(data.get("materials") or [], warehouse, users)
            self.load_systems(data.get("systems") or [])
            self.load_calendar(data.get("calendar") or {})
            projects = self.load_projects(data.get("projects") or [], users, materials)
            self.load_jobs(data.get("jobs") or [], projects, users)
            self.load_reports(data.get("reports") or [], projects, users)
        self.stdout.write(self.style.SUCCESS(f"Loaded dump from {path.name}"))

    def actor(self, users):
        return next((u for u in users.values() if u.user_type == "admin" or u.is_superuser), None)

    def load_users(self, rows):
        users = {}
        for row in rows:
            username = (row.get("username") or "").strip()
            email = (row.get("email") or "").strip()
            if not username or not email:
                continue
            defaults = {
                "email": email,
                "name": row.get("name") or username,
                "initials": row.get("initials") or "",
                "user_type": row.get("user_type") or "worker",
                "is_staff": row.get("user_type") == "admin",
                "is_active": True,
            }
            user, created = User.objects.update_or_create(username=username, defaults=defaults)
            if created or not user.has_usable_password():
                user.set_password(row.get("password") or "demo")
                user.save(update_fields=["password"])
            users[username] = user
            if user.initials:
                users[user.initials] = user
        for user in User.objects.filter(is_active=True):
            users.setdefault(user.username, user)
            if user.initials:
                users.setdefault(user.initials, user)
        return users

    def load_warehouse(self, row, users):
        name = (row.get("name") or "Noliktava").strip()
        warehouse, _ = Warehouse.objects.update_or_create(
            name=name,
            defaults={
                "location": row.get("location") or "",
                "description": row.get("description") or "",
                "created_by": self.actor(users),
            },
        )
        return warehouse

    def load_tools(self, types, tools, warehouse, users):
        actor = self.actor(users)
        type_map = {}
        for index, row in enumerate(types):
            name = (row.get("name") or "").strip()
            if not name:
                continue
            obj, _ = ToolType.objects.update_or_create(
                name=name,
                defaults={"icon": row.get("icon") or "wrench", "description": row.get("description") or "", "created_by": actor},
            )
            type_map[name] = obj
        for row in tools:
            name = (row.get("name") or "").strip()
            type_name = row.get("type") or row.get("tool_type")
            tool_type = type_map.get(type_name) or ToolType.objects.filter(name=type_name).first()
            if not name or not tool_type:
                continue
            Tool.objects.update_or_create(
                name=name,
                defaults={
                    "tool_type": tool_type,
                    "warehouse": warehouse,
                    "unit": row.get("unit") or "gab",
                    "recommended": row.get("recommended") or "",
                    "stock": dec(row.get("stock"), "0"),
                    "created_by": actor,
                },
            )

    def load_materials(self, rows, warehouse, users):
        actor = self.actor(users)
        materials = {}
        for row in rows:
            name = (row.get("name") or "").strip()
            color = (row.get("color") or "").strip()
            if color in {"—", "-"}:
                color = ""
            if not name:
                continue
            obj, _ = Material.objects.update_or_create(
                name=name,
                color=color,
                defaults={
                    "unit": row.get("unit") or "kg",
                    "per_m2": dec(row.get("per_m2")) if row.get("per_m2") not in (None, "") else None,
                    "warehouse": warehouse,
                    "stock": dec(row.get("stock"), "0"),
                    "created_by": actor,
                },
            )
            materials[(name.lower(), color.lower())] = obj
        return materials

    def find_material(self, materials, name, color=""):
        color = (color or "").strip()
        if color in {"—", "-"}:
            color = ""
        key = ((name or "").strip().lower(), color.lower())
        if key in materials:
            return materials[key]
        obj = Material.objects.filter(name__iexact=name or "", color__iexact=color).first()
        if obj:
            materials[key] = obj
        return obj

    def load_systems(self, rows):
        for index, row in enumerate(rows):
            code = (row.get("code") or "").strip()
            if not code:
                continue
            system, _ = CoatingSystem.objects.update_or_create(
                code=code,
                defaults={
                    "name": row.get("name") or code,
                    "needs_color": bool(row.get("needs_color")),
                    "sort_order": row.get("sort_order", index),
                },
            )
            layers = row.get("layers") or []
            keep = []
            for order, layer in enumerate(layers):
                name = (layer.get("name") or "").strip()
                if not name:
                    continue
                obj, _ = CoatingSystemLayer.objects.update_or_create(
                    system=system,
                    sort_order=order,
                    defaults={
                        "name": name,
                        "per_m2": dec(layer.get("per_m2")),
                        "role": layer.get("role") or "",
                        "optional": bool(layer.get("optional")),
                        "note": layer.get("note") or "",
                    },
                )
                keep.append(obj.id)
            CoatingSystemLayer.objects.filter(system=system).exclude(id__in=keep).delete()

    def load_calendar(self, row):
        settings = CalendarSettings.load()
        for field in (
            "weekend",
            "work_start",
            "work_end",
            "break_min",
            "auto_shift",
            "warn_holiday",
            "allow_overlap",
            "confirm_delete",
            "first_day",
            "color_by",
            "show_initials",
        ):
            if field in row and row[field] is not None:
                setattr(settings, field, row[field])
        settings.save()
        for holiday in row.get("holidays") or []:
            day = parse_date(str(holiday.get("date") or ""))
            name = (holiday.get("name") or "").strip()
            if not day or not name:
                continue
            CalendarHoliday.objects.update_or_create(date=day, defaults={"name": name})

    def load_projects(self, rows, users, materials):
        actor = self.actor(users)
        projects = {}
        for row in rows:
            key = (row.get("seed_key") or "").strip()
            if not key:
                continue
            assignee_keys = row.get("assigned_to")
            if isinstance(assignee_keys, str) or assignee_keys is None:
                assignee_keys = [assignee_keys] if assignee_keys else []
            assignees = [users[key] for key in assignee_keys if key in users]
            status = row.get("status") or Project.Status.OPEN
            closed_at = parse_dt(row.get("closed_at"))
            start_date = parse_date(str(row.get("start_date") or "")) if row.get("start_date") else None
            end_date = parse_date(str(row.get("end_date") or "")) if row.get("end_date") else None
            planned_days = int(row["planned_days"]) if row.get("planned_days") not in (None, "") else None
            if planned_days is None and start_date and end_date:
                planned_days = (end_date - start_date).days + 1
                if planned_days < 1:
                    planned_days = None
            project, _ = Project.objects.update_or_create(
                seed_key=key,
                defaults={
                    "name": row.get("name") or row.get("client") or key,
                    "client": row.get("client") or "",
                    "address": row.get("address") or "",
                    "system": row.get("system") or "",
                    "status": status,
                    "color": row.get("color") or "#2C5F2E",
                    "total_m2": dec(row.get("total_m2")) if row.get("total_m2") not in (None, "") else None,
                    "start_date": start_date,
                    "end_date": end_date,
                    "planned_days": planned_days,
                    "created_by": actor,
                    "closed_at": closed_at if status == Project.Status.CLOSED else None,
                    "closed_by": actor if status == Project.Status.CLOSED else None,
                },
            )
            for order, task in enumerate(row.get("tasks") or []):
                name = (task.get("name") or "").strip()
                if not name:
                    continue
                ProjectTask.objects.update_or_create(
                    project=project,
                    name=name,
                    defaults={
                        "unit": task.get("unit") or "m²",
                        "quantity_total": dec(task.get("quantity_total") or task.get("total")),
                        "sort_order": order,
                    },
                )
            for item in row.get("materials") or []:
                material = self.find_material(materials, item.get("name"), item.get("color"))
                if not material:
                    continue
                ProjectMaterial.objects.update_or_create(
                    project=project,
                    material=material,
                    defaults={"quantity_needed": dec(item.get("needed") or item.get("quantity_needed"))},
                )
                taken = dec(item.get("taken"), "0")
                if taken > 0:
                    spending = MaterialSpending.objects.filter(project=project, material=material).order_by("id").first()
                    if spending:
                        spending.quantity = taken
                        spending.save(update_fields=["quantity"])
                    else:
                        MaterialSpending.objects.create(
                            project=project,
                            material=material,
                            quantity=taken,
                            recorded_by=actor,
                        )
            projects[key] = project
            if assignees:
                project.assignees.set(assignees)
        return projects

    def load_jobs(self, rows, projects, users):
        actor = self.actor(users)
        for row in rows:
            project = projects.get(row.get("project"))
            person = users.get(row.get("assigned_to") or "")
            starts = parse_dt(row.get("starts_at"))
            if not project or not person or not starts:
                continue
            Job.objects.update_or_create(
                project=project,
                assigned_to=person,
                starts_at=starts,
                defaults={
                    "ends_at": parse_dt(row.get("ends_at")),
                    "created_by": actor,
                },
            )
            project.assignees.add(person)

    def load_reports(self, rows, projects, users):
        for row in rows:
            project = projects.get(row.get("project"))
            person = users.get(row.get("recorded_by") or "")
            work_date = parse_date(str(row.get("work_date") or ""))
            if not project or not person or not work_date:
                continue
            report, _ = DailyReport.objects.update_or_create(
                project=project,
                recorded_by=person,
                work_date=work_date,
                defaults={"notes": row.get("notes") or ""},
            )
            keep = []
            for line in row.get("task_lines") or []:
                task = ProjectTask.objects.filter(project=project, name=line.get("task")).first()
                if not task:
                    continue
                obj, _ = DailyReportTask.objects.update_or_create(
                    report=report,
                    task=task,
                    defaults={"quantity": dec(line.get("quantity"))},
                )
                keep.append(obj.id)
            DailyReportTask.objects.filter(report=report).exclude(id__in=keep).delete()
