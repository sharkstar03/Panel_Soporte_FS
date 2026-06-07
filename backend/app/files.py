from fastapi import HTTPException, UploadFile

from app.config import settings


def read_upload(file: UploadFile) -> bytes:
    """Lee un archivo subido aplicando un límite de tamaño.

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
    return data
