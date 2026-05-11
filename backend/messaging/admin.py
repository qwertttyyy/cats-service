from django.contrib import admin

from messaging.models import Chat, ChatMessage


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = (
        "public_id",
        "participant_one",
        "participant_two",
    )
    search_fields = (
        "public_id",
        "participant_one__username",
        "participant_two__username",
    )
    readonly_fields = (
        "public_id",
        "participant_one",
        "participant_two",
    )


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "chat", "sender", "recipient", "sent_at")
    list_filter = ("sent_at",)
    search_fields = (
        "chat__public_id",
        "sender__username",
        "recipient__username",
        "text",
    )
    readonly_fields = ("chat", "sender", "recipient", "text", "sent_at")
