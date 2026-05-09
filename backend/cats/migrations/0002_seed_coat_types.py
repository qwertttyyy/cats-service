from django.db import migrations


COAT_TYPES = [
    ("hairless", "бесшёрстная", 10),
    ("short", "короткошёрстная", 20),
    ("semi_long", "полудлинношёрстная", 30),
    ("long", "длинношёрстная", 40),
    ("curly", "кудрявая", 50),
    ("wire", "жёсткошёрстная", 60),
]


def seed_coat_types(apps, schema_editor):
    CoatType = apps.get_model("cats", "CoatType")
    for slug, name, sort_order in COAT_TYPES:
        CoatType.objects.update_or_create(
            slug=slug,
            defaults={"name": name, "sort_order": sort_order},
        )


def unseed_coat_types(apps, schema_editor):
    CoatType = apps.get_model("cats", "CoatType")
    CoatType.objects.filter(slug__in=[slug for slug, _, _ in COAT_TYPES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("cats", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_coat_types, unseed_coat_types),
    ]
