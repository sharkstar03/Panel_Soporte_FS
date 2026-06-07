# Módulo de Documentos con Workflow de Aprobación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a document management module with 4 form templates, PDF generation, and a public email-based approval workflow where approvers click a link, accept T&C, and approve or reject with a reason.

**Architecture:** Backend adds two routers — `documents` (JWT-protected) and `approve` (public, no auth). PDF generated on demand by `fpdf2`. Email sent via Python `smtplib` using SMTP settings in `SystemSetting`. Frontend adds 4 pages including public `ApprovalPage` outside `RequireAuth`.

**Tech Stack:** FastAPI · SQLModel · PostgreSQL · fpdf2 (PDF) · smtplib (SMTP) · React 18 · TypeScript · Axios · Tailwind CSS

---

### Task 1: Add Document + DocumentEvidence models

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add new enums and models at the bottom of models.py**

```python
# At the bottom of backend/app/models.py

class DocumentType(str, Enum):
    entrega_equipo = "entrega_equipo"
    control_equipo = "control_equipo"
    pago_proveedor = "pago_proveedor"
    checklist_diario = "checklist_diario"


class DocumentStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type: DocumentType = Field(index=True)
    title: str = Field(index=True)
    data_json: str  # JSON blob of form fields
    status: DocumentStatus = Field(default=DocumentStatus.pending, index=True)
    created_by_id: int = Field(foreign_key="user.id", index=True)
    approver_email: str
    token: str = Field(index=True, unique=True)
    token_expires_at: datetime           # created_at + 7 days
    download_expires_at: Optional[datetime] = Field(default=None)  # approved_at + 24h
    approved_at: Optional[datetime] = Field(default=None)
    rejection_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentEvidence(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    checklist_item: str
    storage_key: str
    filename: str
    mime: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
```

- [ ] **Step 2: Add audit event types for documents inside `SessionEventType` enum**

In `models.py`, find the `SessionEventType` class and add these values:

```python
    document_created = "DOCUMENT_CREATED"
    document_approved = "DOCUMENT_APPROVED"
    document_rejected = "DOCUMENT_REJECTED"
    document_downloaded = "DOCUMENT_DOWNLOADED"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add Document, DocumentEvidence models and audit events"
```

---

### Task 2: Add database migration

**Files:**
- Modify: `backend/app/migrations.py`

- [ ] **Step 1: Add document table migration at the end of `run_migrations()`**

```python
# Inside run_migrations(), after the existing kbarticle block:

        # Crear tabla document
        if not inspector.has_table("document"):
            conn.execute(text("""
                CREATE TYPE IF NOT EXISTS documenttype AS ENUM (
                    'entrega_equipo', 'control_equipo', 'pago_proveedor', 'checklist_diario'
                );
                CREATE TYPE IF NOT EXISTS documentstatus AS ENUM (
                    'pending', 'approved', 'rejected'
                );
                CREATE TABLE document (
                    id SERIAL PRIMARY KEY,
                    type documenttype NOT NULL,
                    title VARCHAR NOT NULL,
                    data_json TEXT NOT NULL,
                    status documentstatus NOT NULL DEFAULT 'pending',
                    created_by_id INTEGER NOT NULL REFERENCES "user"(id),
                    approver_email VARCHAR NOT NULL,
                    token VARCHAR NOT NULL UNIQUE,
                    token_expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                    download_expires_at TIMESTAMP WITHOUT TIME ZONE,
                    approved_at TIMESTAMP WITHOUT TIME ZONE,
                    rejection_reason TEXT,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX ix_document_type ON document(type);
                CREATE INDEX ix_document_status ON document(status);
                CREATE INDEX ix_document_created_by_id ON document(created_by_id);
                CREATE INDEX ix_document_token ON document(token);
                CREATE INDEX ix_document_title ON document(title);
            """))

        # Crear tabla documentevidence
        if not inspector.has_table("documentevidence"):
            conn.execute(text("""
                CREATE TABLE documentevidence (
                    id SERIAL PRIMARY KEY,
                    document_id INTEGER NOT NULL REFERENCES document(id),
                    checklist_item VARCHAR NOT NULL,
                    storage_key VARCHAR NOT NULL,
                    filename VARCHAR NOT NULL,
                    mime VARCHAR NOT NULL,
                    uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX ix_documentevidence_document_id ON documentevidence(document_id);
            """))

        # Agregar audit events de documentos al enum
        for value in ["DOCUMENT_CREATED", "DOCUMENT_APPROVED", "DOCUMENT_REJECTED", "DOCUMENT_DOWNLOADED"]:
            try:
                conn.execute(text(f"ALTER TYPE sessioneventtype ADD VALUE IF NOT EXISTS '{value}';"))
            except ProgrammingError:
                pass
```

**Note:** PostgreSQL does not support `CREATE TYPE IF NOT EXISTS`. Wrap each `CREATE TYPE` in its own try/except or check pg_type first. Replace the two `CREATE TYPE` lines with:

```python
        if not inspector.has_table("document"):
            try:
                conn.execute(text("CREATE TYPE documenttype AS ENUM ('entrega_equipo','control_equipo','pago_proveedor','checklist_diario');"))
            except Exception:
                pass
            try:
                conn.execute(text("CREATE TYPE documentstatus AS ENUM ('pending','approved','rejected');"))
            except Exception:
                pass
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS document (
                    id SERIAL PRIMARY KEY,
                    type documenttype NOT NULL,
                    title VARCHAR NOT NULL,
                    data_json TEXT NOT NULL,
                    status documentstatus NOT NULL DEFAULT 'pending',
                    created_by_id INTEGER NOT NULL REFERENCES "user"(id),
                    approver_email VARCHAR NOT NULL,
                    token VARCHAR NOT NULL UNIQUE,
                    token_expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                    download_expires_at TIMESTAMP WITHOUT TIME ZONE,
                    approved_at TIMESTAMP WITHOUT TIME ZONE,
                    rejection_reason TEXT,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_type ON document(type);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_status ON document(status);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_created_by_id ON document(created_by_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_token ON document(token);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_title ON document(title);"))
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/migrations.py
git commit -m "feat: add document + documentevidence migration"
```

---

### Task 3: Backend schemas

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Add Document imports to the top of schemas.py**

Find the existing import line and add `DocumentStatus`, `DocumentType`:

```python
from app.models import AssetType, DocumentStatus, DocumentType, KeyType, RemoteTool, SessionEventType, SessionResult, SessionStatus, UserRole
```

- [ ] **Step 2: Add schemas at the bottom of schemas.py**

```python
# ── Documents ──────────────────────────────────────────────────────────────

class DocumentCreateIn(BaseModel):
    type: DocumentType
    title: str
    data_json: str          # JSON-encoded form fields
    approver_email: str


class DocumentEvidenceOut(BaseModel):
    id: int
    document_id: int
    checklist_item: str
    filename: str
    mime: str
    uploaded_at: datetime


class DocumentOut(BaseModel):
    id: int
    type: DocumentType
    title: str
    data_json: str
    status: DocumentStatus
    created_by_id: int
    approver_email: str
    token_expires_at: datetime
    download_expires_at: Optional[datetime]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime


class PublicDocumentOut(BaseModel):
    """Returned by /approve/:token — no auth required, subset of DocumentOut."""
    id: int
    type: DocumentType
    title: str
    data_json: str
    status: DocumentStatus
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    download_expires_at: Optional[datetime]
    token_expires_at: datetime


class RejectIn(BaseModel):
    reason: str
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add Document schemas"
```

---

### Task 4: SMTP email helper + settings

**Files:**
- Create: `backend/app/email.py`
- Modify: `backend/app/settings_helper.py`

- [ ] **Step 1: Create `backend/app/email.py`**

