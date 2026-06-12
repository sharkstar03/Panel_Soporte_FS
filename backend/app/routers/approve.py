from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pathlib import Path
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_db
from app.models import Document, DocumentEvidence, DocumentStatus, SessionEventType
from app.pdf import generate_pdf_bytes
from app.schemas import DocumentEvidenceOut, PublicDocumentOut, RejectIn
from app.settings_helper import get_setting
from app.s3 import s3_client
from app.config import settings

router = APIRouter(prefix="/approve", tags=["approve"])

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_LOCAL_STORAGE_DIR = _BACKEND_DIR / "storage"


def _get_doc_by_token(token: str, db: Session) -> Document:
    doc = db.exec(select(Document).where(Document.token == token)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Enlace inválido o no encontrado")
    return doc


@router.get("/{token}", response_model=PublicDocumentOut)
def get_approval_state(token: str, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(token, db)
    return PublicDocumentOut.model_validate(doc, from_attributes=True)


@router.get("/{token}/evidence", response_model=list[DocumentEvidenceOut])
def list_public_evidence(token: str, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(token, db)
    if doc.status == DocumentStatus.pending and datetime.utcnow() > doc.token_expires_at:
        raise HTTPException(status_code=410, detail="El enlace ha expirado")
    evs = db.exec(select(DocumentEvidence).where(DocumentEvidence.document_id == doc.id).order_by(DocumentEvidence.uploaded_at)).all()
    return [DocumentEvidenceOut.model_validate(e, from_attributes=True) for e in evs]


@router.get("/{token}/evidence/{evidence_id}")
def download_public_evidence(token: str, evidence_id: int, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(token, db)
    if doc.status == DocumentStatus.pending and datetime.utcnow() > doc.token_expires_at:
        raise HTTPException(status_code=410, detail="El enlace ha expirado")

    ev = db.get(DocumentEvidence, evidence_id)
    if not ev or ev.document_id != doc.id:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")

    data: bytes | None = None
    client = s3_client()
    if client:
        try:
            obj = client.get_object(Bucket=settings.s3_bucket, Key=ev.storage_key)
            data = obj["Body"].read()
        except Exception:
            raise HTTPException(status_code=404, detail="Archivo de evidencia no encontrado")
    else:
        in_path = (_LOCAL_STORAGE_DIR / ev.storage_key).resolve()
        storage_root = _LOCAL_STORAGE_DIR.resolve()
        if not str(in_path).startswith(str(storage_root)):
            raise HTTPException(status_code=404, detail="Archivo de evidencia no encontrado")
        if not in_path.exists():
            raise HTTPException(status_code=404, detail="Archivo de evidencia no encontrado")
        data = in_path.read_bytes()

    return Response(
        content=data,
        media_type=ev.mime or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{ev.filename}"'},
    )


@router.post("/{token}/approve")
def approve_document(token: str, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(token, db)

    if doc.status != DocumentStatus.pending:
        raise HTTPException(status_code=400, detail="El documento ya fue respondido")
    if datetime.utcnow() > doc.token_expires_at:
        raise HTTPException(status_code=410, detail="El enlace ha expirado")

    download_hours = int(get_setting(db, "doc_download_expiry_hours", 24))
    doc.status = DocumentStatus.approved
    doc.approved_at = datetime.utcnow()
    doc.download_expires_at = datetime.utcnow() + timedelta(hours=download_hours)
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_event(db, SessionEventType.document_approved, user_id=None,
              metadata={"document_id": doc.id, "approver_email": doc.approver_email})

    return {"ok": True, "download_expires_at": doc.download_expires_at.isoformat()}


@router.post("/{token}/reject")
def reject_document(token: str, payload: RejectIn, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(token, db)

    if doc.status != DocumentStatus.pending:
        raise HTTPException(status_code=400, detail="El documento ya fue respondido")
    if datetime.utcnow() > doc.token_expires_at:
        raise HTTPException(status_code=410, detail="El enlace ha expirado")
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(status_code=422, detail="El motivo de rechazo es requerido")

    doc.status = DocumentStatus.rejected
    doc.rejection_reason = payload.reason.strip()
    db.add(doc)
    db.commit()

    log_event(db, SessionEventType.document_rejected, user_id=None,
              metadata={"document_id": doc.id, "reason": doc.rejection_reason})

    return {"ok": True}


@router.get("/{token}/download")
def download_approved_pdf(token: str, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(token, db)

    if doc.status != DocumentStatus.approved:
        raise HTTPException(status_code=403, detail="El documento no está aprobado")
    if not doc.download_expires_at or datetime.utcnow() > doc.download_expires_at:
        raise HTTPException(status_code=410, detail="El enlace de descarga ha expirado")

    company = get_setting(db, "doc_company_name", "") or get_setting(db, "app_name", "FARMACIA SABA")
    pdf_bytes = generate_pdf_bytes(doc, company_name=company)
    safe_title = doc.title.replace(" ", "_")[:40]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )
