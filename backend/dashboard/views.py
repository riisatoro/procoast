import json
from datetime import datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from operations.models import (
    ActivityLog,
    DailyReport,
    DailyReportMaterial,
    DailyReportTask,
    Expense,
    Job,
    Material,
    MaterialSpending,
    Project,
    ProjectMaterial,
    ProjectTool,
    Tool,
    Warehouse,
)
from operations.serializers import ActivityLogSerializer

DEMO_PATH = Path(__file__).resolve().parent / "demo_data.json"
ZERO = Value(0, output_field=DecimalField(max_digits=14, decimal_places=2))


def load_demo_data():
    with DEMO_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def _dec(value):
    if value is None:
        return "0"
    return str(value)


def _local_date(value):
    if value is None:
        return None
    if timezone.is_aware(value):
        return timezone.localtime(value).date()
    return value.date() if hasattr(value, "date") else value


def _jobs_in_period(start_date, end_date):
    return Job.objects.filter(starts_at__date__lte=end_date).filter(
        Q(ends_at__date__gte=start_date)
        | Q(ends_at__isnull=True, starts_at__date__gte=start_date)
    )


def _job_card(job):
    person = job.assigned_to
    start = _local_date(job.starts_at)
    end = _local_date(job.ends_at) or start
    return {
        "id": job.id,
        "project_id": job.project_id,
        "object_id": job.project_id,
        "project": job.project.name,
        "project_name": job.project.name,
        "client": job.project.client,
        "address": job.project.address,
        "system": job.project.system,
        "color": job.project.color,
        "assigned_to": person.name if person else "",
        "worker_name": person.name if person else "",
        "worker": person.initials if person else "",
        "initials": person.initials if person else "",
        "starts_at": job.starts_at.isoformat(),
        "ends_at": job.ends_at.isoformat() if job.ends_at else None,
        "work_date": start.isoformat() if start else None,
        "end_date": end.isoformat() if end else None,
    }


def _period_bounds(from_s, to_s):
    today = timezone.localdate()
    start_date = parse_date(from_s) if from_s else None
    end_date = parse_date(to_s) if to_s else None
    if start_date is None or end_date is None or start_date > end_date:
        start_date = today.replace(day=1)
        if today.month == 12:
            end_date = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end_date = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(start_date, time.min), tz)
    end = timezone.make_aware(datetime.combine(end_date, time.max), tz)
    return start_date, end_date, start, end


def _prev_bounds(start_date, end_date):
    length = (end_date - start_date).days + 1
    prev_end = start_date - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    tz = timezone.get_current_timezone()
    return (
        timezone.make_aware(datetime.combine(prev_start, time.min), tz),
        timezone.make_aware(datetime.combine(prev_end, time.max), tz),
    )


def _sum_amount(qs, field="amount"):
    return qs.aggregate(total=Coalesce(Sum(field), ZERO))["total"]


def _delta_pct(current, previous):
    current = Decimal(current or 0)
    previous = Decimal(previous or 0)
    if previous == 0:
        return 0 if current == 0 else 100
    return int(((current - previous) / previous * 100).quantize(Decimal("1")))


def _project_done_m2(project):
    tasks = list(project.tasks.all())
    if not tasks:
        return Decimal("0")
    pcts = []
    for task in tasks:
        total = task.quantity_total or Decimal("0")
        if total <= 0:
            continue
        done = sum((line.quantity for line in task.report_lines.all()), Decimal("0"))
        pcts.append(min(Decimal("1"), done / total))
    if not pcts:
        return Decimal("0")
    volume = project.total_m2 or Decimal("0")
    return (sum(pcts) / len(pcts) * volume).quantize(Decimal("0.01")) if volume else Decimal("0")


