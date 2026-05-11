from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from cats.models import Cat, CoatType

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """
    Проверяет регистрацию и создаёт пользователя с хешированным паролем.
    """

    username = serializers.CharField(
        max_length=150,
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="Пользователь с таким username уже существует.",
            )
        ],
        error_messages={
            "required": "Укажите username.",
            "blank": "Username не может быть пустым.",
            "max_length": "Username не должен быть длиннее 150 символов.",
        },
    )
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        error_messages={
            "required": "Укажите пароль.",
            "blank": "Пароль не может быть пустым.",
        },
    )

    class Meta:
        model = User
        fields = (
            "public_id",
            "username",
            "password",
            "first_name",
            "last_name",
        )
        read_only_fields = ("public_id",)

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data: dict) -> User:
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    """Безопасное публичное представление пользователя."""

    class Meta:
        model = User
        fields = (
            "public_id",
            "username",
            "first_name",
            "last_name",
            "date_joined",
        )
        read_only_fields = fields


class CoatTypeSerializer(serializers.ModelSerializer):
    """
    Сериализует справочник типов шерсти из data migration.
    """

    class Meta:
        model = CoatType
        fields = ("id", "slug", "name", "sort_order")
        read_only_fields = fields


class CatSerializer(serializers.ModelSerializer):
    """
    Валидирует кота и отдаёт API-представление с UUID и age_display.
    """

    name = serializers.CharField(
        max_length=128,
        trim_whitespace=True,
        error_messages={
            "required": "Укажите имя кота.",
            "blank": "Имя кота не может быть пустым.",
            "max_length": "Имя кота не должно быть длиннее 128 символов.",
        },
    )
    age_months = serializers.IntegerField(
        min_value=0,
        max_value=480,
        error_messages={
            "required": "Укажите возраст кота в месяцах.",
            "invalid": "Возраст кота должен быть целым числом месяцев.",
            "min_value": "Возраст кота не может быть меньше 0 месяцев.",
            "max_value": "Возраст кота не может быть больше 480 месяцев.",
        },
    )
    breed = serializers.CharField(
        max_length=128,
        trim_whitespace=True,
        error_messages={
            "required": "Укажите породу кота.",
            "blank": "Порода кота не может быть пустой.",
            "max_length": "Порода кота не должна быть длиннее 128 символов.",
        },
    )
    age_display = serializers.CharField(read_only=True)
    photo_url = serializers.SerializerMethodField()
    coat_type = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=CoatType.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Указанный тип шерсти не найден.",
            "invalid": "Укажите корректный slug типа шерсти.",
        },
    )
    coat_type_detail = CoatTypeSerializer(source="coat_type", read_only=True)
    photo = serializers.ImageField(
        write_only=True,
        required=False,
        allow_null=True,
        error_messages={
            "invalid": "Загрузите корректный файл изображения.",
            "invalid_image": "Файл фото должен быть изображением.",
            "empty": "Файл фото не может быть пустым.",
        },
    )

    class Meta:
        model = Cat
        fields = (
            "public_id",
            "name",
            "age_months",
            "age_display",
            "breed",
            "coat_type",
            "coat_type_detail",
            "photo",
            "photo_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "public_id",
            "age_display",
            "photo_url",
            "created_at",
            "updated_at",
        )

    def get_photo_url(self, obj: Cat) -> str | None:
        """
        Возвращает абсолютный URL фото при наличии request в context.
        """

        if not obj.photo:
            return None
        request = self.context.get("request")
        url = obj.photo.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def validate_photo(self, value):
        """Ограничивает размер фото значением MAX_UPLOAD_SIZE_MB."""

        if not value:
            return value
        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if value.size > max_size:
            message = (
                f"Размер фото не должен превышать "
                f"{settings.MAX_UPLOAD_SIZE_MB} МБ."
            )
            raise serializers.ValidationError(message)
        return value
