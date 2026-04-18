"""File-level validators for uploaded images and documents."""
from __future__ import annotations

MAX_IMAGE_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_CSV_BYTES = 10 * 1024 * 1024    # 10 MB

# Magic bytes for allowed image formats
_MAGIC: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png":  b"\x89PNG",
}

ALLOWED_IMAGE_MIME = set(_MAGIC.keys())
ALLOWED_CSV_EXTENSIONS = {".csv", ".xlsx"}


def validate_image_file(content: bytes, filename: str) -> None:
    """Raise ValueError if content is not a valid JPEG/PNG within size limit."""
    if len(content) > MAX_IMAGE_BYTES:
        raise ValueError(
            f"Image exceeds 5 MB limit ({len(content) / 1_048_576:.1f} MB)"
        )
    for mime, magic in _MAGIC.items():
        if content.startswith(magic):
            return
    raise ValueError(
        f"File {filename!r} does not appear to be a JPEG or PNG "
        f"(magic bytes mismatch)"
    )


def validate_csv_file(content: bytes, filename: str) -> None:
    """Raise ValueError if file is too large or has a disallowed extension."""
    import os
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_CSV_EXTENSIONS:
        raise ValueError(
            f"File extension {ext!r} not allowed — use .csv or .xlsx"
        )
    if len(content) > MAX_CSV_BYTES:
        raise ValueError(
            f"File exceeds 10 MB limit ({len(content) / 1_048_576:.1f} MB)"
        )
    if len(content) == 0:
        raise ValueError("Uploaded file is empty")