def _report_card(report):
    person = report.recorded_by
    parts = []
    for line in report.task_lines.all():
        if line.quantity:
            unit = line.task.unit if line.task_id else ""
            name = line.task.name if line.task_id else ""
            parts.append(f"{line.quantity} {unit} {name}".strip())
    for line in report.material_lines.all():
        if line.quantity:
            mat = line.material
            parts.append(f"{line.quantity} {mat.unit} {mat.name}")
    return {
        "id": report.id,
        "object_id": report.project_id,
        "client": report.project.client or report.project.name,
        "project_name": report.project.name,
        "address": report.project.address,
        "system": report.project.system,
        "color": report.project.color,
        "worker": person.initials if person else "",
        "worker_name": person.name if person else "",
        "notes": report.notes or "",
        "work_date": report.work_date.isoformat(),
        "tasks": [
            {
                "id": line.id,
                "name": line.task.name if line.task_id else "",
                "quantity": str(line.quantity),
                "unit": line.task.unit if line.task_id else "m²",
            }
            for line in report.task_lines.all()
            if line.quantity
        ],
        "materials": [
            {
                "id": line.id,
                "name": line.material.name,
                "color": line.material.color or "",
                "quantity": str(line.quantity),
                "unit": line.material.unit,
            }
            for line in report.material_lines.all()
            if line.quantity
        ],
        "summary": ", ".join(parts[:4]),
        "created_at": report.created_at.isoformat(),
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


def _spent_in_period(start_date, end_date, start, end):
    spent_map = {}
    report_lines = DailyReportMaterial.objects.filter(
        report__work_date__range=(start_date, end_date)
    )
    for row in report_lines.values("material_id").annotate(spent=Sum("quantity")):
        spent_map[row["material_id"]] = row["spent"] or Decimal("0")
    linked_ids = list(
        report_lines.exclude(spending_id=None).values_list("spending_id", flat=True)
    )
    warehouse_qs = MaterialSpending.objects.filter(created_at__range=(start, end))
    if linked_ids:
        warehouse_qs = warehouse_qs.exclude(id__in=linked_ids)
    for row in warehouse_qs.values("material_id").annotate(spent=Sum("quantity")):
        spent_map[row["material_id"]] = (spent_map.get(row["material_id"]) or Decimal("0")) + (
            row["spent"] or Decimal("0")
        )
    return spent_map


def _material_usage(start_date, end_date, start, end, active_statuses):
    needed_rows = list(
        ProjectMaterial.objects.filter(project__status__in=active_statuses)
        .values(
            "material_id",
            "material__name",
            "material__color",
            "material__unit",
            "material__stock",
        )
        .annotate(needed=Sum("quantity_needed"))
        .order_by("-needed")
    )
    spent_map = _spent_in_period(start_date, end_date, start, end)
    usage = []
    seen = set()
    shortages = 0
    for row in needed_rows:
        material_id = row["material_id"]
        needed = row["needed"] or Decimal("0")
        spent = spent_map.get(material_id) or Decimal("0")
        stock = row["material__stock"] or Decimal("0")
        remaining = needed - spent
        if remaining > stock:
            shortages += 1
        seen.add(material_id)
        usage.append(
            {
                "id": material_id,
                "name": row["material__name"],
                "color": row["material__color"] or "",
                "unit": row["material__unit"],
                "needed": _dec(needed),
                "spent": _dec(spent),
                "stock": _dec(stock),
            }
        )
    extra_ids = [mid for mid in spent_map if mid not in seen and spent_map[mid]]
    if extra_ids:
        extras = Material.objects.filter(id__in=extra_ids).values(
            "id", "name", "color", "unit", "stock"
        )
        extra_by_id = {row["id"]: row for row in extras}
        for material_id in extra_ids:
            row = extra_by_id.get(material_id)
            if not row:
                continue
            usage.append(
                {
                    "id": material_id,
                    "name": row["name"],
                    "color": row["color"] or "",
                    "unit": row["unit"],
                    "needed": "0",
                    "spent": _dec(spent_map[material_id]),
                    "stock": _dec(row["stock"]),
                }
            )
    usage.sort(key=lambda row: Decimal(row["needed"] or 0), reverse=True)
    return usage[:8], shortages


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(load_demo_data())


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date, end_date, start, end = _period_bounds(
            request.query_params.get("from"),
            request.query_params.get("to"),
        )
        prev_start, prev_end = _prev_bounds(start_date, end_date)
        active_statuses = (
            Project.Status.OPEN,
            Project.Status.IN_PROGRESS,
            Project.Status.IN_REVIEW,
        )

        status_counts = {
            row["status"]: row["n"]
            for row in Project.objects.values("status").annotate(n=Count("id"))
        }
        open_n = status_counts.get(Project.Status.OPEN, 0)
        progress_n = status_counts.get(Project.Status.IN_PROGRESS, 0)
        review_n = status_counts.get(Project.Status.IN_REVIEW, 0)
        closed_n = status_counts.get(Project.Status.CLOSED, 0)
        deleted_n = status_counts.get(Project.Status.DELETED, 0)
        active_n = open_n + progress_n + review_n

        expenses_now = _sum_amount(Expense.objects.filter(created_at__range=(start, end)))
        expenses_prev = _sum_amount(
            Expense.objects.filter(created_at__range=(prev_start, prev_end))
        )
        spendings_now = _sum_amount(
            MaterialSpending.objects.filter(created_at__range=(start, end)),
            "quantity",
        )
        jobs_now = _jobs_in_period(start_date, end_date).count()
        jobs_prev = _jobs_in_period(prev_start.date(), prev_end.date()).count()
        closed_in_period = Project.objects.filter(
            status=Project.Status.CLOSED, closed_at__range=(start, end)
        ).count()
        period_m2 = DailyReportTask.objects.filter(
            report__work_date__range=(start_date, end_date)
        ).aggregate(total=Coalesce(Sum("quantity"), ZERO))["total"]
        prev_m2 = DailyReportTask.objects.filter(
            report__work_date__range=(prev_start.date(), prev_end.date())
        ).aggregate(total=Coalesce(Sum("quantity"), ZERO))["total"]

        tool_stock = Tool.objects.aggregate(total=Coalesce(Sum("stock"), ZERO))["total"]
        tool_borrowed = ProjectTool.objects.filter(released_at__isnull=True).aggregate(
            total=Coalesce(Sum("quantity"), ZERO)
        )["total"]
        tool_available = (tool_stock or Decimal("0")) - (tool_borrowed or Decimal("0"))

        material_usage, shortages = _material_usage(
            start_date, end_date, start, end, active_statuses
        )

        project_order = {
            Project.Status.IN_PROGRESS: 0,
            Project.Status.IN_REVIEW: 1,
            Project.Status.OPEN: 2,
            Project.Status.CLOSED: 3,
        }
        projects = []
        total_m2 = Decimal("0")
        done_m2 = Decimal("0")
        ever_m2 = Decimal("0")
        for project in (
            Project.objects.exclude(status=Project.Status.DELETED)
            .prefetch_related(
                "assignees",
                "needed_materials",
                "spendings",
                "expenses",
                "borrowed_tools",
                "tasks__report_lines",
            )
        ):
            need_rows = list(project.needed_materials.all())
            spend_rows = list(project.spendings.all())
            expense_rows = list(project.expenses.all())
            tool_rows = list(project.borrowed_tools.all())
            needed = sum((row.quantity_needed for row in need_rows), Decimal("0"))
            spent = sum((row.quantity for row in spend_rows), Decimal("0"))
            expenses = sum((row.amount for row in expense_rows), Decimal("0"))
            borrowed = sum(
                (row.quantity for row in tool_rows if row.released_at is None),
                Decimal("0"),
            )
            volume = project.total_m2 or Decimal("0")
            finished = _project_done_m2(project)
            if project.status == Project.Status.CLOSED and volume:
                finished = volume
            total_m2 += volume
            done_m2 += finished
            ever_m2 += volume
            mat_pct = int((spent / needed * 100).quantize(Decimal("1"))) if needed else 0
            progress_pct = int((finished / volume * 100).quantize(Decimal("1"))) if volume else 0
            people = list(project.assignees.all())
            projects.append(
                {
                    "id": project.id,
                    "name": project.name,
                    "client": project.client,
                    "address": project.address,
                    "system": project.system,
                    "color": project.color,
                    "status": project.status,
                    "total_m2": _dec(volume),
                    "done_m2": _dec(finished),
                    "progress_pct": min(100, max(0, progress_pct)),
                    "planned_days": project.planned_days,
                    "elapsed_days": project.elapsed_days(),
                    "planned_days_exceeded": project.is_planned_overdue(),
                    "overdue_days": project.overdue_days() or None,
                    "assigned_to": [
                        {
                            "id": person.id,
                            "name": person.name,
                            "initials": person.initials,
                        }
                        for person in people
                    ],
                    "expenses_total": _dec(expenses),
                    "materials_needed": len(need_rows),
                    "material_pct": min(100, max(0, mat_pct)),
                    "borrowed_tools": int(borrowed),
                    "updated_at": project.updated_at.isoformat(),
                }
            )
        projects.sort(key=lambda p: (project_order.get(p["status"], 9), -p["id"]))
        deleted_m2 = Project.objects.filter(status=Project.Status.DELETED).aggregate(
            total=Coalesce(Sum("total_m2"), ZERO)
        )["total"]
        ever_m2 += deleted_m2 or Decimal("0")
        avg_progress = int((done_m2 / total_m2 * 100).quantize(Decimal("1"))) if total_m2 else 0

        today = timezone.localdate()
        period_jobs = [
            _job_card(job)
            for job in (
                _jobs_in_period(start_date, end_date)
                .select_related("project", "assigned_to")
                .order_by("starts_at", "id")[:200]
            )
        ]
        today_jobs = [
            _job_card(job)
            for job in (
                _jobs_in_period(today, today)
                .select_related("project", "assigned_to")
                .order_by("starts_at", "id")[:200]
            )
        ]
        today_reports = [
            _report_card(report)
            for report in (
                DailyReport.objects.filter(work_date=today)
                .select_related("project", "recorded_by")
                .prefetch_related("task_lines__task", "material_lines__material")
                .order_by("-updated_at")[:12]
            )
        ]

        activity = ActivityLog.objects.select_related("user").filter(
            created_at__range=(start, end)
        )[:12]

        return Response(
            {
                "period": {
                    "from": start_date.isoformat(),
                    "to": end_date.isoformat(),
                    "expenses": _dec(expenses_now),
                    "expenses_prev": _dec(expenses_prev),
                    "expenses_delta": _delta_pct(expenses_now, expenses_prev),
                    "spendings": _dec(spendings_now),
                    "jobs": jobs_now,
                    "jobs_prev": jobs_prev,
                    "jobs_delta": _delta_pct(jobs_now, jobs_prev),
                    "closed": closed_in_period,
                    "done_m2": _dec(period_m2),
                    "done_m2_prev": _dec(prev_m2),
                    "done_m2_delta": _delta_pct(period_m2, prev_m2),
                },
                "projects": {
                    "open": open_n,
                    "in_progress": progress_n,
                    "in_review": review_n,
                    "closed": closed_n,
                    "deleted": deleted_n,
                    "active": active_n,
                    "planned": open_n,
                    "total": active_n + closed_n + deleted_n,
                    "done_m2": _dec(done_m2),
                    "total_m2": _dec(total_m2),
                    "ever_m2": _dec(ever_m2),
                    "avg_progress": avg_progress,
                    "items": projects,
                },
                "inventory": {
                    "warehouses": Warehouse.objects.count(),
                    "materials": Material.objects.count(),
                    "shortages": shortages,
                    "tools": Tool.objects.count(),
                    "tools_stock": _dec(tool_stock),
                    "tools_borrowed": _dec(tool_borrowed),
                    "tools_available": _dec(tool_available),
                },
                "material_usage": material_usage,
                "period_jobs": period_jobs,
                "today_jobs": today_jobs,
                "today_reports": today_reports,
                "activity": ActivityLogSerializer(activity, many=True).data,
            }
        )
