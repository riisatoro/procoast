from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework import serializers
from decimal import Decimal

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
    Project,
    ProjectMaterial,
    ProjectTask,
    ProjectTool,
    ProjectToolCheck,
    Tool,
    ToolType,
    Warehouse,
)

User = get_user_model()


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "name", "initials", "email")


class WarehouseSerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = Warehouse
        fields = (
            "id",
            "name",
            "location",
            "description",
            "created_by",
            "created_at",
            "updated_at",
        )


class MaterialSerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_location = serializers.CharField(source="warehouse.location", read_only=True)

    class Meta:
        model = Material
        fields = (
            "id",
            "name",
            "color",
            "unit",
            "per_m2",
            "warehouse",
            "warehouse_name",
            "warehouse_location",
            "stock",
            "created_by",
            "created_at",
            "updated_at",
        )


class ToolTypeSerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = ToolType
        fields = (
            "id",
            "name",
            "icon",
            "description",
            "created_by",
            "created_at",
            "updated_at",
        )


class ToolSerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)
    tool_type_name = serializers.CharField(source="tool_type.name", read_only=True)
    tool_type_icon = serializers.CharField(source="tool_type.icon", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_location = serializers.CharField(source="warehouse.location", read_only=True)
    borrowed = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()

    class Meta:
        model = Tool
        fields = (
            "id",
            "name",
            "tool_type",
            "tool_type_name",
            "tool_type_icon",
            "warehouse",
            "warehouse_name",
            "warehouse_location",
            "unit",
            "recommended",
            "stock",
            "borrowed",
            "available",
            "created_by",
            "created_at",
            "updated_at",
        )

    def _borrowed(self, obj):
        qty = getattr(obj, "borrowed_qty", None)
        if qty is None:
            qty = obj.loans.filter(released_at__isnull=True).aggregate(
                total=Sum("quantity")
            )["total"] or Decimal("0")
        return Decimal(qty)

    def get_borrowed(self, obj):
        return str(self._borrowed(obj))

    def get_available(self, obj):
        return str(obj.stock - self._borrowed(obj))

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("Daudzumam jābūt vismaz 0.")
        if self.instance is not None:
            borrowed = self._borrowed(self.instance)
            if value < borrowed:
                raise serializers.ValidationError(
                    f"Krājums nevar būt mazāks par aizņemto daudzumu ({borrowed})."
                )
        return value


class ProjectToolSerializer(serializers.ModelSerializer):
    tool_detail = ToolSerializer(source="tool", read_only=True)
    borrowed_by = UserBriefSerializer(read_only=True)
    released_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = ProjectTool
        fields = (
            "id",
            "tool",
            "tool_detail",
            "quantity",
            "borrowed_by",
            "created_at",
            "released_at",
            "released_by",
        )
        read_only_fields = ("created_at", "released_at", "released_by")


class ProjectToolCheckSerializer(serializers.ModelSerializer):
    tool_detail = ToolSerializer(source="tool", read_only=True)
    recorded_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = ProjectToolCheck
        fields = (
            "id",
            "tool",
            "tool_detail",
            "status",
            "recorded_by",
            "updated_at",
        )
        read_only_fields = ("recorded_by", "updated_at")


class ToolCheckItemSerializer(serializers.Serializer):
    tool = serializers.PrimaryKeyRelatedField(queryset=Tool.objects.all())
    status = serializers.ChoiceField(choices=ProjectToolCheck.Status.choices)


class ProjectMaterialSerializer(serializers.ModelSerializer):
    material_detail = MaterialSerializer(source="material", read_only=True)

    class Meta:
        model = ProjectMaterial
        fields = ("id", "material", "material_detail", "quantity_needed")


class ExpenseSerializer(serializers.ModelSerializer):
    recorded_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = Expense
        fields = ("id", "title", "amount", "note", "recorded_by", "created_at")
        read_only_fields = ("created_at",)


class MaterialSpendingSerializer(serializers.ModelSerializer):
    recorded_by = UserBriefSerializer(read_only=True)
    material_detail = MaterialSerializer(source="material", read_only=True)

    class Meta:
        model = MaterialSpending
        fields = (
            "id",
            "material",
            "material_detail",
            "quantity",
            "recorded_by",
            "created_at",
        )
        read_only_fields = ("created_at",)


class ProjectListSerializer(serializers.ModelSerializer):
    assigned_to = UserBriefSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source="assigned_to",
        queryset=User.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    created_by = UserBriefSerializer(read_only=True)
    archive_reason = serializers.SerializerMethodField()
    tasks = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    materials = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "client",
            "address",
            "description",
            "system",
            "color",
            "total_m2",
            "start_date",
            "end_date",
            "assigned_to",
            "assigned_to_id",
            "status",
            "archive_reason",
            "created_by",
            "created_at",
            "updated_at",
            "closed_at",
            "tasks",
            "materials",
        )
        read_only_fields = ("status", "closed_at", "created_at", "updated_at", "archive_reason")
        extra_kwargs = {"name": {"required": False, "allow_blank": True}}

    def get_archive_reason(self, obj):
        if obj.status == Project.Status.DELETED:
            return "deleted"
        if obj.status == Project.Status.CLOSED:
            return "completed"
        return None


