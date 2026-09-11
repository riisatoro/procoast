from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    dependencies = [
        ("operations", "0006_daily_reports"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="project",
            name="status",
            field=models.CharField(
                choices=[
                    ("open", "Izveidots"),
                    ("in_progress", "Procesā"),
                    ("in_review", "Pārbaudē"),
                    ("closed", "Slēgts"),
                    ("deleted", "Dzēsts"),
                ],
                default="open",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="project",
            name="assigned_to",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_projects",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
