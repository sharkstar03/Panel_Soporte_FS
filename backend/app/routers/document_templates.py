from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.deps import get_current_user, get_db, require_permissions
from app.models import DocumentTemplate, DocumentType, User
from app.template_render import render_template_html

router = APIRouter(prefix="/document-templates", tags=["document_templates"])

_manage = Depends(require_permissions("documents.templates.manage"))


class DocumentTemplateIn(BaseModel):
    name: str
    doc_type: DocumentType
    html: str
    is_default: bool = False


class DocumentTemplateOut(BaseModel):
    id: int
    name: str
    doc_type: DocumentType
    html: str
    is_default: bool
    created_by_id: int
    updated_at: datetime


class RenderIn(BaseModel):
    html: str
    data_json: str
    title: str = "Documento"


@router.get("", response_model=list[DocumentTemplateOut], dependencies=[_manage])
def list_templates(doc_type: DocumentType | None = None, db: Session = Depends(get_db)):
    stmt = select(DocumentTemplate).order_by(DocumentTemplate.doc_type, DocumentTemplate.name)
    if doc_type:
        stmt = stmt.where(DocumentTemplate.doc_type == doc_type)
    items = db.exec(stmt).all()
    return [DocumentTemplateOut.model_validate(t, from_attributes=True) for t in items]


@router.post("", response_model=DocumentTemplateOut, dependencies=[_manage])
def create_template(payload: DocumentTemplateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.exec(select(DocumentTemplate).where(DocumentTemplate.name == payload.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una plantilla con ese nombre")

    if payload.is_default:
        others = db.exec(select(DocumentTemplate).where(DocumentTemplate.doc_type == payload.doc_type)).all()
        for o in others:
            o.is_default = False
            db.add(o)
        db.commit()

    t = DocumentTemplate(
        name=payload.name.strip(),
        doc_type=payload.doc_type,
        html=payload.html,
        is_default=payload.is_default,
        created_by_id=user.id,
        updated_at=datetime.utcnow(),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return DocumentTemplateOut.model_validate(t, from_attributes=True)


@router.put("/{template_id}", response_model=DocumentTemplateOut, dependencies=[_manage])
def update_template(template_id: int, payload: DocumentTemplateIn, db: Session = Depends(get_db)):
    t = db.get(DocumentTemplate, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    if payload.is_default:
        others = db.exec(select(DocumentTemplate).where(DocumentTemplate.doc_type == payload.doc_type)).all()
        for o in others:
            o.is_default = False
            db.add(o)
        db.commit()

    t.name = payload.name.strip()
    t.doc_type = payload.doc_type
    t.html = payload.html
    t.is_default = payload.is_default
    t.updated_at = datetime.utcnow()
    db.add(t)
    db.commit()
    db.refresh(t)
    return DocumentTemplateOut.model_validate(t, from_attributes=True)


@router.delete("/{template_id}", dependencies=[_manage])
def delete_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(DocumentTemplate, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.post("/render", dependencies=[_manage])
def render_preview(payload: RenderIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rendered = render_template_html(
        payload.html,
        payload.data_json,
        title=payload.title,
        creator_username=user.username,
        created_at=datetime.utcnow(),
    )
    return {"html": rendered}
