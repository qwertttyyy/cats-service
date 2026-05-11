import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models

from cats.utils import (
    cat_photo_upload_to,
    russian_month_word,
    russian_year_word,
)


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
