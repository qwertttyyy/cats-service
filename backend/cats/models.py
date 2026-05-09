import uuid
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.text import slugify


class User(AbstractUser):
    """Пользователь-заводчик с публичным UUID для API и WebSocket-сообщений."""

    public_id = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False, db_index=True
    )

    class Meta:
        ordering = ["-date_joined"]


class CoatType(models.Model):
    """
    Справочник типов шерсти кошек без пользовательского редактирования.
    """

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


def cat_photo_upload_to(instance: "Cat", filename: str) -> str:
    """
    Формирует путь к фото через UUID без раскрытия исходного имени.
    """

    extension = Path(filename).suffix.lower()
    safe_extension = extension if extension and len(extension) <= 10 else ""
    owner_part = (
        slugify(str(instance.owner.public_id))
        if instance.owner_id
        else "unassigned"
    )
    return f"cats/{owner_part}/{uuid.uuid4()}{safe_extension}"


class Cat(models.Model):
    """
    Кот заводчика: внутренний id остаётся в БД.
    """

    public_id = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False, db_index=True
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cats"
    )
    name = models.CharField(max_length=128)
    age_months = models.PositiveSmallIntegerField()
    breed = models.CharField(max_length=128)
    coat_type = models.ForeignKey(
        CoatType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cats",
    )
    photo = models.ImageField(
        upload_to=cat_photo_upload_to, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name

    @property
    def age_display(self) -> str:
        """Возвращает человекочитаемый возраст на русском: годы и месяцы."""

        years, months = divmod(self.age_months, 12)
        parts = []
        if years:
            parts.append(f"{years} {russian_year_word(years)}")
        if months or not parts:
            parts.append(f"{months} {russian_month_word(months)}")
        return " ".join(parts)


def russian_year_word(value: int) -> str:
    """Подбирает правильную форму слова 'год' для русского языка."""

    if 11 <= value % 100 <= 14:
        return "лет"
    if value % 10 == 1:
        return "год"
    if 2 <= value % 10 <= 4:
        return "года"
    return "лет"


def russian_month_word(value: int) -> str:
    """Подбирает правильную форму слова 'месяц' для русского языка."""

    if 11 <= value % 100 <= 14:
        return "месяцев"
    if value % 10 == 1:
        return "месяц"
    if 2 <= value % 10 <= 4:
        return "месяца"
    return "месяцев"
