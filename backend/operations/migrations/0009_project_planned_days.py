from django.db import migrations, models


def backfill_planned_days(apps, schema_editor):
    Project = apps.get_model("operations", "Project")
    for project in Project.objects.filter(
        planned_days__isnull=True,
        start_date__isnull=False,
        end_date__isnull=False,
    ):
        days = (project.end_date - project.start_date).days + 1
        if days < 1:
            continue
        project.planned_days = days
        project.save(update_fields=["planned_days"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("operations", "0008_catalog_and_seed_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="planned_days",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_planned_days, noop),
    ]
