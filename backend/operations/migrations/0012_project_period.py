from django.db import migrations, models
import django.db.models.deletion


def backfill_periods(apps, schema_editor):
    Project = apps.get_model("operations", "Project")
    ProjectPeriod = apps.get_model("operations", "ProjectPeriod")
    for project in Project.objects.exclude(start_date=None):
        end = project.end_date or project.start_date
        if end < project.start_date:
            end = project.start_date
        if ProjectPeriod.objects.filter(project=project).exists():
            continue
        ProjectPeriod.objects.create(
            project=project,
            start_date=project.start_date,
            end_date=end,
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("operations", "0011_notification_read"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProjectPeriod",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="periods",
                        to="operations.project",
                    ),
                ),
            ],
            options={
                "ordering": ["start_date", "id"],
            },
        ),
        migrations.RunPython(backfill_periods, noop),
    ]
