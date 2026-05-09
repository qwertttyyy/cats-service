from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from cats.views import (
    BreederListView,
    CatViewSet,
    CoatTypeViewSet,
    CurrentUserView,
    RegisterView,
)

router = DefaultRouter()
router.register("cats", CatViewSet, basename="cat")
router.register("coat-types", CoatTypeViewSet, basename="coat-type")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/token/", TokenObtainPairView.as_view(), name="token-obtain"),
    path(
        "auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"
    ),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("users/me/", CurrentUserView.as_view(), name="users-me"),
    path("breeders/", BreederListView.as_view(), name="breeders"),
]
