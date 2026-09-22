import csv
import io
from datetime import datetime, time, timedelta
from decimal import Decimal
from urllib.parse import quote

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from operations.models import ActivityLog, CalendarSettings, DailyReportTask, Job

from .views import _period_bounds

User = get_user_model()

EXPORT_TYPES = ("activity", "hours", "m2")

HEADERS = {
    "lv": {
        "activity": [
            "Datums",
            "Laiks",
            "Darbinieks",
            "Iniciāļi",
            "Darbība",
            "Entitāte",
            "ID",
            "Kopsavilkums",
        ],
        "hours": [
            "Datums",
            "Darbinieks",
            "Iniciāļi",
            "Stundas",
            "Objekts ID",
            "Objekts",
            "Klients",
        ],
        "m2": [
            "Gads",
            "Mēnesis",
            "Darbinieks",
            "Iniciāļi",
            "Objekts ID",
            "Objekts",
            "Klients",
            "m²",
        ],
    },
    "en": {
        "activity": [
            "Date",
            "Time",
            "Employee",
            "Initials",
            "Action",
            "Entity",
            "ID",
            "Summary",
        ],
        "hours": [
            "Date",
            "Employee",
            "Initials",
            "Hours",
            "Site ID",
            "Site",
            "Client",
        ],
        "m2": [
            "Year",
            "Month",
            "Employee",
            "Initials",
            "Site ID",
            "Site",
            "Client",
            "m²",
        ],
    },
}

FILENAMES = {
    "lv": {"activity": "aktivitate", "hours": "stundas", "m2": "m2-menesi"},
    "en": {"activity": "activity", "hours": "hours", "m2": "m2-monthly"},
}


def _is_admin(user):
    return bool(
        user
        and (getattr(user, "user_type", None) == "admin" or getattr(user, "is_superuser", False))
    )


def _lang(request):
    raw = (request.query_params.get("lang") or "lv").lower()
    return "en" if raw.startswith("en") else "lv"


def _parse_hhmm(value, fallback):
    text = (value or fallback or "08:00").strip()
    parts = text.split(":")
    try:
        hour = max(0, min(23, int(parts[0])))
        minute = max(0, min(59, int(parts[1]))) if len(parts) > 1 else 0
    except (TypeError, ValueError):
        hour, minute = (8, 0) if fallback == "08:00" else (17, 0)
    return hour, minute


def _work_hours_length(settings):
    sh, sm = _parse_hhmm(settings.work_start, "08:00")
    eh, em = _parse_hhmm(settings.work_end, "17:00")
    minutes = eh * 60 + em - (sh * 60 + sm) - int(settings.break_min or 0)
    return max(0, round(minutes / 6) / 10)


def _local_date(dt):
    if dt is None:
        return None
    if timezone.is_aware(dt):
        return timezone.localtime(dt).date()
    return dt.date()


def _aware(day, hour, minute, tz):
    naive = datetime.combine(day, time(hour, minute))
    if timezone.is_naive(naive):
        return timezone.make_aware(naive, tz)
    return naive


def _hours_on_day(job, day, default_h, work_start, work_end, tz):
    start_day = _local_date(job.starts_at)
    end_day = _local_date(job.ends_at) if job.ends_at else start_day
    if start_day is None or day < start_day or day > end_day:
        return Decimal("0")
    starts = timezone.localtime(job.starts_at) if timezone.is_aware(job.starts_at) else job.starts_at
    if start_day == end_day:
        if job.ends_at:
            ends = timezone.localtime(job.ends_at) if timezone.is_aware(job.ends_at) else job.ends_at
            hours = (ends - starts).total_seconds() / 3600
            return Decimal(str(max(0, round(hours, 1))))
        return Decimal(str(default_h))
    sh, sm = _parse_hhmm(work_start, "08:00")
    eh, em = _parse_hhmm(work_end, "17:00")
    if day == start_day:
        hours = (_aware(day, eh, em, tz) - starts).total_seconds() / 3600
        return Decimal(str(max(0.5, round(hours, 1))))
    if day == end_day and job.ends_at:
        ends = timezone.localtime(job.ends_at) if timezone.is_aware(job.ends_at) else job.ends_at
        hours = (ends - _aware(day, sh, sm, tz)).total_seconds() / 3600
        return Decimal(str(max(0.5, round(hours, 1))))
    return Decimal(str(default_h))


def _csv_response(kind, lang, start_date, end_date, rows):
    slug = FILENAMES.get(lang, FILENAMES["lv"]).get(kind, kind)
    filename = f"procoast-{slug}-{start_date.isoformat()}_{end_date.isoformat()}.csv"
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(HEADERS[lang][kind])
    writer.writerows(rows)
    payload = "\ufeff" + buffer.getvalue()
    response = HttpResponse(payload.encode("utf-8"), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = (
        f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}"
    )
    return response


