from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Warehouse(models.Model):
    name = models.CharField(max_length=150)
    location = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="warehouses_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Material(models.Model):
    name = models.CharField(max_length=150)
    color = models.CharField(max_length=80, blank=True)
    unit = models.CharField(max_length=16, default="kg")
    per_m2 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="materials"
    )
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="materials_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "color"]

    def __str__(self):
        return f"{self.name} ({self.color})" if self.color else self.name


class Project(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Izveidots"
        IN_PROGRESS = "in_progress", "Procesā"
        IN_REVIEW = "in_review", "Pārbaudē"
        CLOSED = "closed", "Slēgts"
        DELETED = "deleted", "Dzēsts"

    ARCHIVED_STATUSES = (Status.CLOSED, Status.DELETED)

    name = models.CharField(max_length=200)
    client = models.CharField(max_length=200, blank=True)
    address = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="assigned_projects",
    )
    seed_key = models.CharField(max_length=64, unique=True, null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN
    )
    system = models.CharField(max_length=200, blank=True)
    color = models.CharField(max_length=16, default="#2C5F2E")
    total_m2 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    planned_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="projects_created",
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects_closed",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def schedule_start_date(self):
        if self.start_date:
            return self.start_date
        if not self.created_at:
            return None
        created = self.created_at
        if timezone.is_aware(created):
            return timezone.localtime(created).date()
        return created.date()

    def elapsed_days(self, today=None):
        start = self.schedule_start_date()
        if start is None:
            return None
        today = today or timezone.localdate()
        if today < start:
            return 0
        return (today - start).days + 1

    def overdue_days(self, today=None):
        if not self.planned_days or self.status in self.ARCHIVED_STATUSES:
            return 0
        elapsed = self.elapsed_days(today)
        if elapsed is None or elapsed <= self.planned_days:
            return 0
        return elapsed - self.planned_days

    def is_planned_overdue(self, today=None):
        return self.overdue_days(today) > 0

    def overdue_since(self):
        start = self.schedule_start_date()
        if not start or not self.planned_days:
            return None
        day = start + timedelta(days=self.planned_days)
        when = datetime.combine(day, time.min)
        tz = timezone.get_current_timezone()
        if timezone.is_naive(when):
            return timezone.make_aware(when, tz)
        return when


class ProjectMaterial(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="needed_materials"
    )
    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name="project_needs"
    )
    quantity_needed = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("project", "material")


class ProjectTask(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="tasks"
    )
    name = models.CharField(max_length=200)
    unit = models.CharField(max_length=16, default="m²")
    quantity_total = models.DecimalField(max_digits=12, decimal_places=2)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.name} @ {self.project}"


class DailyReport(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="daily_reports"
    )
    work_date = models.DateField()
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="daily_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-work_date", "-created_at"]
        unique_together = ("project", "work_date", "recorded_by")

    def __str__(self):
        return f"{self.project} {self.work_date}"


class DailyReportTask(models.Model):
    report = models.ForeignKey(
        DailyReport, on_delete=models.CASCADE, related_name="task_lines"
    )
    task = models.ForeignKey(
        ProjectTask, on_delete=models.CASCADE, related_name="report_lines"
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        unique_together = ("report", "task")


class DailyReportMaterial(models.Model):
    report = models.ForeignKey(
        DailyReport, on_delete=models.CASCADE, related_name="material_lines"
    )
    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name="report_lines"
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    spending = models.ForeignKey(
        "MaterialSpending",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="report_lines",
    )

    class Meta:
        unique_together = ("report", "material")


class Expense(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="expenses"
    )
    title = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="expenses_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class MaterialSpending(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="spendings"
    )
    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name="spendings"
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="spendings_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Job(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="jobs"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assigned_jobs",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="jobs_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["starts_at"]
        indexes = [
            models.Index(fields=["assigned_to", "starts_at"]),
        ]

    def __str__(self):
        return f"{self.project} @ {self.starts_at}"


class ToolType(models.Model):
    name = models.CharField(max_length=150, unique=True)
    icon = models.CharField(max_length=32, blank=True, default="wrench")
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="tool_types_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Tool(models.Model):
    name = models.CharField(max_length=150)
    tool_type = models.ForeignKey(
        ToolType, on_delete=models.PROTECT, related_name="tools"
    )
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="tools"
    )
    unit = models.CharField(max_length=16, default="gab")
    recommended = models.CharField(max_length=40, blank=True)
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="tools_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["tool_type__name", "name"]

    def __str__(self):
        return self.name


class ProjectTool(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="borrowed_tools"
    )
    tool = models.ForeignKey(
        Tool, on_delete=models.PROTECT, related_name="loans"
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    borrowed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="tools_borrowed",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField(null=True, blank=True)
    released_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tools_released",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tool", "released_at"], name="ops_ptool_released_idx"),
        ]

    def __str__(self):
        return f"{self.tool} × {self.quantity} @ {self.project}"


class ProjectToolCheck(models.Model):
    class Status(models.TextChoices):
        IS = "is", "IS"
        NAV = "nav", "NAV"
        NEVAJ = "nevaj", "NEVAJ"

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="tool_checks"
    )
    tool = models.ForeignKey(
        Tool, on_delete=models.PROTECT, related_name="checks"
    )
    status = models.CharField(max_length=8, choices=Status.choices)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="tool_checks_recorded",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("project", "tool")
        ordering = ["tool__tool_type__name", "tool__name"]

    def __str__(self):
        return f"{self.tool} @ {self.project}: {self.status}"


class ActivityLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="activity_logs",
    )
    action = models.CharField(max_length=40)
    entity_type = models.CharField(max_length=40)
    entity_id = models.PositiveIntegerField()
    summary = models.CharField(max_length=400)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]


class CoatingSystem(models.Model):
    code = models.CharField(max_length=16, unique=True)
    name = models.CharField(max_length=200)
    needs_color = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]

    def __str__(self):
        return f"{self.code} {self.name}"


class CoatingSystemLayer(models.Model):
    system = models.ForeignKey(
        CoatingSystem, on_delete=models.CASCADE, related_name="layers"
    )
    name = models.CharField(max_length=200)
    per_m2 = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    role = models.CharField(max_length=80, blank=True)
    optional = models.BooleanField(default=False)
    note = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.system.code} / {self.name}"


class CalendarHoliday(models.Model):
    date = models.DateField(unique=True)
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.date} {self.name}"


class CalendarSettings(models.Model):
    weekend = models.JSONField(default=list)
    work_start = models.CharField(max_length=5, default="08:00")
    work_end = models.CharField(max_length=5, default="17:00")
    break_min = models.PositiveIntegerField(default=60)
    auto_shift = models.BooleanField(default=True)
    warn_holiday = models.BooleanField(default=True)
    allow_overlap = models.BooleanField(default=False)
    confirm_delete = models.BooleanField(default=True)
    first_day = models.CharField(max_length=8, default="monday")
    color_by = models.CharField(max_length=16, default="object")
    show_initials = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "calendar settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={"weekend": ["S", "Sv"]},
        )
        return obj
