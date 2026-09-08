from django.contrib import admin

from .models import (
    ActivityLog,
    DailyReport,
    Expense,
    Job,
    Material,
    MaterialSpending,
    Project,
    ProjectMaterial,
    ProjectTask,
    ProjectTool,
    ProjectToolCheck,
    Tool,
    ToolType,
    Warehouse,
)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "created_at")


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("name", "color", "warehouse", "stock", "unit")
    list_filter = ("warehouse",)


@admin.register(ToolType)
class ToolTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "created_at")


@admin.register(Tool)
class ToolAdmin(admin.ModelAdmin):
    list_display = ("name", "tool_type", "warehouse", "stock", "unit", "recommended")
    list_filter = ("tool_type", "warehouse")


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


class SpendingInline(admin.TabularInline):
    model = MaterialSpending
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "assigned_to", "system", "created_at", "closed_at")
    list_filter = ("status",)
    inlines = [
        ProjectMaterialInline,
        ProjectTaskInline,
        ProjectToolInline,
        ProjectToolCheckInline,
        ExpenseInline,
        SpendingInline,
    ]


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "assigned_to", "starts_at", "ends_at")
    list_filter = ("assigned_to",)


@admin.register(DailyReport)
class DailyReportAdmin(admin.ModelAdmin):
    list_display = ("work_date", "project", "recorded_by", "created_at")
    list_filter = ("work_date",)


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "entity_type", "summary")
    list_filter = ("entity_type", "action")
