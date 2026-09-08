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

from accounts.permissions import IsAdminType
from operations.models import (
    ActivityLog,
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


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(load_demo_data())


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminType]

    def get(self, request):
        start_date, end_date, start, end = _period_bounds(
            request.query_params.get("from"),
            request.query_params.get("to"),
        )
        prev_start, prev_end = _prev_bounds(start_date, end_date)
        today = timezone.localdate()
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
        active_n = open_n + progress_n + review_n

        expenses_now = _sum_amount(Expense.objects.filter(created_at__range=(start, end)))
        expenses_prev = _sum_amount(
            Expense.objects.filter(created_at__range=(prev_start, prev_end))
        )
        spendings_now = _sum_amount(
            MaterialSpending.objects.filter(created_at__range=(start, end)),
            "quantity",
        )
        jobs_now = Job.objects.filter(starts_at__range=(start, end)).count()
        jobs_prev = Job.objects.filter(starts_at__range=(prev_start, prev_end)).count()
        closed_in_period = Project.objects.filter(closed_at__range=(start, end)).count()

        tool_stock = Tool.objects.aggregate(total=Coalesce(Sum("stock"), ZERO))["total"]
        tool_borrowed = ProjectTool.objects.filter(released_at__isnull=True).aggregate(
            total=Coalesce(Sum("quantity"), ZERO)
        )["total"]
        tool_available = (tool_stock or Decimal("0")) - (tool_borrowed or Decimal("0"))

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
        spent_map = {
            row["material_id"]: row["spent"]
            for row in MaterialSpending.objects.filter(
                project__status__in=active_statuses
            )
            .values("material_id")
            .annotate(spent=Sum("quantity"))
        }
        material_usage = []
        shortages = 0
        for row in needed_rows:
            needed = row["needed"] or Decimal("0")
            spent = spent_map.get(row["material_id"]) or Decimal("0")
            stock = row["material__stock"] or Decimal("0")
            remaining = needed - spent
            if remaining > stock:
                shortages += 1
            material_usage.append(
                {
                    "id": row["material_id"],
                    "name": row["material__name"],
                    "color": row["material__color"] or "",
                    "unit": row["material__unit"],
                    "needed": _dec(needed),
                    "spent": _dec(spent),
                    "stock": _dec(stock),
                }
            )

        project_order = {
            Project.Status.IN_PROGRESS: 0,
            Project.Status.IN_REVIEW: 1,
            Project.Status.OPEN: 2,
        }
        projects = []
        for project in (
            Project.objects.exclude(status=Project.Status.CLOSED)
            .select_related("assigned_to")
            .prefetch_related("needed_materials", "spendings", "expenses", "borrowed_tools")
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
            pct = int((spent / needed * 100).quantize(Decimal("1"))) if needed else 0
            assignee = project.assigned_to
            projects.append(
                {
                    "id": project.id,
                    "name": project.name,
                    "client": project.client,
                    "address": project.address,
                    "status": project.status,
                    "assigned_to": {
                        "id": assignee.id,
                        "name": assignee.name,
                        "initials": assignee.initials,
                    }
                    if assignee
                    else None,
                    "expenses_total": _dec(expenses),
                    "materials_needed": len(need_rows),
                    "material_pct": min(100, max(0, pct)),
                    "borrowed_tools": int(borrowed),
                    "updated_at": project.updated_at.isoformat(),
                }
            )
        projects.sort(key=lambda p: (project_order.get(p["status"], 9), -p["id"]))

        today_jobs = []
        for job in (
            Job.objects.filter(
                Q(starts_at__date=today)
                | Q(starts_at__date__lte=today, ends_at__date__gte=today)
            )
            .select_related("project", "assigned_to")
            .order_by("starts_at")[:12]
        ):
            person = job.assigned_to
            today_jobs.append(
                {
                    "id": job.id,
                    "project_id": job.project_id,
                    "project": job.project.name,
                    "client": job.project.client,
                    "assigned_to": person.name if person else "",
                    "initials": person.initials if person else "",
                    "starts_at": job.starts_at.isoformat(),
                    "ends_at": job.ends_at.isoformat() if job.ends_at else None,
                }
            )

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
                },
                "projects": {
                    "open": open_n,
                    "in_progress": progress_n,
                    "in_review": review_n,
                    "closed": closed_n,
                    "active": active_n,
                    "total": active_n + closed_n,
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
                "material_usage": material_usage[:8],
                "today_jobs": today_jobs,
                "activity": ActivityLogSerializer(activity, many=True).data,
            }
        )
