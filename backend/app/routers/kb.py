import hashlib
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session, select

from app.audit import log_event
from app.config import settings
from app.deps import get_current_user, get_db, require_permissions
from app.files import read_upload
from app.models import KBArticle, SessionEventType, User
from app.s3 import s3_client
from app.schemas import KBIn, KBOut

router = APIRouter(prefix="/kb", tags=["kb"])

_LOCAL_STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"


@router.post("", response_model=KBOut, dependencies=[Depends(require_permissions("kb.manage"))])
def create_article(payload: KBIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    art = KBArticle(**payload.model_dump(), updated_at=datetime.utcnow())
    db.add(art)
    db.commit()
    db.refresh(art)
    log_event(db, SessionEventType.kb_created, user_id=user.id, metadata={"article_id": art.id, "title": art.title})
    return KBOut(id=art.id, updated_at=art.updated_at, **payload.model_dump())


@router.get("", response_model=list[KBOut], dependencies=[Depends(require_permissions("kb.view"))])
def list_articles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    arts = db.exec(select(KBArticle).order_by(KBArticle.updated_at.desc())).all()
    return [
        KBOut(id=a.id, title=a.title, content_md=a.content_md, tags=a.tags, roles_allowed=a.roles_allowed, updated_at=a.updated_at)
        for a in arts
    ]


@router.get("/{article_id}", response_model=KBOut, dependencies=[Depends(require_permissions("kb.view"))])
def get_article(article_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(KBArticle, article_id)
    if not a:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return KBOut(id=a.id, title=a.title, content_md=a.content_md, tags=a.tags, category=a.category, roles_allowed=a.roles_allowed, updated_at=a.updated_at)


@router.put("/{article_id}", response_model=KBOut, dependencies=[Depends(require_permissions("kb.manage"))])
def update_article(article_id: int, payload: KBIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(KBArticle, article_id)
    if not a:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(a, key, value)
    a.updated_at = datetime.utcnow()
    db.add(a)
    db.commit()
    db.refresh(a)
    log_event(db, SessionEventType.kb_updated, user_id=user.id, metadata={"article_id": a.id, "title": a.title})
    return KBOut(id=a.id, title=a.title, content_md=a.content_md, tags=a.tags, category=a.category, roles_allowed=a.roles_allowed, updated_at=a.updated_at)


@router.delete("/{article_id}", dependencies=[Depends(require_permissions("kb.manage"))])
def delete_article(article_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(KBArticle, article_id)
    if not a:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    log_event(db, SessionEventType.kb_deleted, user_id=user.id, metadata={"article_id": a.id, "title": a.title})
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.post("/upload-image")
def upload_kb_image(
    file: UploadFile = File(...),
    user: User = Depends(require_permissions("kb.manage")),
):
    data = read_upload(file)

    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.split(".")[-1].lower()
    storage_key = f"kb/{uuid.uuid4().hex}{ext}"

    client = s3_client()
    if client:
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=storage_key,
            Body=data,
            ContentType=file.content_type or "application/octet-stream",
        )
        url = f"{settings.s3_endpoint_url}/{settings.s3_bucket}/{storage_key}"
    else:
        # Sin S3/MinIO: guardar local y servir vía /api/kb/images/{name}
        out_path = (_LOCAL_STORAGE_DIR / storage_key).resolve()
        storage_root = _LOCAL_STORAGE_DIR.resolve()
        if not str(out_path).startswith(str(storage_root)):
            raise HTTPException(status_code=500, detail="Ruta de almacenamiento inválida")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(data)
        url = f"/api/kb/images/{out_path.name}"
    return {"url": url}


# Servir imágenes de KB almacenadas localmente. Sin autenticación porque se
# incrustan en <img> del markdown (que no puede enviar el token); el nombre es
# un UUID no adivinable.
_IMAGE_MIME = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
}


@router.get("/images/{name}")
def serve_kb_image(name: str):
    safe_name = Path(name).name  # evita traversal
    in_path = (_LOCAL_STORAGE_DIR / "kb" / safe_name).resolve()
    storage_root = (_LOCAL_STORAGE_DIR / "kb").resolve()
    if not str(in_path).startswith(str(storage_root)) or not in_path.exists():
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    mime = _IMAGE_MIME.get(in_path.suffix.lower(), "application/octet-stream")
    return Response(content=in_path.read_bytes(), media_type=mime)
