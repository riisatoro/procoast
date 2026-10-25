from django.contrib import admin

from .models import (
    ActivityLog,
    CalendarHoliday,
    CalendarSettings,
    CoatingSystem,
    CoatingSystemLayer,
    DailyReport,
    DailyReportMaterial,
    DailyReportTask,
    Expense,
    Job,
    Material,
    MaterialSpending,
    NotificationRead,
    Project,
    ProjectMaterial,
    ProjectPeriod,
    ProjectTask,
    ProjectTool,
    ProjectToolCheck,
    Tool,
    ToolType,
    Warehouse,
)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "created_by", "created_at")
    search_fields = ("name", "location")


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("name", "color", "warehouse", "stock", "unit", "per_m2")
    list_filter = ("warehouse",)
    search_fields = ("name", "color")


@admin.register(ToolType)
class ToolTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "created_at")
    search_fields = ("name",)


@admin.register(Tool)
class ToolAdmin(admin.ModelAdmin):
    list_display = ("name", "tool_type", "warehouse", "stock", "unit", "recommended")
    list_filter = ("tool_type", "warehouse")
    search_fields = ("name",)


class ProjectMaterialInline(admin.TabularInline):
    model = ProjectMaterial
    extra = 0


class ProjectToolInline(admin.TabularInline):
    model = ProjectTool
    extra = 0
    readonly_fields = ("released_at", "released_by", "borrowed_by", "created_at")


class ProjectToolCheckInline(admin.TabularInline):
    model = ProjectToolCheck
    extra = 0
    readonly_fields = ("recorded_by", "updated_at")


class ExpenseInline(admin.TabularInline):
    model = Expense
    extra = 0


class ProjectTaskInline(admin.TabularInline):
    model = ProjectTask
    extra = 0


class ProjectPeriodInline(admin.TabularInline):
    model = ProjectPeriod
    extra = 0


class SpendingInline(admin.TabularInline):
    model = MaterialSpending
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "client",
        "status",
        "assignee_list",
        "system",
        "planned_days",
        "seed_key",
        "created_at",
        "closed_at",
    )
    list_filter = ("status",)
    search_fields = ("name", "client", "address", "system", "seed_key")
    filter_horizontal = ("assignees",)
    inlines = [
        ProjectMaterialInline,
        ProjectPeriodInline,
        ProjectTaskInline,
        ProjectToolInline,
        ProjectToolCheckInline,
        ExpenseInline,
        SpendingInline,
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("assignees")

    def assignee_list(self, obj):
        names = [person.name for person in obj.assignees.all()]
        return ", ".join(names) if names else "—"

    assignee_list.short_description = "Assignees"


@admin.register(ProjectMaterial)
class ProjectMaterialAdmin(admin.ModelAdmin):
    list_display = ("project", "material", "quantity_needed")
    list_filter = ("project",)
    search_fields = ("project__name", "material__name")


@admin.register(ProjectTask)
class ProjectTaskAdmin(admin.ModelAdmin):
    list_display = ("project", "name", "unit", "quantity_total", "sort_order")
    list_filter = ("project",)
    search_fields = ("name", "project__name")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("project", "title", "amount", "recorded_by", "created_at")
    list_filter = ("project",)
    search_fields = ("title", "project__name")


@admin.register(MaterialSpending)
class MaterialSpendingAdmin(admin.ModelAdmin):
    list_display = ("project", "material", "quantity", "recorded_by", "created_at")
    list_filter = ("project",)
    search_fields = ("project__name", "material__name")


@admin.register(ProjectTool)
class ProjectToolAdmin(admin.ModelAdmin):
    list_display = ("project", "tool", "quantity", "borrowed_by", "created_at", "released_at")
    list_filter = ("project",)
    search_fields = ("project__name", "tool__name")


@admin.register(ProjectToolCheck)
class ProjectToolCheckAdmin(admin.ModelAdmin):
    list_display = ("project", "tool", "status", "recorded_by", "updated_at")
    list_filter = ("status", "project")
    search_fields = ("project__name", "tool__name")


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "assigned_to", "starts_at", "ends_at")
    list_filter = ("assigned_to",)
    search_fields = ("project__name",)


class DailyReportTaskInline(admin.TabularInline):
    model = DailyReportTask
    extra = 0


class DailyReportMaterialInline(admin.TabularInline):
    model = DailyReportMaterial
    extra = 0


@admin.register(DailyReport)
class DailyReportAdmin(admin.ModelAdmin):
    list_display = ("work_date", "project", "recorded_by", "created_at")
    list_filter = ("work_date",)
    search_fields = ("project__name", "notes")
    inlines = [DailyReportTaskInline, DailyReportMaterialInline]


@admin.register(DailyReportTask)
class DailyReportTaskAdmin(admin.ModelAdmin):
    list_display = ("report", "task", "quantity")
    list_filter = ("report__work_date",)
    search_fields = ("task__name", "report__project__name")


@admin.register(DailyReportMaterial)
class DailyReportMaterialAdmin(admin.ModelAdmin):
    list_display = ("report", "material", "quantity", "spending")
    search_fields = ("material__name", "report__project__name")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "entity_type", "entity_id", "summary")
    list_filter = ("entity_type", "action")
    search_fields = ("summary", "entity_type", "action")


@admin.register(NotificationRead)
class NotificationReadAdmin(admin.ModelAdmin):
    list_display = ("read_at", "user", "notification_key")
    search_fields = ("notification_key", "user__username", "user__name")


class CoatingSystemLayerInline(admin.TabularInline):
    model = CoatingSystemLayer
    extra = 0


@admin.register(CoatingSystem)
class CoatingSystemAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "needs_color", "sort_order")
    search_fields = ("code", "name")
    inlines = [CoatingSystemLayerInline]


@admin.register(CoatingSystemLayer)
class CoatingSystemLayerAdmin(admin.ModelAdmin):
    list_display = ("system", "name", "role", "per_m2", "optional", "sort_order")
    list_filter = ("system", "optional")
    search_fields = ("name", "system__code", "system__name")


@admin.register(CalendarHoliday)
class CalendarHolidayAdmin(admin.ModelAdmin):
    list_display = ("date", "name")
    search_fields = ("name",)


@admin.register(CalendarSettings)
class CalendarSettingsAdmin(admin.ModelAdmin):
    list_display = ("work_start", "work_end", "first_day", "updated_at")

    def has_add_permission(self, request):
        return not CalendarSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
