from pathlib import Path

import filetype
from fastapi import HTTPException, UploadFile

from app.config import settings

# Extensiones permitidas para adjuntos y evidencias.
ALLOWED_EXTENSIONS = {
    # Imágenes
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    # Documentos
    ".pdf",
    ".txt",
    ".md",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".csv",
    # Comprimidos
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
}

# MIME types permitidos (usado como validación secundaria).
ALLOWED_MIME_PREFIXES = (
    "image/",
    "application/pdf",
    "text/",
    "application/vnd.openxmlformats-",
    "application/vnd.ms-",
    "application/msword",
    "application/zip",
    "application/x-rar",
    "application/x-7z",
    "application/gzip",
    "application/x-tar",
)


def _get_extension(filename: str | None) -> str:
    if not filename:
        return ""
    return Path(filename).suffix.lower()


def _is_allowed_mime(mime: str | None) -> bool:
    if not mime:
        return False
    mime = mime.lower()
    return any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES)


def _validate_upload(file: UploadFile, data: bytes) -> None:
    """Valida extensión y tipo MIME de un archivo subido.

    Usa `filetype` para detectar el tipo real por contenido, no solo por la
    extensión que reporta el cliente.
    """
    ext = _get_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de archivo no permitido. Extensiones permitidas: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Validar MIME declarado por el cliente.
    declared_mime = (file.content_type or "").lower()
    if not _is_allowed_mime(declared_mime):
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de contenido no permitido: {file.content_type}",
        )

    # Validar MIME real por contenido (evita archivos con extensión disfrazada).
    kind = filetype.guess(data)
    if kind is not None:
        if not _is_allowed_mime(kind.mime):
            raise HTTPException(
                status_code=415,
                detail=f"El contenido del archivo no coincide con la extensión ({kind.mime})",
            )
    elif declared_mime != "text/plain":
        # Si filetype no puede determinar el tipo y el cliente declara algo que
        # no es texto plano, desconfiamos (ej: un .png que no es imagen).
        raise HTTPException(
            status_code=415,
            detail="El contenido del archivo no coincide con el tipo declarado",
        )


def read_upload(file: UploadFile, *, validate_type: bool = True) -> bytes:
    """Lee un archivo subido aplicando límite de tamaño y validación de tipo.

    Lee como máximo (límite + 1) bytes para acotar el uso de memoria y evitar
    DoS por subidas enormes. Rechaza archivos vacíos o que superen el límite.
    """
    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo demasiado grande (máximo {settings.max_upload_mb} MB)",
        )
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    if validate_type:
        _validate_upload(file, data)

    return data
