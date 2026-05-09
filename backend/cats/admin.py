from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from cats.models import Cat, CoatType, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    readonly_fields = ("public_id", "date_joined", "last_login")
    list_display = (
        "username",
        "public_id",
        "first_name",
        "last_name",
        "is_staff",
        "date_joined",
    )
    search_fields = ("username", "first_name", "last_name", "public_id")


@admin.register(CoatType)
class CoatTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sort_order")
    search_fields = ("name", "slug")
    ordering = ("sort_order", "name")


@admin.register(Cat)
class CatAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "owner",
        "breed",
        "age_months",
        "coat_type",
        "created_at",
    )
    search_fields = ("name", "breed", "owner__username", "public_id")
    list_filter = ("coat_type", "created_at")
    readonly_fields = ("public_id", "created_at", "updated_at")