def _scoped_user_ids(request):
    requested = request.query_params.get("user")
    if requested:
        try:
            uid = int(requested)
        except (TypeError, ValueError):
            return None, Response({"detail": "Nederīgs lietotājs."}, status=400)
        if not _is_admin(request.user) and uid != request.user.id:
            return None, Response({"detail": "Nav piekļuves šim eksportam."}, status=403)
        if not User.objects.filter(pk=uid).exists():
            return None, Response({"detail": "Lietotājs nav atrasts."}, status=404)
        return [uid], None
    if _is_admin(request.user):
        return None, None
    return [request.user.id], None


def _activity_rows(start, end, user_ids):
    qs = ActivityLog.objects.select_related("user").filter(created_at__range=(start, end))
    if user_ids is not None:
        qs = qs.filter(user_id__in=user_ids)
    rows = []
    for log in qs.order_by("created_at", "id"):
        when = timezone.localtime(log.created_at) if timezone.is_aware(log.created_at) else log.created_at
        person = log.user
        rows.append(
            [
                when.strftime("%Y-%m-%d"),
                when.strftime("%H:%M"),
                person.name if person else "",
                person.initials if person else "",
                log.action,
                log.entity_type,
                log.entity_id,
                log.summary,
            ]
        )
    return rows


def _hours_rows(start_date, end_date, user_ids):
    settings = CalendarSettings.load()
    default_h = _work_hours_length(settings)
    tz = timezone.get_current_timezone()
    jobs = Job.objects.select_related("assigned_to", "project").filter(starts_at__date__lte=end_date)
    jobs = jobs.filter(Q(ends_at__date__gte=start_date) | Q(ends_at__isnull=True, starts_at__date__gte=start_date))
    if user_ids is not None:
        jobs = jobs.filter(assigned_to_id__in=user_ids)
    rows = []
    for job in jobs.order_by("starts_at", "id"):
        person = job.assigned_to
        project = job.project
        day = max(_local_date(job.starts_at), start_date)
        last = min((_local_date(job.ends_at) or _local_date(job.starts_at)), end_date)
        while day <= last:
            hours = _hours_on_day(
                job, day, default_h, settings.work_start, settings.work_end, tz
            )
            if hours > 0:
                rows.append(
                    [
                        day.isoformat(),
                        person.name if person else "",
                        person.initials if person else "",
                        f"{hours:.1f}",
                        project.id,
                        project.name,
                        project.client or "",
                    ]
                )
            day += timedelta(days=1)
    rows.sort(key=lambda row: (row[0], row[1], row[4]))
    return rows


def _m2_rows(start_date, end_date, user_ids):
    qs = DailyReportTask.objects.select_related(
        "report__recorded_by", "report__project", "task"
    ).filter(report__work_date__range=(start_date, end_date))
    if user_ids is not None:
        qs = qs.filter(report__recorded_by_id__in=user_ids)
    totals = {}
    for line in qs:
        qty = line.quantity or Decimal("0")
        if qty == 0:
            continue
        report = line.report
        person = report.recorded_by
        project = report.project
        key = (
            report.work_date.year,
            report.work_date.month,
            person.id if person else 0,
            project.id,
        )
        if key not in totals:
            totals[key] = {
                "year": report.work_date.year,
                "month": report.work_date.month,
                "name": person.name if person else "",
                "initials": person.initials if person else "",
                "project_id": project.id,
                "project": project.name,
                "client": project.client or "",
                "m2": Decimal("0"),
            }
        totals[key]["m2"] += qty
    rows = []
    for item in sorted(totals.values(), key=lambda r: (r["year"], r["month"], r["name"], r["project_id"])):
        rows.append(
            [
                item["year"],
                f"{item['month']:02d}",
                item["name"],
                item["initials"],
                item["project_id"],
                item["project"],
                item["client"],
                str(item["m2"].quantize(Decimal("0.01"))),
            ]
        )
    return rows


class ExportCsvView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        kind = (request.query_params.get("type") or "").strip().lower()
        if kind not in EXPORT_TYPES:
            return Response(
                {"detail": "Norādi eksportu: activity, hours vai m2."},
                status=400,
            )
        start_date, end_date, start, end = _period_bounds(
            request.query_params.get("from"),
            request.query_params.get("to"),
        )
        user_ids, error = _scoped_user_ids(request)
        if error:
            return error
        lang = _lang(request)
        if kind == "activity":
            rows = _activity_rows(start, end, user_ids)
        elif kind == "hours":
            rows = _hours_rows(start_date, end_date, user_ids)
        else:
            rows = _m2_rows(start_date, end_date, user_ids)
        return _csv_response(kind, lang, start_date, end_date, rows)