```python
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlmodel import Session

from app.settings_helper import get_setting

TYPE_LABELS = {
    "entrega_equipo": "Entrega de Equipo",
    "control_equipo": "Control / Inspección de Equipo",
    "pago_proveedor": "Pago a Proveedor",
    "checklist_diario": "Checklist Diario",
}


def send_approval_email(
    db: Session,
    approver_email: str,
    document_title: str,
    document_type: str,
    creator_username: str,
    token: str,
) -> None:
    """Send approval request email. Silently skips if SMTP not configured."""
    smtp_host = get_setting(db, "smtp_host", "")
    if not smtp_host:
        return

    smtp_port = int(get_setting(db, "smtp_port", 587))
    smtp_user = get_setting(db, "smtp_username", "")
    smtp_pass = get_setting(db, "smtp_password", "")
    smtp_from = get_setting(db, "smtp_from_email", "") or smtp_user
    smtp_tls = get_setting(db, "smtp_tls", True)
    public_url = get_setting(db, "app_public_url", "http://localhost:3000").rstrip("/")
    approval_url = f"{public_url}/approve/{token}"
    type_label = TYPE_LABELS.get(document_type, document_type)

    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:8px;">
      <h2 style="color:#0891b2;margin-bottom:4px;">⚡ QUANTIUM CREW</h2>
      <p style="color:#64748b;margin-top:0;">Solicitud de Aprobación — {type_label}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
      <p>El usuario <strong>{creator_username}</strong> creó un documento <strong>{document_title}</strong> que requiere su aprobación.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{approval_url}"
           style="background:#0891b2;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Ver documento y responder →
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;">
        Este enlace es válido por 7 días. Si ya fue respondido, mostrará el estado actual.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Solicitud de aprobación — {document_title}"
    msg["From"] = smtp_from
    msg["To"] = approver_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            if smtp_tls:
                server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [approver_email], msg.as_string())
    except Exception:
        pass  # Never crash the request if email fails
```

- [ ] **Step 2: Add SMTP + public URL settings to `DEFAULT_SETTINGS` list in `settings_helper.py`**

Append these entries to the `DEFAULT_SETTINGS` list (before the closing `]`):

```python
    {"key": "smtp_host", "value": "", "description": "Host del servidor SMTP (ej: smtp.gmail.com).", "category": "email"},
    {"key": "smtp_port", "value": 587, "description": "Puerto SMTP (587=TLS, 465=SSL, 25=sin cifrado).", "category": "email"},
    {"key": "smtp_username", "value": "", "description": "Usuario/correo de autenticación SMTP.", "category": "email"},
    {"key": "smtp_password", "value": "", "description": "Contraseña SMTP.", "category": "email"},
    {"key": "smtp_from_email", "value": "", "description": "Dirección remitente de correos (ej: soporte@empresa.com).", "category": "email"},
    {"key": "smtp_tls", "value": True, "description": "Usar STARTTLS al conectar al servidor SMTP.", "category": "email"},
    {"key": "app_public_url", "value": "http://localhost:3000", "description": "URL pública del panel usada en los enlaces de aprobación.", "category": "general"},
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/email.py backend/app/settings_helper.py
git commit -m "feat: add SMTP email helper and email/public-url settings"
```

---

### Task 5: PDF generation with fpdf2

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/pdf.py`

- [ ] **Step 1: Add fpdf2 to `backend/requirements.txt`**

```
fpdf2==2.7.9
```

- [ ] **Step 2: Create `backend/app/pdf.py`**

```python
import json
from datetime import datetime

from fpdf import FPDF

TYPE_LABELS = {
    "entrega_equipo": "Acta de Entrega de Equipo",
    "control_equipo": "Control / Inspección de Equipo",
    "pago_proveedor": "Solicitud de Pago a Proveedor",
    "checklist_diario": "Checklist Diario con Evidencia",
}

DOC_PREFIX = {
    "entrega_equipo": "ENT",
    "control_equipo": "CTL",
    "pago_proveedor": "PAG",
    "checklist_diario": "CHK",
}

FIELD_LABELS = {
    "equipo": "Equipo",
    "numero_serie": "N° de Serie",
    "entregado_a": "Entregado a",
    "sucursal": "Sucursal",
    "fecha": "Fecha",
    "condicion": "Condición",
    "observaciones": "Observaciones",
    "tecnico": "Técnico",
    "fecha_inspeccion": "Fecha de Inspección",
    "estado_general": "Estado General",
    "proveedor": "Proveedor",
    "ruc": "RUC / NIT",
    "servicio": "Servicio / Producto",
    "monto": "Monto Total",
    "moneda": "Moneda",
    "fecha_pago": "Fecha de Pago",
    "notas": "Notas",
}


class _PDF(FPDF):
    def header(self):
        self.set_fill_color(8, 145, 178)
        self.rect(0, 0, 210, 16, "F")
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 3)
        self.cell(0, 10, "QUANTIUM CREW  —  Soporte Técnico", align="L")
        self.ln(18)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(148, 163, 184)
        self.cell(0, 8, f"Pág. {self.page_no()}  —  Generado por Panel de Soporte QUANTIUM CREW", align="C")


def _section_header(pdf: _PDF, text: str):
    pdf.set_fill_color(240, 249, 255)
    pdf.set_draw_color(8, 145, 178)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(8, 145, 178)
    pdf.set_x(10)
    pdf.cell(190, 7, f"  {text}", fill=True, border="B", align="L")
    pdf.ln(9)


def _field(pdf: _PDF, label: str, value: str, width: float = 190):
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(100, 116, 139)
    pdf.set_x(12)
    pdf.cell(width, 5, label.upper(), align="L")
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(15, 23, 42)
    pdf.set_x(12)
    pdf.multi_cell(width - 4, 6, str(value) if value else "—", align="L")
    pdf.ln(3)


def generate_pdf_bytes(document) -> bytes:
    """Return raw PDF bytes for a Document ORM instance."""
    data = json.loads(document.data_json)
    type_label = TYPE_LABELS.get(document.type, document.type)
    prefix = DOC_PREFIX.get(document.type, "DOC")
    doc_num = f"{prefix}-{document.created_at.strftime('%Y')}-{document.id:04d}"

    pdf = _PDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(10, 10, 10)

    # ── Title bar ─────────────────────────────────────────────────────────
    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(8, 145, 178)
    y = pdf.get_y()
    pdf.rect(10, y, 190, 14, "FD")
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(8, 145, 178)
    pdf.set_xy(14, y + 1)
    pdf.cell(110, 12, type_label, align="L")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(148, 163, 184)
    pdf.set_xy(124, y + 1)
    pdf.cell(72, 6, f"N°: {doc_num}", align="R")
    pdf.set_xy(124, y + 7)
    pdf.cell(72, 6, document.created_at.strftime("%d/%m/%Y %H:%M"), align="R")
    pdf.ln(18)

    # ── Fields ────────────────────────────────────────────────────────────
    _section_header(pdf, "DATOS DEL DOCUMENTO")
    for key, value in data.items():
        if key in ("tasks", "correo_aprobador") or key.startswith("_"):
            continue
        label = FIELD_LABELS.get(key, key.replace("_", " ").title())
        _field(pdf, label, str(value) if value is not None else "")

    # ── Checklist tasks ───────────────────────────────────────────────────
    tasks = data.get("tasks", [])
    if tasks:
        pdf.ln(4)
        _section_header(pdf, "TAREAS DEL DÍA")
        for task in tasks:
            done = task.get("done", False)
            label = task.get("label", "")
            pdf.set_x(12)
            pdf.set_font("Helvetica", "B", 9)
            if done:
                pdf.set_text_color(5, 150, 105)
                mark = "[✓]"
            else:
                pdf.set_text_color(148, 163, 184)
                mark = "[ ]"
            pdf.cell(10, 7, mark, align="L")
            pdf.set_font("Helvetica", "" if not done else "B", 9)
            pdf.set_text_color(15, 23, 42)
            pdf.cell(0, 7, label, align="L")
            pdf.ln(7)

    # ── Approval stamp ────────────────────────────────────────────────────
    pdf.ln(8)
    pdf.set_draw_color(226, 232, 240)
    pdf.line(12, pdf.get_y(), 198, pdf.get_y())
    pdf.ln(6)

    if document.status == "approved" and document.approved_at:
        y = pdf.get_y()
        pdf.set_fill_color(220, 252, 231)
        pdf.set_draw_color(16, 185, 129)
        pdf.rect(10, y, 190, 26, "FD")
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(5, 150, 105)
        pdf.set_xy(14, y + 2)
        pdf.cell(50, 12, "APROBADO", align="L")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(71, 85, 105)
        pdf.set_xy(14, y + 14)
        pdf.cell(0, 6, f"Por: {document.approver_email}", align="L")
        pdf.set_xy(14, y + 19)
        pdf.cell(0, 6, f"Fecha: {document.approved_at.strftime('%d/%m/%Y %H:%M')}  |  ID: {document.token[:16]}", align="L")
    elif document.status == "rejected":
        y = pdf.get_y()
        pdf.set_fill_color(254, 226, 226)
        pdf.set_draw_color(220, 38, 38)
        pdf.rect(10, y, 190, 26, "FD")
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(185, 28, 28)
        pdf.set_xy(14, y + 2)
        pdf.cell(60, 12, "RECHAZADO", align="L")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(71, 85, 105)
        pdf.set_xy(14, y + 14)
        reason = document.rejection_reason or ""
        pdf.multi_cell(182, 6, f"Motivo: {reason}", align="L")

    return bytes(pdf.output())
