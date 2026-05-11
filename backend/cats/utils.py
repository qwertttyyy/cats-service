import uuid
from pathlib import Path


def cat_photo_upload_to(instance, filename: str) -> str:
    """
    Формирует путь к фото через UUID без раскрытия исходного имени.
    """

    extension = Path(filename).suffix.lower()
    safe_extension = extension if extension and len(extension) <= 10 else ""
    owner_part = (
        str(instance.owner.public_id) if instance.owner_id else "unassigned"
    )
    return f"cats/{owner_part}/{uuid.uuid4()}{safe_extension}"


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
