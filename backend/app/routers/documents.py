import json
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pathlib import Path
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, require_permissions
from app.email import send_approval_email
from app.models import Document, DocumentEvidence, DocumentStatus, SessionEventType, User, UserRole
from app.pdf import generate_pdf_bytes
from app.s3 import s3_client
from app.config import settings
from app.schemas import DocumentCreateIn, DocumentEvidenceOut, DocumentOut
from sqlmodel import delete as sqlmodel_delete
from app.settings_helper import get_setting

router = APIRouter(prefix="/documents", tags=["documents"])

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_LOCAL_STORAGE_DIR = _BACKEND_DIR / "storage"


@router.get("/config/checklist-items", dependencies=[Depends(require_permissions("documents.create"))])
def get_checklist_items(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Devuelve los ítems configurables del checklist diario."""
    raw = get_setting(db, "doc_checklist_items", "[]")
    try:
        items = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        items = []
    return {"items": items}


TYPE_LABELS = {
    "entrega_equipo": "Entrega de Equipo",
    "control_equipo": "Control / Inspección de Equipo",
    "pago_proveedor": "Pago a Proveedor",
    "checklist_diario": "Checklist Diario",
}


@router.post("", response_model=DocumentOut, dependencies=[Depends(require_permissions("documents.create"))])
def create_document(
    payload: DocumentCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    token = secrets.token_urlsafe(32)
    expiry_days = int(get_setting(db, "doc_token_expiry_days", 7))
    doc = Document(
        type=payload.type,
        title=payload.title.strip(),
        data_json=payload.data_json,
        status=DocumentStatus.pending,
        created_by_id=user.id,
        approver_email=payload.approver_email.strip().lower(),
        token=token,
        token_expires_at=datetime.utcnow() + timedelta(days=expiry_days),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_event(db, SessionEventType.document_created, user_id=user.id,
              metadata={"document_id": doc.id, "type": doc.type, "title": doc.title})

    send_approval_email(
        db=db,
        approver_email=doc.approver_email,
        document_title=doc.title,
        document_type=doc.type,
        creator_username=user.username,
        creator_user_id=user.id,
        token=token,
    )

    return DocumentOut.model_validate(doc, from_attributes=True)


@router.get("", response_model=list[DocumentOut], dependencies=[Depends(require_permissions("documents.view"))])
def list_documents(
    status: str | None = None,
    type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Document)
    if user.role == UserRole.tecnico:
        stmt = stmt.where(Document.created_by_id == user.id)
    if status:
        stmt = stmt.where(Document.status == status)
    if type:
        stmt = stmt.where(Document.type == type)
    stmt = stmt.order_by(Document.created_at.desc())
    docs = db.exec(stmt).all()
    return [DocumentOut.model_validate(d, from_attributes=True) for d in docs]


@router.get("/{doc_id}", response_model=DocumentOut, dependencies=[Depends(require_permissions("documents.view"))])
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if user.role == UserRole.tecnico and doc.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    return DocumentOut.model_validate(doc, from_attributes=True)


@router.get("/{doc_id}/pdf", dependencies=[Depends(require_permissions("documents.view"))])
def download_pdf(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if user.role == UserRole.tecnico and doc.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    log_event(db, SessionEventType.document_downloaded, user_id=user.id,
              metadata={"document_id": doc.id})

    company = get_setting(db, "doc_company_name", "") or get_setting(db, "app_name", "QUANTIUM CREW")
    pdf_bytes = generate_pdf_bytes(doc, company_name=company)
    safe_title = doc.title.replace(" ", "_")[:40]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )


@router.post("/{doc_id}/evidence", response_model=DocumentEvidenceOut, dependencies=[Depends(require_permissions("documents.create"))])
def upload_evidence(
    doc_id: int,
    checklist_item: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if doc.type != "checklist_diario":
        raise HTTPException(status_code=400, detail="Solo los checklists admiten evidencia")
    if user.role == UserRole.tecnico and doc.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    import uuid as _uuid
    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.split(".")[-1].lower()
    storage_key = f"evidence/{doc_id}/{_uuid.uuid4().hex}{ext}"

    client = s3_client()
    if client:
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=storage_key,
            Body=data,
            ContentType=file.content_type or "application/octet-stream",
        )
    else:
        out_path = (_LOCAL_STORAGE_DIR / storage_key).resolve()
        storage_root = _LOCAL_STORAGE_DIR.resolve()
        if not str(out_path).startswith(str(storage_root)):
            raise HTTPException(status_code=500, detail="Ruta de evidencia inválida")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(data)

    ev = DocumentEvidence(
        document_id=doc_id,
        checklist_item=checklist_item,
        storage_key=storage_key,
        filename=file.filename or "archivo",
        mime=file.content_type or "application/octet-stream",
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return DocumentEvidenceOut.model_validate(ev, from_attributes=True)


@router.get("/{doc_id}/evidence", response_model=list[DocumentEvidenceOut], dependencies=[Depends(require_permissions("documents.view"))])
def list_evidence(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if user.role == UserRole.tecnico and doc.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    evs = db.exec(select(DocumentEvidence).where(DocumentEvidence.document_id == doc_id).order_by(DocumentEvidence.uploaded_at)).all()
    return [DocumentEvidenceOut.model_validate(e, from_attributes=True) for e in evs]


@router.get("/{doc_id}/evidence/{evidence_id}", dependencies=[Depends(require_permissions("documents.view"))])
def download_evidence(
    doc_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if user.role == UserRole.tecnico and doc.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    ev = db.get(DocumentEvidence, evidence_id)
    if not ev or ev.document_id != doc_id:
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


@router.delete("/{doc_id}", dependencies=[Depends(require_permissions("documents.delete"))])
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    # Nota: para centralizar la eliminación en "Zona de Peligro" y evitar borrados accidentales,
    # este endpoint queda restringido a admin. (La purga masiva vive en /admin/purge/documents).

    # Eliminar evidencias relacionadas
    db.exec(sqlmodel_delete(DocumentEvidence).where(DocumentEvidence.document_id == doc_id))
    db.flush()

    db.delete(doc)
    db.commit()

    log_event(db, SessionEventType.document_deleted if hasattr(SessionEventType, 'document_deleted')
              else SessionEventType.asset_deleted,
              user_id=user.id,
              metadata={"document_id": doc_id, "title": doc.title})

    return {"ok": True}