```

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt backend/app/pdf.py
git commit -m "feat: add fpdf2 dependency and PDF generation module"
```

---

### Task 6: Documents router (authenticated)

**Files:**
- Create: `backend/app/routers/documents.py`

- [ ] **Step 1: Create `backend/app/routers/documents.py`**

```python
import json
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db
from app.email import send_approval_email
from app.models import Document, DocumentEvidence, DocumentStatus, SessionEventType, User, UserRole
from app.pdf import generate_pdf_bytes
from app.s3 import s3_client
from app.config import settings
from app.schemas import DocumentCreateIn, DocumentEvidenceOut, DocumentOut

router = APIRouter(prefix="/documents", tags=["documents"])

TYPE_LABELS = {
    "entrega_equipo": "Entrega de Equipo",
    "control_equipo": "Control / Inspección de Equipo",
    "pago_proveedor": "Pago a Proveedor",
    "checklist_diario": "Checklist Diario",
}


@router.post("", response_model=DocumentOut)
def create_document(
    payload: DocumentCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    token = secrets.token_urlsafe(32)
    doc = Document(
        type=payload.type,
        title=payload.title.strip(),
        data_json=payload.data_json,
        status=DocumentStatus.pending,
        created_by_id=user.id,
        approver_email=payload.approver_email.strip().lower(),
        token=token,
        token_expires_at=datetime.utcnow() + timedelta(days=7),
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
        token=token,
    )

    return DocumentOut.model_validate(doc, from_attributes=True)


@router.get("", response_model=list[DocumentOut])
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


@router.get("/{doc_id}", response_model=DocumentOut)
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


@router.get("/{doc_id}/pdf")
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

    pdf_bytes = generate_pdf_bytes(doc)
    safe_title = doc.title.replace(" ", "_")[:40]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )


@router.post("/{doc_id}/evidence", response_model=DocumentEvidenceOut)
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/documents.py
git commit -m "feat: add documents router (authenticated CRUD + PDF download)"
```

---

### Task 7: Approve router (public, no auth)

**Files:**
- Create: `backend/app/routers/approve.py`

- [ ] **Step 1: Create `backend/app/routers/approve.py`**

```python
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlmodel import Session, select

from app.audit import log_event
from app.db import engine
from app.deps import get_db
from app.models import Document, DocumentStatus, SessionEventType
from app.pdf import generate_pdf_bytes
from app.schemas import PublicDocumentOut, RejectIn

router = APIRouter(prefix="/approve", tags=["approve"])


def _get_doc_by_token(token: str, db: Session) -> Document:
    doc = db.exec(select(Document).where(Document.token == token)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Enlace inválido o no encontrado")
    return doc


@router.get("/{token}", response_model=PublicDocumentOut)
def get_approval_state(token: str, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(token, db)
    return PublicDocumentOut.model_validate(doc, from_attributes=True)


@router.post("/{token}/approve")
def approve_document(token: str, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(token, db)

    if doc.status != DocumentStatus.pending:
        raise HTTPException(status_code=400, detail="El documento ya fue respondido")
    if datetime.utcnow() > doc.token_expires_at:
        raise HTTPException(status_code=410, detail="El enlace ha expirado")

    doc.status = DocumentStatus.approved
    doc.approved_at = datetime.utcnow()
    doc.download_expires_at = datetime.utcnow() + timedelta(hours=24)
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

    pdf_bytes = generate_pdf_bytes(doc)
    safe_title = doc.title.replace(" ", "_")[:40]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/approve.py
git commit -m "feat: add approve router (public approval/rejection/download)"
```

---

### Task 8: Register routers in main.py + rebuild Docker

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add imports and register routers in `main.py`**

Find the existing router imports line and add:
```python
from app.routers import approve, documents
```

Then after the last `app.include_router(...)` line add:
```python
app.include_router(documents.router)
app.include_router(approve.router)
```

- [ ] **Step 2: Rebuild the Docker container and verify**

```bash
cd "/Users/edgarng/Documents/QUANTIUM CREW/Panel_Soporte"
docker compose build api && docker compose up -d api
```

Wait ~10 seconds then:
```bash
curl -s http://localhost:8000/health
```
Expected: `{"ok":true}`

```bash
curl -s http://localhost:8000/openapi.json | python3 -c "import json,sys; routes=[r for r in json.load(sys.stdin)['paths'].keys() if 'document' in r or 'approve' in r]; print('\n'.join(routes))"
```
Expected output (any order):
```
/documents
/documents/{doc_id}
/documents/{doc_id}/pdf
/documents/{doc_id}/evidence
/approve/{token}
/approve/{token}/approve
/approve/{token}/reject
/approve/{token}/download
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register documents and approve routers in main.py"
```

---

### Task 9: Frontend types + API client

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add Document types to `frontend/src/api/types.ts`**

Append at the bottom of the file:

```typescript
// ── Documents ────────────────────────────────────────────────────────────

export type DocumentType =
  | 'entrega_equipo'
  | 'control_equipo'
  | 'pago_proveedor'
  | 'checklist_diario'

export type DocumentStatus = 'pending' | 'approved' | 'rejected'

export interface Document {
  id: number
  type: DocumentType
  title: string
  data_json: string
  status: DocumentStatus
  created_by_id: number
  approver_email: string
  token_expires_at: string
  download_expires_at: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
}

export interface PublicDocument {
  id: number
  type: DocumentType
  title: string
  data_json: string
  status: DocumentStatus
  approved_at: string | null
  rejection_reason: string | null
  download_expires_at: string | null
  token_expires_at: string
}

export interface DocumentEvidence {
  id: number
  document_id: number
  checklist_item: string
  filename: string
  mime: string
  uploaded_at: string
}

export interface DocumentCreateIn {
  type: DocumentType
  title: string
  data_json: string
  approver_email: string
}
```

- [ ] **Step 2: Add `documentsApi` and `approveApi` to `frontend/src/api/client.ts`**

Append at the bottom of `client.ts`:

```typescript
export const documentsApi = {
  list: (params?: { status?: string; type?: string }) =>
    api.get<import('./types').Document[]>('/documents', { params }),
  get: (id: number) =>
    api.get<import('./types').Document>(`/documents/${id}`),
  create: (data: import('./types').DocumentCreateIn) =>
    api.post<import('./types').Document>('/documents', data),
  downloadPdf: (id: number) =>
    api.get(`/documents/${id}/pdf`, { responseType: 'blob' }),
  uploadEvidence: (id: number, checklistItem: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('checklist_item', checklistItem)
    return api.post<import('./types').DocumentEvidence>(
      `/documents/${id}/evidence`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}

export const approveApi = {
  get: (token: string) =>
    api.get<import('./types').PublicDocument>(`/approve/${token}`),
  approve: (token: string) =>
    api.post(`/approve/${token}/approve`),
  reject: (token: string, reason: string) =>
    api.post(`/approve/${token}/reject`, { reason }),
  downloadPdf: (token: string) =>
    api.get(`/approve/${token}/download`, { responseType: 'blob' }),
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts
git commit -m "feat: add Document types and documentsApi/approveApi to frontend client"
```

---

### Task 10: App routing + Sidebar nav item

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Add imports and routes in `App.tsx`**

Add these imports after the existing page imports:
```tsx
import { DocumentsPage } from './pages/DocumentsPage'
import { NewDocumentPage } from './pages/NewDocumentPage'
import { DocumentDetailPage } from './pages/DocumentDetailPage'
import { ApprovalPage } from './pages/ApprovalPage'
```

Inside the `<Route path="/" element={...}>` block, add after existing routes:
```tsx
<Route path="documents" element={<DocumentsPage />} />
<Route path="documents/new" element={<NewDocumentPage />} />
<Route path="documents/:id" element={<DocumentDetailPage />} />
```

Add the public approval route **outside** the `RequireAuth` wrapper, as a sibling of `/login`:
```tsx
<Route path="/approve/:token" element={<ApprovalPage />} />
```

