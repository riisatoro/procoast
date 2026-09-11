from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("operations", "0007_project_deleted_and_optional_assignee"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="seed_key",
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
        migrations.CreateModel(
            name="CoatingSystem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=16, unique=True)),
                ("name", models.CharField(max_length=200)),
                ("needs_color", models.BooleanField(default=False)),
                ("sort_order", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["sort_order", "code"]},
        ),
        migrations.CreateModel(
            name="CoatingSystemLayer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("per_m2", models.DecimalField(decimal_places=3, default=0, max_digits=10)),
                ("role", models.CharField(blank=True, max_length=80)),
                ("optional", models.BooleanField(default=False)),
                ("note", models.CharField(blank=True, max_length=255)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                (
                    "system",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="layers",
                        to="operations.coatingsystem",
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="CalendarHoliday",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(unique=True)),
                ("name", models.CharField(max_length=200)),
            ],
            options={"ordering": ["date"]},
        ),
        migrations.CreateModel(
            name="CalendarSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("weekend", models.JSONField(default=list)),
                ("work_start", models.CharField(default="08:00", max_length=5)),
                ("work_end", models.CharField(default="17:00", max_length=5)),
                ("break_min", models.PositiveIntegerField(default=60)),
                ("auto_shift", models.BooleanField(default=True)),
                ("warn_holiday", models.BooleanField(default=True)),
                ("allow_overlap", models.BooleanField(default=False)),
                ("confirm_delete", models.BooleanField(default=True)),
                ("first_day", models.CharField(default="monday", max_length=8)),
                ("color_by", models.CharField(default="object", max_length=16)),
                ("show_initials", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"verbose_name_plural": "calendar settings"},
        ),
    ]
