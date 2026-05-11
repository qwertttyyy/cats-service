import logging

from django.contrib.auth import get_user_model
from django.db.models import Q
from drf_spectacular.utils import extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.generics import CreateAPIView, ListAPIView, RetrieveAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny

from cats.models import Cat, CoatType
from cats.schemas import cat_view_schema
from cats.serializers import (
    CatSerializer,
    CoatTypeSerializer,
    RegisterSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


class RegisterView(CreateAPIView):
    """Регистрация заводчика по username и password."""

    serializer_class = RegisterSerializer
    permission_classes = (AllowAny,)

    def perform_create(self, serializer):
        user = serializer.save()
        logger.info(
            f"Registered user username={user.username} "
            f"public_id={user.public_id}"
        )


class CurrentUserView(RetrieveAPIView):
    """Возвращает текущего пользователя по JWT."""

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class BreederListView(ListAPIView):
    """
    Список заводчиков с поиском и limit/offset пагинацией.
    """

    serializer_class = UserSerializer

    def get_queryset(self):
        """Ищет заводчиков по username, first_name и last_name."""

        queryset = (
            User.objects.filter(is_active=True)
            .exclude(pk=self.request.user.pk)
            .exclude(Q(is_superuser=True) | Q(is_staff=True))
            .order_by("-date_joined")
        )
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        return queryset


class CoatTypeViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Возвращает список типов шерсти кошек."""

    queryset = CoatType.objects.all()
    serializer_class = CoatTypeSerializer


@extend_schema_view(**cat_view_schema)
class CatViewSet(viewsets.ModelViewSet):
    """CRUD по котам текущего пользователя."""

    serializer_class = CatSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    lookup_field = "public_id"
    lookup_url_kwarg = "public_id"

    def get_queryset(self):
        """Получает список котов пользователя."""

        return (
            Cat.objects.filter(owner_id=self.request.user.pk)
            .select_related("coat_type", "owner")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        cat = serializer.save(owner=self.request.user)
        logger.info(
            f"Created cat public_id={cat.public_id} "
            f"owner_id={self.request.user.id}"
        )

    def perform_update(self, serializer):
        cat = serializer.save()
        logger.info(
            f"Updated cat public_id={cat.public_id} "
            f"owner_id={self.request.user.id}"
        )

    def perform_destroy(self, instance):
        logger.info(
            f"Deleted cat public_id={instance.public_id} "
            f"owner_id={self.request.user.id}"
        )
        instance.delete()