- [ ] **Step 2: Add Documentos nav item in `Sidebar.tsx`**

Find the `navItems` array import line and add `FileText` to the lucide-react import:
```tsx
import { Monitor, ClipboardList, BookOpen, Link2, Users, LogOut, LayoutDashboard, ShieldAlert, Settings, KeyRound, FileText } from 'lucide-react'
```

Add to `navItems` array after the sessions item:
```tsx
  { to: '/documents', icon: FileText, label: 'Documentos' },
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat: add documents routes and sidebar nav item"
```

---

### Task 11: DocumentsPage

**Files:**
- Create: `frontend/src/pages/DocumentsPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/DocumentsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Download } from 'lucide-react'
import { documentsApi } from '../api/client'
import type { Document, DocumentStatus, DocumentType } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import toast from 'react-hot-toast'

const TYPE_LABELS: Record<DocumentType, string> = {
  entrega_equipo: 'Entrega de Equipo',
  control_equipo: 'Control / Inspección',
  pago_proveedor: 'Pago a Proveedor',
  checklist_diario: 'Checklist Diario',
}

const TYPE_EMOJI: Record<DocumentType, string> = {
  entrega_equipo: '📦',
  control_equipo: '🔍',
  pago_proveedor: '💰',
  checklist_diario: '✅',
}

const STATUS_BADGE: Record<DocumentStatus, { label: string; cls: string }> = {
  pending:  { label: '⏳ Pendiente', cls: 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/40' },
  approved: { label: '✅ Aprobado',  cls: 'bg-green-900/30 text-green-400 border border-green-700/40'  },
  rejected: { label: '❌ Rechazado', cls: 'bg-red-900/30 text-red-400 border border-red-700/40'        },
}

export function DocumentsPage() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    documentsApi.list({ status: statusFilter || undefined, type: typeFilter || undefined })
      .then(r => setDocs(r.data))
      .catch(() => toast.error('Error al cargar documentos'))
      .finally(() => setLoading(false))
  }, [statusFilter, typeFilter])

  const handleDownload = async (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation()
    try {
      const r = await documentsApi.downloadPdf(doc.id)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar PDF')
    }
  }

  const counts = { all: docs.length, pending: docs.filter(d => d.status === 'pending').length, approved: docs.filter(d => d.status === 'approved').length, rejected: docs.filter(d => d.status === 'rejected').length }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Documentos" subtitle="Formularios, actas y registros con aprobación digital">
        <button onClick={() => navigate('/documents/new')} className="flex items-center gap-2 px-4 py-2 bg-cyan text-base rounded text-sm font-semibold hover:bg-cyan/80 transition-colors">
          <Plus size={15} /> Nuevo documento
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[['', `Todos (${counts.all})`], ['pending', `⏳ Pendientes (${counts.pending})`], ['approved', `✅ Aprobados (${counts.approved})`], ['rejected', `❌ Rechazados (${counts.rejected})`]].map(([v, label]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${statusFilter === v ? 'bg-cyan/10 text-cyan border-cyan/40' : 'text-text-secondary border-border hover:border-cyan/30'}`}>
            {label}
          </button>
        ))}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded text-xs bg-panel border border-border text-text-secondary">
          <option value="">Todos los tipos</option>
          {(Object.entries(TYPE_LABELS) as [DocumentType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-muted text-sm">Cargando...</div>
        ) : docs.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            No hay documentos. Crea el primero.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Tipo', 'Documento', 'Aprobador', 'Fecha', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} onClick={() => navigate(`/documents/${doc.id}`)}
                  className="border-b border-border/50 hover:bg-elevated cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                    <span className="font-mono text-xs bg-elevated px-2 py-0.5 rounded border border-border">
                      {TYPE_EMOJI[doc.type]} {TYPE_LABELS[doc.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary font-medium max-w-[240px] truncate">{doc.title}</td>
                  <td className="px-4 py-3 text-text-muted text-xs truncate max-w-[160px]">{doc.approver_email}</td>
                  <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                    {new Date(doc.created_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[doc.status].cls}`}>
                      {STATUS_BADGE[doc.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={e => handleDownload(e, doc)}
                      className="p-1.5 rounded hover:bg-elevated text-text-muted hover:text-cyan transition-colors" title="Descargar PDF">
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/DocumentsPage.tsx
git commit -m "feat: add DocumentsPage with filters and PDF download"
```

---

### Task 12: Four form template components

**Files:**
- Create: `frontend/src/pages/documents/EntregaEquipoForm.tsx`
- Create: `frontend/src/pages/documents/ControlEquipoForm.tsx`
- Create: `frontend/src/pages/documents/PagoProveedorForm.tsx`
- Create: `frontend/src/pages/documents/ChecklistDiarioForm.tsx`

- [ ] **Step 1: Create shared form field helper — add to top of each form file**

Each form receives this prop interface:
```tsx
interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string) => void
  loading: boolean
}
```

- [ ] **Step 2: Create `frontend/src/pages/documents/EntregaEquipoForm.tsx`**

```tsx
import { useState } from 'react'

interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string) => void
  loading: boolean
}

const CONDICION_OPTIONS = ['Nuevo', 'Buen estado', 'Regular', 'Dañado']

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{label}</label>
    {children}
  </div>
)

const inputCls = "w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan/60 transition-colors"

export function EntregaEquipoForm({ onSubmit, loading }: FormProps) {
  const [f, setF] = useState({
    equipo: '', numero_serie: '', entregado_a: '', sucursal: '',
    fecha: new Date().toISOString().split('T')[0], condicion: 'Buen estado',
    observaciones: '', correo_aprobador: '',
  })

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { correo_aprobador, ...fields } = f
    const title = `Entrega — ${f.equipo} · ${f.entregado_a}`
    onSubmit(title, JSON.stringify(fields), correo_aprobador)
  }

  const valid = f.equipo && f.entregado_a && f.fecha && f.correo_aprobador

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Equipo *"><input className={inputCls} value={f.equipo} onChange={set('equipo')} placeholder="Laptop HP EliteBook" required /></Field>
        <Field label="N° de Serie"><input className={inputCls} value={f.numero_serie} onChange={set('numero_serie')} placeholder="HP-2024-00421" /></Field>
        <Field label="Entregado a *"><input className={inputCls} value={f.entregado_a} onChange={set('entregado_a')} placeholder="Nombre completo" required /></Field>
        <Field label="Sucursal"><input className={inputCls} value={f.sucursal} onChange={set('sucursal')} placeholder="Sede Central" /></Field>
        <Field label="Fecha *"><input className={inputCls} type="date" value={f.fecha} onChange={set('fecha')} required /></Field>
        <Field label="Condición">
          <select className={inputCls} value={f.condicion} onChange={set('condicion')}>
            {CONDICION_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Observaciones">
        <textarea className={inputCls} rows={3} value={f.observaciones} onChange={set('observaciones')} placeholder="Incluye cargador y funda..." />
      </Field>
      <div className="border-t border-border pt-4">
        <Field label="Correo del aprobador *">
          <input className={inputCls} type="email" value={f.correo_aprobador} onChange={set('correo_aprobador')} placeholder="gerente@empresa.com" required />
        </Field>
      </div>
      <button type="submit" disabled={!valid || loading}
        className="w-full py-2.5 bg-cyan text-base rounded font-semibold text-sm disabled:opacity-40 hover:bg-cyan/80 transition-colors">
        {loading ? 'Enviando...' : 'Enviar para aprobar →'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create `frontend/src/pages/documents/ControlEquipoForm.tsx`**

```tsx
import { useState } from 'react'

interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string) => void
  loading: boolean
}

const inputCls = "w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan/60 transition-colors"
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{label}</label>
    {children}
  </div>
)

const ESTADO_OPTIONS = ['Óptimo', 'Funcional', 'Requiere mantenimiento', 'Fuera de servicio']
const CHECKLIST_ITEMS = [
  'Pantalla / Monitor', 'Teclado', 'Mouse / Touchpad', 'Puertos USB',
  'Ventilación / Temperatura', 'Batería (laptops)', 'Disco duro / SSD', 'RAM',
]

export function ControlEquipoForm({ onSubmit, loading }: FormProps) {
  const [f, setF] = useState({
    equipo: '', tecnico: '', sucursal: '',
    fecha_inspeccion: new Date().toISOString().split('T')[0],
    estado_general: 'Funcional', observaciones: '', correo_aprobador: '',
  })
  const [checks, setChecks] = useState<Record<string, string>>(
    Object.fromEntries(CHECKLIST_ITEMS.map(i => [i, 'OK']))
  )

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { correo_aprobador, ...fields } = f
    const data = { ...fields, checklist_componentes: checks }
    const title = `Inspección — ${f.equipo} · ${f.fecha_inspeccion}`
    onSubmit(title, JSON.stringify(data), correo_aprobador)
  }

  const valid = f.equipo && f.fecha_inspeccion && f.correo_aprobador

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Equipo *"><input className={inputCls} value={f.equipo} onChange={set('equipo')} placeholder="PC-04 Sucursal Norte" required /></Field>
        <Field label="Técnico"><input className={inputCls} value={f.tecnico} onChange={set('tecnico')} placeholder="Carlos Méndez" /></Field>
        <Field label="Sucursal"><input className={inputCls} value={f.sucursal} onChange={set('sucursal')} placeholder="Sede Norte" /></Field>
        <Field label="Fecha de inspección *"><input className={inputCls} type="date" value={f.fecha_inspeccion} onChange={set('fecha_inspeccion')} required /></Field>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Checklist de componentes</label>
        <div className="space-y-1.5">
          {CHECKLIST_ITEMS.map(item => (
            <div key={item} className="flex items-center justify-between bg-base border border-border rounded px-3 py-2">
              <span className="text-sm text-text-secondary">{item}</span>
              <select className="bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary"
                value={checks[item]} onChange={e => setChecks(p => ({ ...p, [item]: e.target.value }))}>
                {['OK', 'Falla', 'N/A'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
      <Field label="Estado general">
        <select className={inputCls} value={f.estado_general} onChange={set('estado_general')}>
          {ESTADO_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
      </Field>
      <Field label="Observaciones">
        <textarea className={inputCls} rows={3} value={f.observaciones} onChange={set('observaciones')} placeholder="Detalles adicionales..." />
      </Field>
      <div className="border-t border-border pt-4">
        <Field label="Correo del aprobador *">
          <input className={inputCls} type="email" value={f.correo_aprobador} onChange={set('correo_aprobador')} placeholder="gerente@empresa.com" required />
        </Field>
      </div>
      <button type="submit" disabled={!valid || loading}
        className="w-full py-2.5 bg-cyan text-base rounded font-semibold text-sm disabled:opacity-40 hover:bg-cyan/80 transition-colors">
        {loading ? 'Enviando...' : 'Enviar para aprobar →'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create `frontend/src/pages/documents/PagoProveedorForm.tsx`**

```tsx
import { useState } from 'react'

interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string) => void
  loading: boolean
}

const inputCls = "w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan/60 transition-colors"
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{label}</label>
    {children}
  </div>
)

export function PagoProveedorForm({ onSubmit, loading }: FormProps) {
  const [f, setF] = useState({
    proveedor: '', ruc: '', servicio: '', monto: '', moneda: 'USD',
    fecha_pago: '', notas: '', correo_aprobador: '',
  })

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { correo_aprobador, ...fields } = f
    const title = `Pago — ${f.proveedor} · ${f.moneda} ${f.monto}`
    onSubmit(title, JSON.stringify(fields), correo_aprobador)
  }

  const valid = f.proveedor && f.monto && f.correo_aprobador

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Proveedor *"><input className={inputCls} value={f.proveedor} onChange={set('proveedor')} placeholder="Tecnosol S.A." required /></Field>
        <Field label="RUC / NIT"><input className={inputCls} value={f.ruc} onChange={set('ruc')} placeholder="20512345678" /></Field>
      </div>
      <Field label="Servicio / Producto"><input className={inputCls} value={f.servicio} onChange={set('servicio')} placeholder="Soporte técnico mensual" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Monto total *"><input className={inputCls} value={f.monto} onChange={set('monto')} placeholder="1500.00" required /></Field>
        <Field label="Moneda">
          <select className={inputCls} value={f.moneda} onChange={set('moneda')}>
            {['USD', 'EUR', 'PEN', 'MXN', 'COP', 'CLP', 'ARS'].map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Fecha de pago"><input className={inputCls} type="date" value={f.fecha_pago} onChange={set('fecha_pago')} /></Field>
      </div>
      <Field label="Notas adicionales">
        <textarea className={inputCls} rows={3} value={f.notas} onChange={set('notas')} placeholder="Condiciones de pago, observaciones..." />
      </Field>
      <div className="border-t border-border pt-4">
        <Field label="Correo del aprobador *">
          <input className={inputCls} type="email" value={f.correo_aprobador} onChange={set('correo_aprobador')} placeholder="cfo@empresa.com" required />
        </Field>
      </div>
      <button type="submit" disabled={!valid || loading}
        className="w-full py-2.5 bg-cyan text-base rounded font-semibold text-sm disabled:opacity-40 hover:bg-cyan/80 transition-colors">
        {loading ? 'Enviando...' : 'Enviar para aprobar →'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Create `frontend/src/pages/documents/ChecklistDiarioForm.tsx`**

```tsx
import { useState, useRef } from 'react'
import { Paperclip, CheckCircle2, Circle } from 'lucide-react'

interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string) => void
  loading: boolean
  onEvidenceReady?: (docId: number, tasks: TaskState[]) => void
}

export interface TaskState {
  label: string
  done: boolean
  evidence: File | null
}

const DAILY_TASKS = [
  'Backup de servidores',
  'Monitoreo de red',
  'Actualización de sistemas',
  'Revisión UPS',
  'Limpieza de logs',
  'Verificación de antivirus',
  'Revisión de tickets pendientes',
  'Informe de incidencias',
]

const inputCls = "w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan/60 transition-colors"
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{label}</label>
    {children}
  </div>
)

export function ChecklistDiarioForm({ onSubmit, loading }: FormProps) {
  const [tecnico, setTecnico] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [observaciones, setObservaciones] = useState('')
  const [correo, setCorreo] = useState('')
  const [tasks, setTasks] = useState<TaskState[]>(
    DAILY_TASKS.map(label => ({ label, done: false, evidence: null }))
  )
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  const toggleDone = (i: number) =>
    setTasks(p => p.map((t, idx) => idx === i ? { ...t, done: !t.done } : t))

  const setEvidence = (i: number, file: File | null) =>
    setTasks(p => p.map((t, idx) => idx === i ? { ...t, evidence: file } : t))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      tecnico,
      fecha,
      observaciones,
      tasks: tasks.map(t => ({ label: t.label, done: t.done })),
    }
    const title = `Checklist — ${tecnico || 'Técnico'} · ${fecha}`
    onSubmit(title, JSON.stringify(data), correo)
  }

  const valid = fecha && correo

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Técnico"><input className={inputCls} value={tecnico} onChange={e => setTecnico(e.target.value)} placeholder="Carlos Méndez" /></Field>
        <Field label="Fecha *"><input className={inputCls} type="date" value={fecha} onChange={e => setFecha(e.target.value)} required /></Field>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Tareas del día</label>
        <div className="space-y-1.5">
          {tasks.map((task, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded border transition-colors ${task.done ? 'bg-green-900/10 border-green-700/30' : 'bg-base border-border'}`}>
              <button type="button" onClick={() => toggleDone(i)} className="flex-shrink-0">
                {task.done
                  ? <CheckCircle2 size={18} className="text-green-400" />
                  : <Circle size={18} className="text-text-muted" />}
              </button>
              <span className={`flex-1 text-sm ${task.done ? 'text-text-primary' : 'text-text-secondary'}`}>{task.label}</span>
              <input type="file" accept="image/*,.pdf" className="hidden"
                ref={el => { fileRefs.current[i] = el }}
                onChange={e => setEvidence(i, e.target.files?.[0] ?? null)} />
              {task.evidence ? (
                <span className="text-xs text-cyan flex items-center gap-1">
                  <Paperclip size={11} /> {task.evidence.name.slice(0, 16)}
                </span>
              ) : (
                <button type="button" onClick={() => fileRefs.current[i]?.click()}
                  className="text-xs text-text-muted hover:text-cyan flex items-center gap-1 transition-colors">
                  <Paperclip size={11} /> Evidencia
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Field label="Observaciones del día">
        <textarea className={inputCls} rows={3} value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Incidencias, novedades del día..." />
      </Field>

      <div className="border-t border-border pt-4">
        <Field label="Correo del supervisor *">
          <input className={inputCls} type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="supervisor@empresa.com" required />
        </Field>
      </div>

      <p className="text-xs text-text-muted">
        Nota: Las evidencias adjuntas se subirán automáticamente después de crear el documento.
      </p>

      <button type="submit" disabled={!valid || loading}
        className="w-full py-2.5 bg-cyan text-base rounded font-semibold text-sm disabled:opacity-40 hover:bg-cyan/80 transition-colors">
        {loading ? 'Enviando...' : 'Enviar checklist del día →'}
      </button>
    </form>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/documents/
git commit -m "feat: add 4 document template form components"
```

---

### Task 13: NewDocumentPage (wizard)

**Files:**
- Create: `frontend/src/pages/NewDocumentPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/NewDocumentPage.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { documentsApi } from '../api/client'
import type { DocumentType } from '../api/types'
import type { TaskState } from './documents/ChecklistDiarioForm'
import { EntregaEquipoForm } from './documents/EntregaEquipoForm'
import { ControlEquipoForm } from './documents/ControlEquipoForm'
import { PagoProveedorForm } from './documents/PagoProveedorForm'
import { ChecklistDiarioForm } from './documents/ChecklistDiarioForm'
import toast from 'react-hot-toast'

interface Template {
  type: DocumentType
  label: string
  desc: string
  emoji: string
  color: string
}

const TEMPLATES: Template[] = [
  { type: 'entrega_equipo',  label: 'Entrega de Equipo',        emoji: '📦', desc: 'Registro formal de entrega a empleado o área',       color: 'border-cyan/40 hover:border-cyan' },
  { type: 'control_equipo',  label: 'Control / Inspección',      emoji: '🔍', desc: 'Revisión periódica del estado de un equipo',         color: 'border-blue-500/40 hover:border-blue-400' },
  { type: 'pago_proveedor',  label: 'Pago a Proveedor',          emoji: '💰', desc: 'Solicitud de pago con términos y condiciones',        color: 'border-purple-500/40 hover:border-purple-400' },
  { type: 'checklist_diario', label: 'Checklist Diario',         emoji: '✅', desc: 'Tareas del día con evidencia fotográfica',            color: 'border-green-500/40 hover:border-green-400' },
]

export function NewDocumentPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'select' | 'fill'>('select')
  const [selected, setSelected] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSelect = (t: Template) => { setSelected(t); setStep('fill') }

  const handleSubmit = async (title: string, data_json: string, approver_email: string, tasks?: TaskState[]) => {
    if (!selected) return
    setLoading(true)
    try {
      const r = await documentsApi.create({ type: selected.type, title, data_json, approver_email })
      const docId = r.data.id

      // Upload evidence files for checklist
      if (selected.type === 'checklist_diario' && tasks) {
        const uploads = tasks.filter(t => t.evidence).map(t =>
          documentsApi.uploadEvidence(docId, t.label, t.evidence!)
        )
        await Promise.allSettled(uploads)
      }

      toast.success('Documento creado y enviado para aprobación')
      navigate(`/documents/${docId}`)
    } catch {
      toast.error('Error al crear el documento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step === 'fill' ? setStep('select') : navigate('/documents')}
          className="p-1.5 rounded hover:bg-elevated text-text-muted hover:text-text-primary transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {step === 'select' ? 'Nuevo documento' : selected?.label}
          </h1>
          <p className="text-xs text-text-muted">
            {step === 'select' ? 'Elige una plantilla' : 'Completa los campos y envía para aprobación'}
          </p>
        </div>
      </div>

      {step === 'select' && (
        <div className="grid grid-cols-2 gap-4">
          {TEMPLATES.map(t => (
            <button key={t.type} onClick={() => handleSelect(t)}
              className={`p-5 text-left bg-panel border rounded-lg transition-colors ${t.color}`}>
              <div className="text-3xl mb-3">{t.emoji}</div>
              <div className="font-semibold text-text-primary text-sm mb-1">{t.label}</div>
              <div className="text-xs text-text-muted">{t.desc}</div>
            </button>
          ))}
        </div>
      )}

      {step === 'fill' && selected && (
        <div className="bg-panel border border-border rounded-lg p-6">
          {selected.type === 'entrega_equipo'   && <EntregaEquipoForm  onSubmit={handleSubmit} loading={loading} />}
          {selected.type === 'control_equipo'   && <ControlEquipoForm  onSubmit={handleSubmit} loading={loading} />}
          {selected.type === 'pago_proveedor'   && <PagoProveedorForm  onSubmit={handleSubmit} loading={loading} />}
          {selected.type === 'checklist_diario' && (
            <ChecklistDiarioForm
              onSubmit={(title, data_json, email) => handleSubmit(title, data_json, email)}
              loading={loading}
            />
          )}
        </div>
      )}
    </div>
  )
}
```

**Note:** The `ChecklistDiarioForm` evidence upload requires passing `tasks` state up. To keep the form self-contained, the current implementation uploads evidence after creation using the files from the form's internal state. For the checklist, update `NewDocumentPage`'s `handleSubmit` to accept an optional `tasks` parameter. Modify `ChecklistDiarioForm` to call `onSubmit(title, data_json, email, tasks)` and update the `FormProps` interface in that file:

```tsx
// In ChecklistDiarioForm.tsx, update the interface:
interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string, tasks?: TaskState[]) => void
  loading: boolean
}

// In the handleSubmit function of ChecklistDiarioForm.tsx:
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  const data = { tecnico, fecha, observaciones, tasks: tasks.map(t => ({ label: t.label, done: t.done })) }
  const title = `Checklist — ${tecnico || 'Técnico'} · ${fecha}`
  onSubmit(title, JSON.stringify(data), correo, tasks)  // pass tasks here
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/NewDocumentPage.tsx
git commit -m "feat: add NewDocumentPage wizard with template selector"
```

---

### Task 14: DocumentDetailPage

**Files:**
- Create: `frontend/src/pages/DocumentDetailPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/DocumentDetailPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { documentsApi } from '../api/client'
import type { Document, DocumentType } from '../api/types'
import toast from 'react-hot-toast'

const TYPE_LABELS: Record<DocumentType, string> = {
  entrega_equipo: 'Entrega de Equipo',
  control_equipo: 'Control / Inspección',
  pago_proveedor: 'Pago a Proveedor',
  checklist_diario: 'Checklist Diario',
}

const FIELD_LABELS: Record<string, string> = {
  equipo: 'Equipo', numero_serie: 'N° Serie', entregado_a: 'Entregado a',
  sucursal: 'Sucursal', fecha: 'Fecha', condicion: 'Condición',
  observaciones: 'Observaciones', tecnico: 'Técnico',
  fecha_inspeccion: 'Fecha de inspección', estado_general: 'Estado general',
  proveedor: 'Proveedor', ruc: 'RUC / NIT', servicio: 'Servicio / Producto',
  monto: 'Monto', moneda: 'Moneda', fecha_pago: 'Fecha de pago', notas: 'Notas',
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    documentsApi.get(Number(id))
      .then(r => setDoc(r.data))
      .catch(() => { toast.error('Documento no encontrado'); navigate('/documents') })
      .finally(() => setLoading(false))
  }, [id])

  const handleDownload = async () => {
    if (!doc) return
    setDownloading(true)
    try {
      const r = await documentsApi.downloadPdf(doc.id)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Error al descargar') }
    finally { setDownloading(false) }
  }

  if (loading) return <div className="p-6 text-text-muted text-sm">Cargando...</div>
  if (!doc) return null

  const data = JSON.parse(doc.data_json)
  const tasks: { label: string; done: boolean }[] = data.tasks || []

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/documents')}
          className="p-1.5 rounded hover:bg-elevated text-text-muted transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-text-primary">{doc.title}</h1>
          <p className="text-xs text-text-muted">{TYPE_LABELS[doc.type]} · {new Date(doc.created_at).toLocaleDateString('es')}</p>
        </div>
        <button onClick={handleDownload} disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 bg-panel border border-border rounded text-sm text-text-secondary hover:text-cyan hover:border-cyan/40 transition-colors disabled:opacity-40">
          <Download size={14} /> {downloading ? 'Descargando...' : 'PDF'}
        </button>
      </div>

      {/* Status banner */}
      {doc.status === 'approved' && (
        <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-700/40 rounded-lg">
          <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-400">Aprobado</p>
            <p className="text-xs text-text-muted">Por: {doc.approver_email} · {doc.approved_at ? new Date(doc.approved_at).toLocaleString('es') : ''}</p>
          </div>
        </div>
      )}
      {doc.status === 'rejected' && (
        <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/40 rounded-lg">
          <XCircle size={20} className="text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Rechazado</p>
            <p className="text-xs text-text-muted">{doc.rejection_reason}</p>
          </div>
        </div>
      )}
      {doc.status === 'pending' && (
        <div className="flex items-center gap-3 p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-lg">
          <Clock size={20} className="text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-400">Pendiente de aprobación</p>
            <p className="text-xs text-text-muted">Enviado a: {doc.approver_email}</p>
          </div>
        </div>
      )}

      {/* Fields */}
      <div className="bg-panel border border-border rounded-lg p-5 space-y-4">
        {Object.entries(data).filter(([k]) => k !== 'tasks').map(([k, v]) => (
          <div key={k}>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-0.5">{FIELD_LABELS[k] || k.replace(/_/g, ' ')}</p>
            <p className="text-sm text-text-primary">{String(v) || '—'}</p>
          </div>
        ))}
      </div>

      {/* Checklist tasks */}
      {tasks.length > 0 && (
        <div className="bg-panel border border-border rounded-lg p-5">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Tareas del día</p>
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded border ${t.done ? 'bg-green-900/10 border-green-700/20' : 'border-border'}`}>
                {t.done ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" /> : <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" />}
                <span className={`text-sm ${t.done ? 'text-text-primary' : 'text-text-muted'}`}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/DocumentDetailPage.tsx
git commit -m "feat: add DocumentDetailPage with status banner and PDF download"
```

---

### Task 15: ApprovalPage (public)

**Files:**
- Create: `frontend/src/pages/ApprovalPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/ApprovalPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Lock, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { approveApi } from '../api/client'
import type { PublicDocument, DocumentType } from '../api/types'

const TYPE_LABELS: Record<DocumentType, string> = {
  entrega_equipo: 'Entrega de Equipo',
  control_equipo: 'Control / Inspección de Equipo',
  pago_proveedor: 'Pago a Proveedor',
  checklist_diario: 'Checklist Diario',
}

const FIELD_LABELS: Record<string, string> = {
  equipo: 'Equipo', numero_serie: 'N° Serie', entregado_a: 'Entregado a',
  sucursal: 'Sucursal', fecha: 'Fecha', condicion: 'Condición',
  observaciones: 'Observaciones', tecnico: 'Técnico',
  fecha_inspeccion: 'Fecha de inspección', estado_general: 'Estado general',
  proveedor: 'Proveedor', ruc: 'RUC / NIT', servicio: 'Servicio / Producto',
  monto: 'Monto', moneda: 'Moneda', fecha_pago: 'Fecha de pago', notas: 'Notas',
}

const TC_TEXT: Record<DocumentType, string> = {
  entrega_equipo: `1. Responsabilidad: El receptor declara recibir el equipo en el estado indicado y se hace responsable de su custodia y uso adecuado.\n2. Uso corporativo: El equipo es propiedad de la empresa y debe usarse exclusivamente para actividades laborales autorizadas.\n3. Daños y pérdida: Cualquier daño por mal uso o pérdida deberá ser reportado inmediatamente al área de soporte técnico.\n4. Devolución: Al concluir la relación laboral, el equipo debe ser devuelto en el mismo estado de entrega.\n5. Validez digital: La aprobación mediante este portal tiene la misma validez que una firma física.`,
  control_equipo: `1. Veracidad: El aprobador certifica que la inspección fue realizada por personal técnico calificado y que los resultados reflejan el estado real del equipo.\n2. Seguimiento: Los equipos con estado "Requiere mantenimiento" o "Fuera de servicio" deben ser atendidos en un plazo máximo de 5 días hábiles.\n3. Validez digital: La aprobación mediante este portal tiene la misma validez que una firma física.`,
  pago_proveedor: `1. Autorización de pago: El aprobador autoriza el desembolso del monto indicado al proveedor especificado en este documento.\n2. Verificación: El aprobador confirma haber verificado que el servicio o producto fue recibido de conformidad.\n3. Cumplimiento: El pago se realizará dentro de los plazos acordados y conforme a las políticas financieras de la empresa.\n4. Responsabilidad: El aprobador asume responsabilidad por la exactitud de los datos del proveedor y del monto autorizado.\n5. Validez digital: La aprobación mediante este portal tiene la misma validez que una firma física.`,
  checklist_diario: `1. Veracidad: El aprobador certifica haber revisado el reporte de actividades y que las tareas marcadas como completadas fueron ejecutadas.\n2. Evidencia: Las evidencias adjuntas son parte integral de este reporte y deben conservarse por al menos 30 días.\n3. Responsabilidad: El supervisor aprobador es responsable de dar seguimiento a las tareas pendientes.\n4. Validez digital: La aprobación mediante este portal tiene la misma validez que una firma física.`,
}

export function ApprovalPage() {
  const { token } = useParams<{ token: string }>()
  const [doc, setDoc] = useState<PublicDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tcAccepted, setTcAccepted] = useState(false)
  const [tcExpanded, setTcExpanded] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!token) return
    approveApi.get(token)
      .then(r => setDoc(r.data))
      .catch(() => setError('Enlace inválido, expirado o no encontrado'))
      .finally(() => setLoading(false))
  }, [token])

  const isTokenExpired = doc && new Date() > new Date(doc.token_expires_at)
  const isDownloadExpired = doc?.download_expires_at && new Date() > new Date(doc.download_expires_at)

  const handleApprove = async () => {
    if (!token || !tcAccepted) return
    setSubmitting(true)
    try {
      await approveApi.approve(token)
      setResult('approved')
      setDoc(p => p ? { ...p, status: 'approved', approved_at: new Date().toISOString(), download_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString() } : p)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Error al aprobar')
    } finally { setSubmitting(false) }
  }

  const handleReject = async () => {
    if (!token || !reason.trim()) return
    setSubmitting(true)
    try {
      await approveApi.reject(token, reason.trim())
      setResult('rejected')
      setDoc(p => p ? { ...p, status: 'rejected', rejection_reason: reason.trim() } : p)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Error al rechazar')
    } finally { setSubmitting(false) }
  }

  const handleDownload = async () => {
    if (!token) return
    setDownloading(true)
    try {
      const r = await approveApi.downloadPdf(token)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc?.title?.replace(/\s+/g, '_') ?? 'documento'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Error al descargar') }
    finally { setDownloading(false) }
  }

  // ── Shell ──────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#080f1a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0d1724] border border-[#1e3a4a] rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-[#091320] px-5 py-3 border-b border-[#1e3a4a] flex items-center justify-between">
          <span className="font-bold text-[#67e8f9] text-sm">⚡ QUANTIUM CREW</span>
          <span className="text-[#475569] text-xs">Aprobación de Documento</span>
        </div>
        {children}
      </div>
    </div>
  )

  if (loading) return <Shell><div className="p-8 text-center text-[#94a3b8] text-sm">Cargando documento...</div></Shell>
  if (error)   return <Shell><div className="p-8 text-center"><Lock size={36} className="mx-auto mb-3 text-[#f59e0b]" /><p className="text-[#f59e0b] font-semibold">{error}</p></div></Shell>
  if (!doc)    return null

  const data = JSON.parse(doc.data_json)
  const tasks: { label: string; done: boolean }[] = data.tasks || []
  const status = result ?? doc.status

  // ── Expired (pending token expired) ────────────────────────────────────
  if (isTokenExpired && status === 'pending') return (
    <Shell>
      <div className="p-8 text-center">
        <Lock size={36} className="mx-auto mb-3 text-[#f59e0b]" />
        <p className="text-[#f59e0b] font-semibold text-base">Enlace expirado</p>
        <p className="text-[#64748b] text-sm mt-2">Este enlace ya no es válido. Contacta al equipo de soporte para obtener una copia del documento.</p>
      </div>
    </Shell>
  )

  // ── Approved ────────────────────────────────────────────────────────────
  if (status === 'approved') return (
    <Shell>
      <div className="p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
        <p className="text-green-400 font-bold text-lg mb-1">Documento Aprobado</p>
        <p className="text-[#94a3b8] text-sm mb-1">Aprobado el {doc.approved_at ? new Date(doc.approved_at).toLocaleString('es') : new Date().toLocaleString('es')}</p>
        {doc.download_expires_at && <p className="text-[#475569] text-xs mb-6">Descarga disponible hasta: {new Date(doc.download_expires_at).toLocaleString('es')}</p>}
        {!isDownloadExpired ? (
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-[#0891b2] text-white rounded-lg font-semibold text-sm hover:bg-[#0e7490] disabled:opacity-50 transition-colors">
            <Download size={16} /> {downloading ? 'Descargando...' : 'Descargar PDF'}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-[#f59e0b] text-sm">
            <Lock size={14} /> El período de descarga ha expirado
          </div>
        )}
      </div>
    </Shell>
  )

  // ── Rejected ────────────────────────────────────────────────────────────
  if (status === 'rejected') return (
    <Shell>
      <div className="p-8 text-center">
        <XCircle size={48} className="mx-auto mb-4 text-red-400" />
        <p className="text-red-400 font-bold text-lg mb-2">Documento Rechazado</p>
        <div className="bg-[#1a0a0a] border border-red-900/40 rounded-lg p-4 text-left">
          <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1">Motivo del rechazo</p>
          <p className="text-sm text-[#e2e8f0]">{doc.rejection_reason || reason}</p>
        </div>
      </div>
    </Shell>
  )

  // ── Pending ─────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="p-5 space-y-4">
        {/* Doc summary */}
        <div className="bg-[#0a1929] border border-[#1e3a4a] rounded-lg p-4">
          <p className="text-xs text-[#475569] uppercase tracking-wider mb-1">{TYPE_LABELS[doc.type]}</p>
          <p className="font-semibold text-[#e2e8f0] text-sm mb-3">{doc.title}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(data).filter(([k]) => k !== 'tasks').slice(0, 6).map(([k, v]) => (
              <div key={k}>
                <p className="text-[9px] text-[#475569] uppercase tracking-wider">{FIELD_LABELS[k] || k}</p>
                <p className="text-xs text-[#94a3b8] truncate">{String(v) || '—'}</p>
              </div>
            ))}
          </div>
          {tasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#1e3a4a]">
              <p className="text-[9px] text-[#475569] uppercase tracking-wider mb-2">Tareas ({tasks.filter(t => t.done).length}/{tasks.length} completadas)</p>
              <div className="space-y-1">
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {t.done ? <CheckCircle2 size={12} className="text-green-400 flex-shrink-0" /> : <div className="w-3 h-3 rounded-full border border-[#1e3a4a] flex-shrink-0" />}
                    <span className={t.done ? 'text-[#94a3b8]' : 'text-[#475569]'}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* T&C */}
        <div className="bg-[#0a1929] border border-[#1e3a4a] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setTcAccepted(p => !p)}
              className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${tcAccepted ? 'bg-[#0891b2] border-[#0891b2]' : 'border-[#0891b2] bg-transparent'}`}>
              {tcAccepted && <span className="text-white text-xs font-bold">✓</span>}
            </button>
            <div className="text-xs text-[#94a3b8] leading-relaxed">
              He leído y acepto los{' '}
              <button type="button" onClick={() => setTcExpanded(p => !p)}
                className="text-[#67e8f9] underline inline-flex items-center gap-0.5">
                Términos y Condiciones
                {tcExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>{' '}
              de este documento y autorizo esta acción de forma digital.
            </div>
          </div>
          {tcExpanded && (
            <div className="mt-3 bg-[#0d2235] border border-[#0891b2]/40 rounded p-3 text-[10px] text-[#94a3b8] leading-relaxed max-h-28 overflow-y-auto whitespace-pre-line">
              {TC_TEXT[doc.type]}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={handleApprove} disabled={!tcAccepted || submitting}
            className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-30 text-white rounded-lg font-semibold text-sm transition-colors">
            ✅ Aprobar
          </button>
          <button onClick={() => { setShowReject(p => !p); setReason('') }} disabled={submitting}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${showReject ? 'bg-red-700 text-white' : 'bg-[#0d2235] text-[#94a3b8] border border-[#1e3a4a] hover:border-red-700/60 hover:text-red-400'}`}>
            ❌ Rechazar
          </button>
        </div>

        {/* Rejection reason — only shown after clicking Rechazar */}
        {showReject && (
          <div className="bg-[#1a0a0a] border border-red-900/50 rounded-lg p-4 space-y-3">
            <p className="text-xs text-red-400 font-medium uppercase tracking-wider">⚠ Motivo del rechazo (requerido)</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Ej: El número de serie no coincide con el inventario. Por favor verificar antes de proceder."
              className="w-full bg-[#0a0505] border border-red-900/50 rounded px-3 py-2 text-sm text-[#e2e8f0] resize-none focus:outline-none focus:border-red-700/70 placeholder-[#475569]" />
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={!reason.trim() || submitting}
                className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-30 text-white rounded-lg font-semibold text-sm transition-colors">
                {submitting ? 'Enviando...' : 'Confirmar rechazo'}
              </button>
              <button onClick={() => { setShowReject(false); setReason('') }}
                className="px-4 py-2 bg-[#0d2235] text-[#94a3b8] border border-[#1e3a4a] rounded-lg text-sm hover:text-[#e2e8f0] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[#475569] text-[10px]">
          <Clock size={10} className="inline mr-1" />
          Enlace válido hasta {new Date(doc.token_expires_at).toLocaleDateString('es')}
        </p>
      </div>
    </Shell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ApprovalPage.tsx
git commit -m "feat: add public ApprovalPage with T&C, approve/reject flow, and PDF download"
```

---

### Task 16: Build frontend + end-to-end smoke test

**Files:** none new

- [ ] **Step 1: Build frontend to verify TypeScript compiles**

```bash
cd "/Users/edgarng/Documents/QUANTIUM CREW/Panel_Soporte/frontend"
npm run build
```

Expected: `✓ built in X.XXs` with no TypeScript errors.

If there are import errors for `PageHeader`, check its props signature in `frontend/src/components/PageHeader.tsx` and adjust the `DocumentsPage` usage to match.

- [ ] **Step 2: Restart frontend dev server**

```bash
docker compose restart frontend
```

Or if running locally: `npm run dev`

- [ ] **Step 3: Smoke test the full flow**

1. Open http://localhost:3000 and log in as admin/admin1234
2. Verify "Documentos" appears in the sidebar
3. Navigate to `/documents` — table should load empty
4. Click "Nuevo documento" — 4 template cards should appear
5. Select "Entrega de Equipo" — form should render
6. Fill all fields with test data, use any email for approver
7. Click "Enviar para aprobar" — should redirect to `/documents/1`
8. Verify status shows "Pendiente"
9. Click "PDF" — should download a PDF
10. Copy the token from the URL of the created document (check via API):
    ```bash
    curl -s -H "Authorization: Bearer <your_token>" http://localhost:8000/documents/1 | python3 -m json.tool | grep token
    ```
11. Open http://localhost:3000/approve/<token> in an incognito window (no login)
12. Verify document fields are shown, T&C checkbox works
13. Verify "Aprobar" button is disabled until T&C is checked
14. Verify clicking "Rechazar" shows the rejection reason field (and hides it on "Cancelar")
15. Approve the document — should show success state with download button
16. Return to Documents list — status should show "Aprobado"

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete documents module with approval workflow, PDF, and 4 templates"
```

---

## Self-review notes

**Spec coverage check:**
- ✅ 4 templates: EntregaEquipo, ControlEquipo, PagoProveedor, ChecklistDiario
- ✅ PDF generation on demand (fpdf2, authenticated + public download)
- ✅ SMTP email via smtplib, settings in SystemSetting
- ✅ Public approval link (no login) with token UUID + 7-day expiry
- ✅ T&C checkbox required, text expandable per template type
- ✅ Approve button disabled until T&C checked
- ✅ Reject: button shows field → field was hidden initially
- ✅ Rejection reason required + Cancelar button
- ✅ Post-approval: 24h download window shown in UI
- ✅ Link shows expired state after 24h post-approval
- ✅ Technicians see own documents only; supervisors/admins see all
- ✅ Document audit events logged
- ✅ Evidence upload for checklist (S3)
- ✅ Sidebar nav item added

**Type consistency check:**
- `DocumentCreateIn.data_json: str` → `documentsApi.create({ ..., data_json })` ✅
- `PublicDocument` returned by `GET /approve/:token` used in `ApprovalPage` ✅
- `generate_pdf_bytes(doc)` called with ORM `Document` instance in both routers ✅
- `DocumentStatus` enum used consistently across models, schemas, and frontend types ✅
