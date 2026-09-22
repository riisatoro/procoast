from django.conf import settings
from django.db import migrations, models


def copy_assignees(apps, schema_editor):
    Project = apps.get_model("operations", "Project")
    Through = Project.assignees.through
    rows = []
    for project in Project.objects.exclude(assigned_to_id=None):
        rows.append(Through(project_id=project.id, user_id=project.assigned_to_id))
    if rows:
        Through.objects.bulk_create(rows, ignore_conflicts=True)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("operations", "0009_project_planned_days"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="project",
            name="assigned_to",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="assigned_projects_legacy",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="project",
            name="assignees",
            field=models.ManyToManyField(
                blank=True,
                related_name="assigned_projects",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(copy_assignees, noop),
        migrations.RemoveField(
            model_name="project",
            name="assigned_to",
        ),
    ]