class ProjectTaskSerializer(serializers.ModelSerializer):
    quantity_done = serializers.SerializerMethodField()

    class Meta:
        model = ProjectTask
        fields = ("id", "name", "unit", "quantity_total", "sort_order", "quantity_done")
        read_only_fields = ("quantity_done",)

    def get_quantity_done(self, obj):
        qty = getattr(obj, "done_qty", None)
        if qty is None:
            qty = obj.report_lines.aggregate(total=Sum("quantity"))["total"] or Decimal("0")
        return str(qty)


class DailyReportTaskSerializer(serializers.ModelSerializer):
    task_detail = ProjectTaskSerializer(source="task", read_only=True)

    class Meta:
        model = DailyReportTask
        fields = ("id", "task", "task_detail", "quantity")


class DailyReportMaterialSerializer(serializers.ModelSerializer):
    material_detail = MaterialSerializer(source="material", read_only=True)

    class Meta:
        model = DailyReportMaterial
        fields = ("id", "material", "material_detail", "quantity")


class DailyReportSerializer(serializers.ModelSerializer):
    recorded_by = UserBriefSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all())
    project = serializers.SerializerMethodField()
    task_lines = DailyReportTaskSerializer(many=True, required=False)
    material_lines = DailyReportMaterialSerializer(many=True, required=False)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = DailyReport
        fields = (
            "id",
            "project",
            "project_id",
            "work_date",
            "notes",
            "recorded_by",
            "task_lines",
            "material_lines",
            "summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_summary(self, obj):
        parts = []
        for line in obj.task_lines.all():
            if line.quantity:
                unit = line.task.unit if line.task_id else ""
                name = line.task.name if line.task_id else ""
                parts.append(f"{line.quantity} {unit} {name}".strip())
        for line in obj.material_lines.all():
            if line.quantity:
                mat = line.material
                parts.append(f"{line.quantity} {mat.unit} {mat.name}")
        return ", ".join(parts[:4])

    def get_project(self, obj):
        p = obj.project
        return {
            "id": p.id,
            "name": p.name,
            "client": p.client,
            "address": p.address,
            "status": p.status,
            "system": p.system,
            "color": p.color,
        }


class ProjectDetailSerializer(ProjectListSerializer):
    needed_materials = ProjectMaterialSerializer(many=True, read_only=True)
    borrowed_tools = ProjectToolSerializer(many=True, read_only=True)
    tool_checks = ProjectToolCheckSerializer(many=True, read_only=True)
    expenses = ExpenseSerializer(many=True, read_only=True)
    spendings = MaterialSpendingSerializer(many=True, read_only=True)
    tasks = ProjectTaskSerializer(many=True, read_only=True)
    expenses_total = serializers.SerializerMethodField()
    spent_by_material = serializers.SerializerMethodField()
    done_m2 = serializers.SerializerMethodField()
    closed_by = UserBriefSerializer(read_only=True)

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + (
            "needed_materials",
            "borrowed_tools",
            "tool_checks",
            "expenses",
            "spendings",
            "tasks",
            "expenses_total",
            "spent_by_material",
            "done_m2",
            "closed_by",
        )

    def get_expenses_total(self, obj):
        total = sum((e.amount for e in obj.expenses.all()), Decimal("0"))
        return str(total)

    def get_spent_by_material(self, obj):
        totals = {}
        for row in obj.spendings.all():
            key = str(row.material_id)
            totals[key] = str(
                Decimal(totals.get(key, "0")) + row.quantity
            )
        return totals

    def get_done_m2(self, obj):
        tasks = list(obj.tasks.all())
        if not tasks:
            return "0"
        pcts = []
        for task in tasks:
            total = task.quantity_total or Decimal("0")
            if total <= 0:
                continue
            done = getattr(task, "done_qty", None)
            if done is None:
                done = task.report_lines.aggregate(total=Sum("quantity"))["total"] or Decimal("0")
            pcts.append(min(Decimal("1"), done / total))
        if not pcts:
            return "0"
        avg = sum(pcts) / len(pcts)
        volume = obj.total_m2 or Decimal("0")
        return str((avg * volume).quantize(Decimal("0.01")) if volume else Decimal("0"))


class ProjectBriefSerializer(serializers.ModelSerializer):
    assigned_to = UserBriefSerializer(read_only=True)

    class Meta:
        model = Project
        fields = ("id", "name", "client", "address", "status", "assigned_to", "system", "color")


class JobSerializer(serializers.ModelSerializer):
    project = ProjectBriefSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        source="project",
        queryset=Project.objects.exclude(status__in=Project.ARCHIVED_STATUSES),
    )
    assigned_to = UserBriefSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source="assigned_to",
        queryset=User.objects.filter(is_active=True),
        required=False,
    )
    created_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = Job
        fields = (
            "id",
            "project",
            "project_id",
            "assigned_to",
            "assigned_to_id",
            "starts_at",
            "ends_at",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate(self, attrs):
        project = attrs.get("project") or getattr(self.instance, "project", None)
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if project and project.status in Project.ARCHIVED_STATUSES:
            raise serializers.ValidationError(
                {"project_id": "Nevar pievienot darbu arhivētam objektam."}
            )
        if starts_at and ends_at and ends_at < starts_at:
            raise serializers.ValidationError(
                {"ends_at": "Beigu laiks nevar būt pirms sākuma."}
            )
        return attrs


class ActivityLogSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = (
            "id",
            "user",
            "action",
            "entity_type",
            "entity_id",
            "summary",
            "created_at",
        )


class CoatingSystemLayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoatingSystemLayer
        fields = ("id", "name", "per_m2", "role", "optional", "note", "sort_order")


class CoatingSystemSerializer(serializers.ModelSerializer):
    layers = CoatingSystemLayerSerializer(many=True, read_only=True)

    class Meta:
        model = CoatingSystem
        fields = ("id", "code", "name", "needs_color", "sort_order", "layers")


class CalendarHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarHoliday
        fields = ("date", "name")
        extra_kwargs = {"date": {"validators": []}}


class CalendarSettingsSerializer(serializers.Serializer):
    weekend = serializers.ListField(child=serializers.CharField(), required=False)
    work_start = serializers.CharField(required=False)
    work_end = serializers.CharField(required=False)
    break_min = serializers.IntegerField(required=False)
    auto_shift = serializers.BooleanField(required=False)
    warn_holiday = serializers.BooleanField(required=False)
    allow_overlap = serializers.BooleanField(required=False)
    confirm_delete = serializers.BooleanField(required=False)
    first_day = serializers.CharField(required=False)
    color_by = serializers.CharField(required=False)
    show_initials = serializers.BooleanField(required=False)
    holidays = CalendarHolidaySerializer(many=True, required=False)

    def to_representation(self, instance):
        holidays = CalendarHoliday.objects.all()
        return {
            "weekend": instance.weekend or ["S", "Sv"],
            "work_start": instance.work_start,
            "work_end": instance.work_end,
            "break_min": instance.break_min,
            "auto_shift": instance.auto_shift,
            "warn_holiday": instance.warn_holiday,
            "allow_overlap": instance.allow_overlap,
            "confirm_delete": instance.confirm_delete,
            "first_day": instance.first_day,
            "color_by": instance.color_by,
            "show_initials": instance.show_initials,
            "holidays": CalendarHolidaySerializer(holidays, many=True).data,
        }

    def save(self, **kwargs):
        settings = CalendarSettings.load()
        data = dict(self.validated_data)
        holidays = data.pop("holidays", None)
        for key, value in data.items():
            setattr(settings, key, value)
        settings.save()
        if holidays is not None:
            keep_dates = []
            for row in holidays:
                day = row.get("date")
                name = (row.get("name") or "").strip()
                if not day or not name:
                    continue
                CalendarHoliday.objects.update_or_create(date=day, defaults={"name": name})
                keep_dates.append(day)
            CalendarHoliday.objects.exclude(date__in=keep_dates).delete()
        return settings
