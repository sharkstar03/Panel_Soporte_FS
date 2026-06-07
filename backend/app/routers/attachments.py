import hashlib
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.audit import log_event
from app.config import settings
from app.deps import get_current_user, get_db
from app.files import read_upload
from app.models import Attachment, SessionEventType, SupportSession, User
from app.s3 import s3_client
from app.schemas import AttachmentOut

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.post("/sessions/{session_id}", response_model=AttachmentOut)
def upload_attachment(
    session_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.get(SupportSession, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if s.user_id != user.id and user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="No autorizado")

    data = read_upload(file)

    checksum = hashlib.sha256(data).hexdigest()
    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.split(".")[-1].lower()
    storage_key = f"{session_id}/{uuid.uuid4().hex}{ext}"

    client = s3_client()
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=storage_key,
        Body=data,
        ContentType=file.content_type or "application/octet-stream",
    )

    att = Attachment(
        session_id=session_id,
        filename=file.filename or "archivo",
        mime=file.content_type or "application/octet-stream",
        size=len(data),
        storage_key=storage_key,
        checksum=checksum,
    )
    db.add(att)
    db.commit()
    db.refresh(att)

    log_event(
        db,
        SessionEventType.attachment_added,
        user_id=user.id,
        session_id=session_id,
        metadata={"attachment_id": att.id, "filename": att.filename, "storage_key": att.storage_key},
    )
    return AttachmentOut.model_validate(att, from_attributes=True)


@router.get("/sessions/{session_id}", response_model=list[AttachmentOut])
def list_attachments(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.get(SupportSession, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if s.user_id != user.id and user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="No autorizado")

    atts = db.exec(select(Attachment).where(Attachment.session_id == session_id)).all()
    return [AttachmentOut.model_validate(a, from_attributes=True) for a in atts]


@router.get("/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    att = db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    s = db.get(SupportSession, att.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if s.user_id != user.id and user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="No autorizado")

    client = s3_client()
    log_event(db, SessionEventType.attachment_downloaded, user_id=user.id, session_id=s.id, metadata={"attachment_id": att.id, "filename": att.filename})
    obj = client.get_object(Bucket=settings.s3_bucket, Key=att.storage_key)

    return StreamingResponse(
        obj["Body"],
        media_type=att.mime,
        headers={"Content-Disposition": f'attachment; filename="{att.filename}"'},
    )

