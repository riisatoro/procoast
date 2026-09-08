from django.conf import settings
from django.db import models


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

    name = models.CharField(max_length=200)
    client = models.CharField(max_length=200, blank=True)
    address = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assigned_projects",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN
    )
    system = models.CharField(max_length=200, blank=True)
    color = models.CharField(max_length=16, default="#2C5F2E")
    total_m2 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
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
