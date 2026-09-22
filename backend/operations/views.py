from decimal import Decimal

from django.db import transaction
from django.db.models import DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminType

from .activity import log_activity
from .models import (
    ActivityLog,
    CalendarSettings,
    CoatingSystem,
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
from .serializers import (
    ActivityLogSerializer,
    CalendarSettingsSerializer,
    CoatingSystemSerializer,
    DailyReportSerializer,
    ExpenseSerializer,
    JobSerializer,
    MaterialSerializer,
    MaterialSpendingSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectMaterialSerializer,
    ProjectTaskSerializer,
    ProjectToolCheckSerializer,
    ProjectToolSerializer,
    ToolCheckItemSerializer,
    ToolSerializer,
    ToolTypeSerializer,
    WarehouseSerializer,
)


def assignee_label(project):
    names = [person.name for person in project.assignees.all() if person and person.name]
    return ", ".join(names) if names else "—"


def is_admin(user):
    return bool(
        user
        and (
            getattr(user, "user_type", None) == "admin" or getattr(user, "is_superuser", False)
        )
    )


def is_archived(project):
    return project.status in Project.ARCHIVED_STATUSES


def default_warehouse(user):
    warehouse = Warehouse.objects.order_by("id").first()
    if warehouse:
        return warehouse
    return Warehouse.objects.create(name="Noliktava", created_by=user)


def get_or_create_material(user, name, color="", unit="kg", per_m2=None):
    name = (name or "").strip()
    color = (color or "").strip()
    if color in {"—", "-"}:
        color = ""
    if not name:
        raise ValidationError({"materials": ["Materiāla nosaukums ir obligāts."]})
    warehouse = default_warehouse(user)
    material = Material.objects.filter(name__iexact=name, color__iexact=color).first()
    if material:
        updates = []
        if per_m2 is not None and material.per_m2 != per_m2:
            material.per_m2 = per_m2
            updates.append("per_m2")
        if updates:
            material.save(update_fields=updates + ["updated_at"])
        return material
    return Material.objects.create(
        name=name,
        color=color,
        unit=unit or "kg",
        per_m2=per_m2,
        warehouse=warehouse,
        created_by=user,
    )


def apply_project_blueprint(project, user, tasks_payload, materials_payload):
    if tasks_payload:
        for index, row in enumerate(tasks_payload):
            name = str(row.get("name") or "").strip()
            if not name:
                continue
            try:
                total = Decimal(str(row.get("quantity_total") or row.get("total") or 0))
            except (ArithmeticError, TypeError, ValueError):
                total = Decimal("0")
            if total <= 0 and project.total_m2:
                total = project.total_m2
            if total <= 0:
                continue
            ProjectTask.objects.create(
                project=project,
                name=name,
                unit=str(row.get("unit") or "m²"),
                quantity_total=total,
                sort_order=index,
            )
    elif project.total_m2 and project.total_m2 > 0:
        ProjectTask.objects.create(
            project=project,
            name="Virsmas sagatavošana / slīpēšana",
            unit="m²",
            quantity_total=project.total_m2,
            sort_order=0,
        )

    if not materials_payload:
        return
    for row in materials_payload:
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        try:
            qty = Decimal(str(row.get("quantity_needed") or row.get("needed") or 0))
        except (ArithmeticError, TypeError, ValueError):
            qty = Decimal("0")
        if qty <= 0:
            continue
        per_m2 = row.get("per_m2")
        try:
            per_m2 = Decimal(str(per_m2)) if per_m2 not in (None, "") else None
        except (ArithmeticError, TypeError, ValueError):
            per_m2 = None
        material = get_or_create_material(
            user,
            name,
            color=str(row.get("color") or ""),
            unit=str(row.get("unit") or "kg"),
            per_m2=per_m2,
        )
        existing, created = ProjectMaterial.objects.get_or_create(
            project=project,
            material=material,
            defaults={"quantity_needed": qty},
        )
        if not created:
            existing.quantity_needed = existing.quantity_needed + qty
            existing.save(update_fields=["quantity_needed"])


def release_open_tools(project, user):
    now = timezone.now()
    released = ProjectTool.objects.filter(project=project, released_at__isnull=True)
    count = released.count()
    released.update(released_at=now, released_by=user)
    return count


class WarehouseViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        warehouse = serializer.save(created_by=self.request.user)
        log_activity(
            self.request.user,
            "created",
            "warehouse",
            warehouse.id,
            f"Izveidota noliktava «{warehouse.name}»"
            + (f" ({warehouse.location})" if warehouse.location else ""),
        )

    def perform_update(self, serializer):
        warehouse = serializer.save()
        log_activity(
            self.request.user,
            "updated",
            "warehouse",
            warehouse.id,
            f"Labota noliktava «{warehouse.name}»",
        )


class MaterialViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Material.objects.select_related("warehouse", "created_by").prefetch_related(
        "project_needs__project"
    )
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        material = serializer.save(created_by=self.request.user)
        links = list(material.project_needs.select_related("project"))
        extra = ""
        if links:
            names = ", ".join(f"«{row.project.name}»" for row in links)
            extra = f", piesaistīts {names}"
        log_activity(
            self.request.user,
            "created",
            "material",
            material.id,
            f"Izveidots materiāls «{material}» noliktavā {material.warehouse.name}{extra}",
        )

    def perform_update(self, serializer):
        material = serializer.save()
        log_activity(
            self.request.user,
            "updated",
            "material",
            material.id,
            f"Labots materiāls «{material}» (krājums {material.stock} {material.unit})",
        )


def tool_queryset():
    borrowed_qty = Coalesce(
        Sum("loans__quantity", filter=Q(loans__released_at__isnull=True)),
        Value(0),
        output_field=DecimalField(max_digits=12, decimal_places=2),
    )
    return Tool.objects.select_related(
        "tool_type", "warehouse", "created_by"
    ).annotate(borrowed_qty=borrowed_qty)


class ToolTypeViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ToolType.objects.all()
    serializer_class = ToolTypeSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        tool_type = serializer.save(created_by=self.request.user)
        log_activity(
            self.request.user,
            "created",
            "tool_type",
            tool_type.id,
            f"Izveidots instrumentu tips «{tool_type.name}»",
        )

    def perform_update(self, serializer):
        tool_type = serializer.save()
        log_activity(
            self.request.user,
            "updated",
            "tool_type",
            tool_type.id,
            f"Labots instrumentu tips «{tool_type.name}»",
        )


class ToolViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ToolSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return tool_queryset()

    def perform_create(self, serializer):
        tool = serializer.save(created_by=self.request.user)
        tool.borrowed_qty = Decimal("0")
        log_activity(
            self.request.user,
            "created",
            "tool",
            tool.id,
            f"Izveidots instruments «{tool}» ({tool.stock} {tool.unit})",
        )

    def perform_update(self, serializer):
        tool = serializer.save()
        log_activity(
            self.request.user,
            "updated",
            "tool",
            tool.id,
            f"Labots instruments «{tool}» (daudzums {tool.stock} {tool.unit})",
        )


class ProjectViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Project.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ("retrieve", "archive"):
            return ProjectDetailSerializer
        return ProjectListSerializer

    def get_permissions(self):
        if self.action in ("create", "close", "discard", "restore", "destroy"):
            return [IsAuthenticated(), IsAdminType()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Project.objects.select_related(
            "created_by", "closed_by"
        ).prefetch_related(
            "assignees",
            "needed_materials__material__warehouse",
            "borrowed_tools__tool__tool_type",
            "borrowed_tools__tool__warehouse",
            "borrowed_tools__borrowed_by",
            "borrowed_tools__released_by",
            "tool_checks__tool__tool_type",
            "tool_checks__tool__warehouse",
            "tool_checks__recorded_by",
            "expenses__recorded_by",
            "spendings__material",
            "spendings__recorded_by",
            "tasks",
        )
        if self.action == "archive":
            return qs.filter(status__in=Project.ARCHIVED_STATUSES)
        if self.action == "list":
            return qs.exclude(status__in=Project.ARCHIVED_STATUSES)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        tasks_payload = serializer.validated_data.pop("tasks", None) or []
        materials_payload = serializer.validated_data.pop("materials", None) or []
        name = (serializer.validated_data.get("name") or "").strip()
        client = (serializer.validated_data.get("client") or "").strip()
        if not name:
            serializer.validated_data["name"] = client or "Objekts"
        if not serializer.validated_data.get("assignees"):
            serializer.validated_data["assignees"] = [user]
        project = serializer.save(
            created_by=user,
            status=Project.Status.OPEN,
        )
        apply_project_blueprint(project, user, tasks_payload, materials_payload)
        log_activity(
            user,
            "created",
            "project",
            project.id,
            f"Izveidots objekts «{project.name}», piešķirts {assignee_label(project)}",
        )

    def perform_update(self, serializer):
        if is_archived(serializer.instance):
            raise ValidationError({"detail": "Arhivētu objektu nevar labot."})
        if not self._can_work(serializer.instance):
            raise ValidationError({"detail": "Nav piekļuves šim projektam."})
        if not is_admin(self.request.user):
            serializer.validated_data.pop("assignees", None)
        serializer.validated_data.pop("tasks", None)
        serializer.validated_data.pop("materials", None)
        project = serializer.save()
        log_activity(
            self.request.user,
            "updated",
            "project",
            project.id,
            f"Labots projekts «{project.name}»",
        )

    def _can_work(self, project):
        user = self.request.user
        if is_archived(project):
            return False
        return bool(user and user.is_authenticated)

    def _ensure_open(self, project):
        if is_archived(project):
            return Response(
                {"detail": "Arhivētu objektu nevar mainīt."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    @action(detail=False, methods=["get"])
    def archive(self, request):
        serializer = ProjectDetailSerializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        if not is_admin(request.user):
            return Response({"detail": "Tikai administrators var slēgt projektu."}, status=403)
        project = self.get_object()
        blocked = self._ensure_open(project)
        if blocked:
            return blocked
        with transaction.atomic():
            now = timezone.now()
            count = release_open_tools(project, request.user)
            project.status = Project.Status.CLOSED
            project.closed_at = now
            project.closed_by = request.user
            project.save()
        summary = f"Slēgts projekts «{project.name}»"
        if count:
            summary += f", atbrīvoti {count} instrumenti"
        log_activity(
            request.user,
            "closed",
            "project",
            project.id,
            summary,
        )
        project = self.get_queryset().get(pk=project.pk)
        return Response(ProjectDetailSerializer(project).data)

    @action(detail=True, methods=["post"])
    def discard(self, request, pk=None):
        project = self.get_object()
        if project.status == Project.Status.DELETED:
            return Response({"detail": "Objekts jau ir dzēsts."}, status=400)
        with transaction.atomic():
            now = timezone.now()
            count = release_open_tools(project, request.user)
            project.status = Project.Status.DELETED
            project.closed_at = now
            project.closed_by = request.user
            project.save()
        summary = f"Dzēsts objekts «{project.name}» (arhivēts)"
        if count:
            summary += f", atbrīvoti {count} instrumenti"
        log_activity(request.user, "deleted", "project", project.id, summary)
        project = self.get_queryset().get(pk=project.pk)
        return Response(ProjectDetailSerializer(project).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        project = self.get_object()
        if project.status != Project.Status.DELETED:
            return Response({"detail": "Atjaunot var tikai dzēstus objektus."}, status=400)
        project.status = Project.Status.OPEN
        project.closed_at = None
        project.closed_by = None
        project.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])
        log_activity(
            request.user,
            "restored",
            "project",
            project.id,
            f"Atjaunots objekts «{project.name}»",
        )
        project = self.get_queryset().get(pk=project.pk)
        return Response(ProjectDetailSerializer(project).data)

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        if project.status != Project.Status.DELETED:
            return Response(
                {"detail": "Neatgriezeniski dzēst var tikai arhivētus (dzēstus) objektus."},
                status=400,
            )
        name = project.name
        pk = project.pk
        project.delete()
        log_activity(
            request.user,
            "purged",
            "project",
            pk,
            f"Neatgriezeniski dzēsts objekts «{name}»",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        project = self.get_object()
        if not self._can_work(project):
            return Response({"detail": "Nav piekļuves šim projektam."}, status=403)
        blocked = self._ensure_open(project)
        if blocked:
            return blocked
        next_status = request.data.get("status")
        allowed = {Project.Status.IN_PROGRESS, Project.Status.IN_REVIEW}
        if next_status not in allowed:
            return Response(
                {"detail": "Atļauts tikai procesā vai pārbaudē."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.status = next_status
        project.save(update_fields=["status", "updated_at"])
        label = project.get_status_display()
        log_activity(
            request.user,
            "status_changed",
            "project",
            project.id,
            f"Projekts «{project.name}» → {label}",
        )
        return Response(ProjectDetailSerializer(project).data)

    @action(detail=True, methods=["post"], url_path="needed-materials")
    def add_needed_material(self, request, pk=None):
        project = self.get_object()
        if not self._can_work(project):
            return Response({"detail": "Nav piekļuves šim projektam."}, status=403)
        blocked = self._ensure_open(project)
        if blocked:
            return blocked
        serializer = ProjectMaterialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        material = serializer.validated_data["material"]
        qty = serializer.validated_data["quantity_needed"]
        if qty <= 0:
            return Response(
                {"quantity_needed": ["Daudzumam jābūt lielākam par 0."]},
                status=400,
            )
        row, created = ProjectMaterial.objects.get_or_create(
            project=project,
            material=material,
            defaults={"quantity_needed": qty},
        )
        if not created:
            row.quantity_needed = row.quantity_needed + qty
            row.save(update_fields=["quantity_needed"])
        log_activity(
            request.user,
            "updated",
            "project",
            project.id,
            f"Projektam «{project.name}» materiāls «{material}»: vajag {row.quantity_needed} {material.unit}",
        )
        return Response(ProjectMaterialSerializer(row).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="tasks")
    def add_task(self, request, pk=None):
        project = self.get_object()
        if not self._can_work(project):
            return Response({"detail": "Nav piekļuves šim projektam."}, status=403)
        blocked = self._ensure_open(project)
        if blocked:
            return blocked
        serializer = ProjectTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        total = serializer.validated_data["quantity_total"]
        if total <= 0:
            return Response({"quantity_total": ["Daudzumam jābūt lielākam par 0."]}, status=400)
        order = project.tasks.count()
        task = serializer.save(project=project, sort_order=order)
        log_activity(
            request.user,
            "updated",
            "project",
            project.id,
            f"Projektam «{project.name}» darbs «{task.name}» ({task.quantity_total} {task.unit})",
        )
        return Response(ProjectTaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def expenses(self, request, pk=None):
        project = self.get_object()
        if not self._can_work(project):
            return Response({"detail": "Nav piekļuves šim projektam."}, status=403)
        blocked = self._ensure_open(project)
        if blocked:
            return blocked
        try:
            delta = Decimal(str(request.data.get("amount", "")).replace(",", "."))
        except (ArithmeticError, TypeError, ValueError):
            return Response({"amount": ["Nederīga summa."]}, status=400)
        if delta == 0:
            return Response({"amount": ["Summai jābūt atšķirīgai no 0."]}, status=400)

        expense_id = request.data.get("id")
        with transaction.atomic():
            if expense_id:
                try:
                    expense = Expense.objects.select_for_update().get(
                        pk=expense_id, project=project
                    )
                except Expense.DoesNotExist:
                    return Response({"detail": "Izdevums nav atrasts."}, status=404)
                new_amount = expense.amount + delta
                if new_amount < 0:
                    new_amount = Decimal("0")
                expense.amount = new_amount
                expense.save(update_fields=["amount"])
            else:
                serializer = ExpenseSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                title = serializer.validated_data["title"].strip()
                amount = serializer.validated_data["amount"]
                if amount <= 0:
                    return Response(
                        {"amount": ["Summai jābūt lielākai par 0."]},
                        status=400,
                    )
                expense = (
                    Expense.objects.select_for_update()
                    .filter(project=project, title__iexact=title)
                    .order_by("id")
                    .first()
                )
                if expense:
                    expense.amount = expense.amount + amount
                    note = serializer.validated_data.get("note") or ""
                    if note:
                        expense.note = note
                    expense.save()
                else:
                    expense = serializer.save(
                        project=project,
                        recorded_by=request.user,
                        title=title,
                    )

        log_activity(
            request.user,
            "expense_added",
            "project",
            project.id,
            f"Projektam «{project.name}» izdevums «{expense.title}»: {expense.amount} €",
        )
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def spendings(self, request, pk=None):
        project = self.get_object()
        if not self._can_work(project):
            return Response({"detail": "Nav piekļuves šim projektam."}, status=403)
        blocked = self._ensure_open(project)
        if blocked:
            return blocked
        serializer = MaterialSpendingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        material = serializer.validated_data["material"]
        quantity = serializer.validated_data["quantity"]
        if quantity == 0:
            return Response({"quantity": ["Daudzumam jābūt atšķirīgam no 0."]}, status=400)
        try:
            with transaction.atomic():
                spending = apply_material_spending(project, material, quantity, request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        if quantity > 0:
            summary = f"Projektā «{project.name}» iztērēts {quantity} {material.unit} «{material}»"
        else:
            summary = f"Projektā «{project.name}» atgriezts {abs(quantity)} {material.unit} «{material}»"
        log_activity(
            request.user,
            "spent",
            "project",
            project.id,
            summary,
        )
        return Response(MaterialSpendingSerializer(spending).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="borrow-tools")
    def borrow_tools(self, request, pk=None):
        project = self.get_object()
        if not self._can_work(project):
            return Response({"detail": "Nav piekļuves šim projektam."}, status=403)
        blocked = self._ensure_open(project)
        if blocked:
            return blocked
        serializer = ProjectToolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tool = serializer.validated_data["tool"]
        quantity = serializer.validated_data["quantity"]
        if quantity <= 0:
            return Response({"quantity": ["Daudzumam jābūt lielākam par 0."]}, status=400)
        with transaction.atomic():
            tool = Tool.objects.select_for_update().get(pk=tool.pk)
            borrowed = tool.loans.filter(released_at__isnull=True).aggregate(
                total=Sum("quantity")
            )["total"] or Decimal("0")
            available = tool.stock - borrowed
            if quantity > available:
                return Response(
                    {
                        "detail": (
                            f"Pieejams tikai {available} {tool.unit} "
                            f"(krājums {tool.stock}, aizņemts {borrowed})."
                        )
                    },
                    status=400,
                )
            row = (
                ProjectTool.objects.select_for_update()
                .filter(project=project, tool=tool, released_at__isnull=True)
                .order_by("id")
                .first()
            )
            if row:
                row.quantity = row.quantity + quantity
                row.save(update_fields=["quantity"])
            else:
                row = ProjectTool.objects.create(
                    project=project,
                    tool=tool,
                    quantity=quantity,
                    borrowed_by=request.user,
                )
        log_activity(
            request.user,
            "borrowed",
            "project",
            project.id,
            f"Projektam «{project.name}» aizņemts {quantity} {tool.unit} «{tool}»",
        )
        return Response(ProjectToolSerializer(row).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="tool-checks")
    def tool_checks(self, request, pk=None):
        project = self.get_object()
        if not self._can_work(project):
            return Response({"detail": "Nav piekļuves šim projektam."}, status=403)
        blocked = self._ensure_open(project)
        if blocked:
            return blocked
        items = request.data.get("items")
        if not isinstance(items, list):
            return Response({"items": ["Nepieciešams instrumentu saraksts."]}, status=400)
        serializer = ToolCheckItemSerializer(data=items, many=True)
        serializer.is_valid(raise_exception=True)
        errors = []
        saved = 0
        for row in serializer.validated_data:
            try:
                with transaction.atomic():
                    tool = Tool.objects.select_for_update().get(pk=row["tool"].pk)
                    apply_tool_check(project, tool, row["status"], request.user)
                saved += 1
            except ValidationError as exc:
                detail = exc.detail
                if isinstance(detail, dict):
                    detail = next(iter(detail.values()), str(exc))
                if isinstance(detail, list):
                    detail = detail[0] if detail else str(exc)
                errors.append({"tool": row["tool"].id, "detail": str(detail)})
        checks = ProjectToolCheck.objects.filter(project=project).select_related(
            "tool", "tool__tool_type", "tool__warehouse", "recorded_by"
        )
        payload = {
            "items": ProjectToolCheckSerializer(checks, many=True).data,
            "errors": errors,
        }
        log_activity(
            request.user,
            "updated",
            "project",
            project.id,
            f"Projektam «{project.name}» saglabāts instrumentu saraksts ({saved} pozīcijas)",
        )
        if errors and saved == 0:
            payload["detail"] = errors[0]["detail"]
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


def apply_tool_check(project, tool, status_code, user):
    loan = (
        ProjectTool.objects.select_for_update()
        .filter(project=project, tool=tool, released_at__isnull=True)
        .order_by("id")
        .first()
    )
    if status_code == ProjectToolCheck.Status.IS:
        if not loan:
            borrowed = tool.loans.filter(released_at__isnull=True).aggregate(
                total=Sum("quantity")
            )["total"] or Decimal("0")
            available = tool.stock - borrowed
            qty = Decimal("1")
            if qty > available:
                raise ValidationError(
                    {
                        "detail": (
                            f"«{tool}»: pieejams tikai {available} {tool.unit} "
                            f"(krājums {tool.stock}, aizņemts {borrowed})."
                        )
                    }
                )
            ProjectTool.objects.create(
                project=project,
                tool=tool,
                quantity=qty,
                borrowed_by=user,
            )
    elif loan:
        loan.released_at = timezone.now()
        loan.released_by = user
        loan.save(update_fields=["released_at", "released_by"])
    ProjectToolCheck.objects.update_or_create(
        project=project,
        tool=tool,
        defaults={"status": status_code, "recorded_by": user},
    )


class JobViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Job.objects.select_related(
            "project",
            "assigned_to",
            "created_by",
        ).prefetch_related("project__assignees")
        assigned = self.request.query_params.get("assigned_to")
        project = self.request.query_params.get("project")
        if assigned:
            qs = qs.filter(assigned_to_id=assigned)
        if project:
            qs = qs.filter(project_id=project)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        project = serializer.validated_data["project"]
        assigned = serializer.validated_data.get("assigned_to")
        if not is_admin(user):
            if is_archived(project):
                raise ValidationError({"project_id": "Nav piekļuves šim projektam."})
            assigned = user
        elif assigned is None:
            assigned = user
        job = serializer.save(created_by=user, assigned_to=assigned)
        when = timezone.localtime(job.starts_at).strftime("%Y-%m-%d %H:%M")
        log_activity(
            user,
            "created",
            "job",
            job.id,
            f"Izveidots darbs «{project.name}» ({when}), piešķirts {job.assigned_to.name}",
        )

    def perform_update(self, serializer):
        job = serializer.instance
        user = self.request.user
        if not is_admin(user) and job.assigned_to_id != user.id and job.created_by_id != user.id:
            raise ValidationError({"detail": "Nav piekļuves šim darbam."})
        project = serializer.validated_data.get("project", job.project)
        if not is_admin(user) and is_archived(project):
            raise ValidationError({"project_id": "Nav piekļuves šim projektam."})
        if not is_admin(user):
            serializer.save(assigned_to=user)
        else:
            serializer.save()
        log_activity(
            user,
            "updated",
            "job",
            job.id,
            f"Labots darbs «{job.project.name}»",
        )

    def perform_destroy(self, instance):
        user = self.request.user
        if not is_admin(user) and instance.assigned_to_id != user.id and instance.created_by_id != user.id:
            raise ValidationError({"detail": "Nav piekļuves šim darbam."})
        log_activity(
            user,
            "deleted",
            "job",
            instance.id,
            f"Dzēsts darbs «{instance.project.name}»",
        )
        instance.delete()


class ActivityLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ActivityLog.objects.select_related("user")
        user = self.request.user
        requested = self.request.query_params.get("user")
        if is_admin(user) and requested:
            return qs.filter(user_id=requested)
        if requested and str(user.id) == str(requested):
            return qs.filter(user=user)
        if is_admin(user) and not requested:
            return qs
        return qs.filter(user=user)


def apply_material_spending(project, material, quantity, user):
    quantity = Decimal(quantity)
    if quantity == 0:
        return None
    material = Material.objects.select_for_update().get(pk=material.pk)
    spent_so_far = MaterialSpending.objects.filter(
        project=project, material=material
    ).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    if quantity > 0:
        if material.stock < quantity:
            raise ValidationError(
                {"detail": f"Noliktavā nepietiek krājuma ({material.stock} {material.unit})."}
            )
        material.stock = material.stock - quantity
    else:
        if spent_so_far + quantity < 0:
            raise ValidationError(
                {
                    "detail": (
                        f"Nevar atgriezt vairāk par iztērēto ({spent_so_far} {material.unit})."
                    )
                }
            )
        material.stock = material.stock + abs(quantity)
    material.save(update_fields=["stock", "updated_at"])
    return MaterialSpending.objects.create(
        project=project,
        material=material,
        quantity=quantity,
        recorded_by=user,
    )


class DailyReportViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DailyReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = DailyReport.objects.select_related(
            "project", "recorded_by"
        ).prefetch_related(
            "task_lines__task",
            "material_lines__material__warehouse",
        )
        user = self.request.user
        project = self.request.query_params.get("project")
        work_date = self.request.query_params.get("date")
        recorded = self.request.query_params.get("recorded_by")
        from_s = self.request.query_params.get("from")
        to_s = self.request.query_params.get("to")
        if project:
            qs = qs.filter(project_id=project)
        if work_date:
            qs = qs.filter(work_date=work_date)
        if recorded:
            qs = qs.filter(recorded_by_id=recorded)
        if from_s:
            qs = qs.filter(work_date__gte=from_s)
        if to_s:
            qs = qs.filter(work_date__lte=to_s)
        if not is_admin(user):
            qs = qs.filter(recorded_by=user)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = DailyReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = serializer.validated_data["project"]
        if is_archived(project):
            return Response({"detail": "Arhivētu objektu nevar mainīt."}, status=400)
        work_date = serializer.validated_data["work_date"]
        notes = serializer.validated_data.get("notes") or ""
        task_payload = request.data.get("task_lines") or []
        material_payload = request.data.get("material_lines") or []
        try:
            with transaction.atomic():
                report, _created = DailyReport.objects.select_for_update().get_or_create(
                    project=project,
                    work_date=work_date,
                    recorded_by=request.user,
                    defaults={"notes": notes},
                )
                report.notes = notes
                report.save(update_fields=["notes", "updated_at"])
                save_report_lines(report, task_payload, material_payload, request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        report = self.get_queryset().get(pk=report.pk)
        log_activity(
            request.user,
            "report_saved",
            "report",
            report.id,
            f"Atskaite {work_date} · «{project.name}»",
        )
        return Response(DailyReportSerializer(report).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        report = self.get_object()
        user = request.user
        if not is_admin(user) and report.recorded_by_id != user.id:
            return Response({"detail": "Nav piekļuves šai atskaitei."}, status=status.HTTP_403_FORBIDDEN)
        if not is_admin(user) and is_archived(report.project):
            return Response({"detail": "Arhivētu objektu nevar mainīt."}, status=400)
        notes = request.data.get("notes", report.notes)
        if notes is None:
            notes = ""
        task_payload = request.data.get("task_lines")
        material_payload = request.data.get("material_lines")
        try:
            with transaction.atomic():
                report.notes = notes
                report.save(update_fields=["notes", "updated_at"])
                if task_payload is not None or material_payload is not None:
                    current_tasks = [
                        {"task": line.task_id, "quantity": line.quantity}
                        for line in report.task_lines.all()
                    ]
                    current_mats = [
                        {"material": line.material_id, "quantity": line.quantity}
                        for line in report.material_lines.all()
                    ]
                    save_report_lines(
                        report,
                        task_payload if task_payload is not None else current_tasks,
                        material_payload if material_payload is not None else current_mats,
                        user,
                    )
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        report = self.get_queryset().get(pk=report.pk)
        log_activity(
            user,
            "report_saved",
            "report",
            report.id,
            f"Atskaite {report.work_date} · «{report.project.name}»",
        )
        return Response(DailyReportSerializer(report).data)

    def perform_destroy(self, instance):
        user = self.request.user
        if not is_admin(user) and instance.recorded_by_id != user.id:
            raise ValidationError({"detail": "Nav piekļuves šai atskaitei."})
        with transaction.atomic():
            reverse_report_materials(instance, user)
            instance.delete()
        log_activity(
            user,
            "deleted",
            "report",
            instance.id,
            f"Dzēsta atskaite {instance.work_date} · «{instance.project.name}»",
        )


def save_report_lines(report, task_payload, material_payload, user):
    seen_tasks = set()
    for row in task_payload:
        task_id = row.get("task")
        try:
            qty = Decimal(str(row.get("quantity") or 0))
        except (ArithmeticError, TypeError, ValueError):
            continue
        if not task_id or qty < 0:
            continue
        try:
            task = ProjectTask.objects.get(pk=task_id, project=report.project)
        except ProjectTask.DoesNotExist:
            continue
        DailyReportTask.objects.update_or_create(
            report=report, task=task, defaults={"quantity": qty}
        )
        seen_tasks.add(task.id)
    DailyReportTask.objects.filter(report=report).exclude(task_id__in=seen_tasks).delete()

    existing = {
        line.material_id: line for line in report.material_lines.select_related("material")
    }
    seen_mats = set()
    for row in material_payload:
        mat_id = row.get("material")
        try:
            qty = Decimal(str(row.get("quantity") or 0))
        except (ArithmeticError, TypeError, ValueError):
            continue
        if not mat_id or qty < 0:
            continue
        try:
            material = Material.objects.get(pk=mat_id)
        except Material.DoesNotExist:
            continue
        prev = existing.get(material.id)
        old_qty = prev.quantity if prev else Decimal("0")
        delta = qty - old_qty
        spending = prev.spending if prev else None
        if delta:
            spending = apply_material_spending(report.project, material, delta, user)
        DailyReportMaterial.objects.update_or_create(
            report=report,
            material=material,
            defaults={"quantity": qty, "spending": spending},
        )
        seen_mats.add(material.id)
    for mat_id, line in existing.items():
        if mat_id in seen_mats:
            continue
        if line.quantity:
            apply_material_spending(report.project, line.material, -line.quantity, user)
        line.delete()


def reverse_report_materials(report, user):
    for line in report.material_lines.select_related("material"):
        if line.quantity:
            apply_material_spending(report.project, line.material, -line.quantity, user)


def overdue_schedule_items(user):
    qs = (
        Project.objects.exclude(status__in=Project.ARCHIVED_STATUSES)
        .filter(planned_days__isnull=False)
        .prefetch_related("assignees")
    )
    if not is_admin(user):
        qs = qs.filter(assignees=user)
    items = []
    for project in qs:
        overdue = project.overdue_days()
        if overdue <= 0:
            continue
        elapsed = project.elapsed_days() or 0
        since = project.overdue_since() or project.updated_at or timezone.now()
        items.append(
            {
                "id": f"overdue-{project.id}",
                "kind": "info",
                "icon": "clock",
                "code": "planned_days_exceeded",
                "title": f"Pārsniegts plānotais termiņš: {project.name}",
                "sub": (
                    f"Informācija · #{project.id} · plānotas {project.planned_days} d., "
                    f"pagājušas {elapsed} d."
                ),
                "created_at": since.isoformat(),
                "unread": True,
                "source": "schedule",
                "project_id": project.id,
                "project_name": project.name,
                "planned_days": project.planned_days,
                "elapsed_days": elapsed,
                "overdue_days": overdue,
            }
        )
    items.sort(key=lambda row: row["created_at"], reverse=True)
    return items


class NotificationsViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ActivityLogSerializer

    def list(self, request, *args, **kwargs):
        user = request.user
        items = []
        logs = ActivityLog.objects.select_related("user").all().order_by("-created_at")
        if not is_admin(user):
            logs = logs.filter(user=user)
        for log in logs[:20]:
            kind, icon = notif_style(log.action)
            items.append(
                {
                    "id": f"log-{log.id}",
                    "kind": kind,
                    "icon": icon,
                    "title": log.summary,
                    "sub": log.user.name if log.user else "",
                    "created_at": log.created_at.isoformat(),
                    "unread": True,
                    "source": "activity",
                    "action": log.action,
                    **notif_entity_refs(log),
                }
            )
        if is_admin(user):
            for check in (
                ProjectToolCheck.objects.filter(status=ProjectToolCheck.Status.NAV)
                .select_related("project", "tool")
                .order_by("-updated_at")[:8]
            ):
                items.append(
                    {
                        "id": f"nav-{check.id}",
                        "kind": "danger",
                        "icon": "x",
                        "title": f"Trūkstošs instruments: {check.tool.name}",
                        "sub": f"#{check.project_id} {check.project.name}",
                        "created_at": check.updated_at.isoformat(),
                        "unread": True,
                        "source": "tool",
                        "project_id": check.project_id,
                    }
                )
        items.sort(key=lambda row: row["created_at"], reverse=True)
        merged = overdue_schedule_items(user) + items
        clipped = merged[:24]
        return Response({"items": clipped, "unread": len(clipped)})


def notif_entity_refs(log):
    refs = {
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
    }
    if log.entity_type == "project":
        refs["project_id"] = log.entity_id
    if log.action != "report_saved":
        return refs
    if log.entity_type == "report":
        refs["report_id"] = log.entity_id
        return refs
    if log.entity_type == "project" and log.user_id:
        day = timezone.localtime(log.created_at).date()
        found = (
            DailyReport.objects.filter(
                project_id=log.entity_id,
                recorded_by_id=log.user_id,
                work_date=day,
            )
            .order_by("-updated_at")
            .first()
        )
        if found:
            refs["report_id"] = found.id
    return refs


def notif_style(action):
    mapping = {
        "report_saved": ("green", "check"),
        "spent": ("green", "package"),
        "created": ("default", "calendar"),
        "borrowed": ("default", "wrench"),
        "closed": ("green", "archive"),
        "deleted": ("danger", "trash"),
    }
    return mapping.get(action, ("default", "bell"))


class CoatingSystemViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = CoatingSystem.objects.prefetch_related("layers")
    serializer_class = CoatingSystemSerializer
    permission_classes = [IsAuthenticated]


class CalendarSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsAuthenticated(), IsAdminType()]
        return [IsAuthenticated()]

    def get(self, request):
        return Response(CalendarSettingsSerializer().to_representation(CalendarSettings.load()))

    def put(self, request):
        serializer = CalendarSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        settings = serializer.save()
        return Response(CalendarSettingsSerializer().to_representation(settings))
