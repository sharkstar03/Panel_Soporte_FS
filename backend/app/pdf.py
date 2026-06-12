import json
from datetime import datetime

from fpdf import FPDF, HTMLMixin

TYPE_LABELS = {
    "entrega_equipo": "Acta de Entrega de Equipo",
    "control_equipo": "Control / Inspeccion de Equipo",
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
    "numero_serie": "N de Serie",
    "entregado_a": "Entregado a",
    "sucursal": "Sucursal",
    "fecha": "Fecha",
    "condicion": "Condicion",
    "observaciones": "Observaciones",
    "tecnico": "Tecnico",
    "fecha_inspeccion": "Fecha de Inspeccion",
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
    company_name: str = "FARMACIA SABA"

    def header(self):
        self.set_fill_color(8, 145, 178)
        self.rect(0, 0, 210, 18, "F")
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 4)
        self.cell(0, 10, f"{self.company_name}  -  Soporte Tecnico", align="L")
        self.set_font("Helvetica", "", 7)
        self.set_text_color(200, 230, 240)
        self.set_xy(10, 12)
        self.cell(0, 5, "Documento digital con validez de firma electronica", align="L")
        self.ln(22)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(148, 163, 184)
        self.cell(0, 8, f"Pag. {self.page_no()}  -  Generado por Panel de Soporte {self.company_name}", align="C")


class _HTMLPDF(_PDF, HTMLMixin):
    pass


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
    pdf.multi_cell(width - 4, 6, str(value) if value else "-", align="L")
    pdf.ln(3)


def _box(pdf: _PDF, label: str, value: str, x: float, y: float, w: float):
    pdf.set_xy(x, y)
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(x, y, w, 14, "FD")
    pdf.set_font("Helvetica", "B", 6)
    pdf.set_text_color(100, 116, 139)
    pdf.set_xy(x + 2, y + 1)
    pdf.cell(w - 4, 5, label.upper(), align="L")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(15, 23, 42)
    pdf.set_xy(x + 2, y + 6)
    pdf.cell(w - 4, 7, str(value) if value else "-", align="L")


def generate_pdf_bytes(document, company_name: str = "FARMACIA SABA") -> bytes:
    """Return raw PDF bytes for a Document ORM instance."""
    data = json.loads(document.data_json)
    type_label = TYPE_LABELS.get(document.type, document.type)
    prefix = DOC_PREFIX.get(document.type, "DOC")
    doc_num = f"{prefix}-{document.created_at.strftime('%Y')}-{document.id:04d}"

    pdf = _PDF()
    pdf.company_name = company_name
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(10, 10, 10)

    # Title bar
    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(8, 145, 178)
    y = pdf.get_y()
    pdf.rect(10, y, 190, 18, "FD")
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(8, 145, 178)
    pdf.set_xy(14, y + 1)
    pdf.cell(110, 12, type_label, align="L")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(148, 163, 184)
    pdf.set_xy(124, y + 1)
    pdf.cell(72, 6, f"N: {doc_num}", align="R")
    pdf.set_xy(124, y + 7)
    pdf.cell(72, 6, document.created_at.strftime("%d/%m/%Y %H:%M"), align="R")
    pdf.ln(22)

    # Status badge
    if document.status.value == "approved":
        pdf.set_fill_color(220, 252, 231)
        pdf.set_draw_color(16, 185, 129)
        pdf.set_text_color(5, 150, 105)
        badge_text = "APROBADO"
        badge_color = (5, 150, 105)
    elif document.status.value == "rejected":
        pdf.set_fill_color(254, 226, 226)
        pdf.set_draw_color(220, 38, 38)
        pdf.set_text_color(185, 28, 28)
        badge_text = "RECHAZADO"
        badge_color = (185, 28, 28)
    else:
        pdf.set_fill_color(254, 252, 232)
        pdf.set_draw_color(234, 179, 8)
        pdf.set_text_color(180, 83, 9)
        badge_text = "PENDIENTE"
        badge_color = (180, 83, 9)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_xy(150, y + 24)
    pdf.rect(150, y + 24, 50, 10, "FD")
    pdf.cell(50, 10, badge_text, align="C")
    pdf.set_xy(10, y + 36)
    pdf.ln(12)

    # Data boxes grid
    _section_header(pdf, "DATOS DEL DOCUMENTO")
    simple_fields = {k: v for k, v in data.items() if k not in ("tasks", "correo_aprobador", "checklist_componentes") and not k.startswith("_")}

    cols = 2
    box_w = 91
    box_h = 16
    gap_x = 8
    gap_y = 4
    start_x = 10
    start_y = pdf.get_y()
    i = 0
    for key, value in simple_fields.items():
        label = FIELD_LABELS.get(key, key.replace("_", " ").title())
        col = i % cols
        row = i // cols
        x = start_x + col * (box_w + gap_x)
        y = start_y + row * (box_h + gap_y)
        _box(pdf, label, str(value) if value is not None else "", x, y, box_w)
        i += 1

    if simple_fields:
        rows = (len(simple_fields) + cols - 1) // cols
        pdf.set_y(start_y + rows * (box_h + gap_y) + 4)

    # Checklist tasks
    tasks = data.get("tasks", [])
    if tasks:
        pdf.ln(6)
        _section_header(pdf, "TAREAS DEL DIA")
        for task in tasks:
            done = task.get("done", False)
            label = task.get("label", "")
            pdf.set_x(12)
            pdf.set_font("Helvetica", "B", 9)
            if done:
                pdf.set_text_color(5, 150, 105)
                mark = "[x]"
            else:
                pdf.set_text_color(148, 163, 184)
                mark = "[ ]"
            pdf.cell(10, 7, mark, align="L")
            pdf.set_font("Helvetica", "" if not done else "B", 9)
            pdf.set_text_color(15, 23, 42)
            pdf.cell(0, 7, label, align="L")
            pdf.ln(7)

    # Checklist componentes (control_equipo)
    checklist = data.get("checklist_componentes", {})
    if checklist:
        pdf.ln(4)
        _section_header(pdf, "CHECKLIST DE COMPONENTES")
        for item, val in checklist.items():
            pdf.set_x(12)
            pdf.set_font("Helvetica", "", 9)
            if val == "OK":
                pdf.set_text_color(5, 150, 105)
                mark = "[OK]"
            elif val == "Falla":
                pdf.set_text_color(220, 38, 38)
                mark = "[FALLA]"
            else:
                pdf.set_text_color(148, 163, 184)
                mark = "[N/A]"
            pdf.cell(20, 6, mark, align="L")
            pdf.set_text_color(15, 23, 42)
            pdf.cell(0, 6, item, align="L")
            pdf.ln(6)

    # Approval stamp
    pdf.ln(8)
    pdf.set_draw_color(226, 232, 240)
    pdf.line(12, pdf.get_y(), 198, pdf.get_y())
    pdf.ln(6)

    if document.status.value == "approved" and document.approved_at:
        y = pdf.get_y()
        pdf.set_fill_color(220, 252, 231)
        pdf.set_draw_color(16, 185, 129)
        pdf.rect(10, y, 190, 28, "FD")
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
        pdf.set_xy(14, y + 24)
        pdf.set_font("Helvetica", "I", 7)
        pdf.cell(0, 5, "Este documento tiene validez digital conforme a los terminos y condiciones.", align="L")
    elif document.status.value == "rejected":
        y = pdf.get_y()
        pdf.set_fill_color(254, 226, 226)
        pdf.set_draw_color(220, 38, 38)
        pdf.rect(10, y, 190, 28, "FD")
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(185, 28, 28)
        pdf.set_xy(14, y + 2)
        pdf.cell(60, 12, "RECHAZADO", align="L")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(71, 85, 105)
        pdf.set_xy(14, y + 14)
        reason = document.rejection_reason or ""
        pdf.multi_cell(182, 6, f"Motivo: {reason}", align="L")
        pdf.set_xy(14, y + 24)
        pdf.set_font("Helvetica", "I", 7)
        pdf.cell(0, 5, "Este documento fue rechazado y no tiene validez para tramites posteriores.", align="L")

    return bytes(pdf.output())


def generate_html_pdf_bytes(html_content: str, company_name: str = "FARMACIA SABA") -> bytes:
    pdf = _HTMLPDF()
    pdf.company_name = company_name
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(10, 10, 10)
    pdf.set_font("Helvetica", size=10)
    pdf.write_html(html_content)
    return bytes(pdf.output())


def generate_session_report_pdf_bytes(
    session, events, attachments, creator_username: str, asset_name: str, branch_name: str | None
) -> bytes:
    """Return raw PDF bytes for a session report / bitacora."""
    STATUS_LABELS = {
        "created": "Creada",
        "in_progress": "En progreso",
        "closed": "Cerrada",
    }
    RESULT_LABELS = {
        "resuelto": "Resuelto",
        "pendiente": "Pendiente",
        "escalado": "Escalado",
        "no_se_pudo_acceder": "Sin acceso",
    }
    TOOL_LABELS = {
        "anydesk": "AnyDesk",
        "rustdesk": "RustDesk",
        "teamviewer": "TeamViewer",
        "ultravnc": "UltraVNC",
        "rdp": "Remote Desktop",
    }
    EVENT_LABELS = {
        "SESSION_CREATED": "Sesion creada",
        "CONNECT_CLICKED": "Conexion iniciada",
        "SESSION_CLOSED": "Sesion cerrada",
        "ATTACHMENT_ADDED": "Archivo adjunto",
        "ATTACHMENT_DOWNLOADED": "Archivo descargado",
    }

    pdf = _PDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(10, 10, 10)

    # Title bar
    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(8, 145, 178)
    y = pdf.get_y()
    pdf.rect(10, y, 190, 14, "FD")
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(8, 145, 178)
    pdf.set_xy(14, y + 1)
    pdf.cell(110, 12, "Reporte de Sesion de Soporte", align="L")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(148, 163, 184)
    pdf.set_xy(124, y + 1)
    pdf.cell(72, 6, f"N: SES-{session.id:04d}", align="R")
    pdf.set_xy(124, y + 7)
    pdf.cell(72, 6, datetime.utcnow().strftime("%d/%m/%Y %H:%M"), align="R")
    pdf.ln(18)

    # General info
    _section_header(pdf, "INFORMACION GENERAL")
    _field(pdf, "Activo", asset_name)
    if branch_name:
        _field(pdf, "Sucursal", branch_name)
    _field(pdf, "Tecnico", creator_username)
    _field(pdf, "Herramienta", TOOL_LABELS.get(session.tool.value, session.tool.value))
    _field(pdf, "Estado", STATUS_LABELS.get(session.status.value, session.status.value))
    if session.result:
        _field(pdf, "Resultado", RESULT_LABELS.get(session.result.value, session.result.value))
    _field(pdf, "Motivo", session.reason)
    if session.ticket:
        _field(pdf, "Ticket", session.ticket)
    _field(pdf, "Inicio", session.start_at.strftime("%d/%m/%Y %H:%M"))
    if session.end_at:
        _field(pdf, "Fin", session.end_at.strftime("%d/%m/%Y %H:%M"))

    # Summary
    if session.summary:
        _section_header(pdf, "RESUMEN / BITACORA")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(15, 23, 42)
        pdf.set_x(12)
        pdf.multi_cell(186, 6, session.summary, align="L")
        pdf.ln(3)

    # Timeline
    if events:
        pdf.ln(4)
        _section_header(pdf, "HISTORIAL DE EVENTOS")
        for ev in events:
            label = EVENT_LABELS.get(ev.type, ev.type.replace("_", " ").title())
            time_str = ev.at.strftime("%d/%m %H:%M")
            meta = ""
            if ev.metadata_json:
                try:
                    md = json.loads(ev.metadata_json)
                    meta_parts = [f"{k}: {v}" for k, v in md.items() if v]
                    meta = " | ".join(meta_parts)
                except Exception:
                    meta = ""
            pdf.set_x(12)
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(8, 145, 178)
            pdf.cell(30, 6, time_str, align="L")
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(15, 23, 42)
            pdf.cell(80, 6, label, align="L")
            if meta:
                pdf.set_text_color(100, 116, 139)
                pdf.set_font("Helvetica", "", 7)
                pdf.cell(0, 6, meta[:60], align="L")
            pdf.ln(6)

    # Attachments
    if attachments:
        pdf.ln(4)
        _section_header(pdf, "ARCHIVOS ADJUNTOS")
        for att in attachments:
            pdf.set_x(12)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(15, 23, 42)
            pdf.cell(0, 6, f"- {att.filename} ({att.size} bytes) - {att.uploaded_at.strftime('%d/%m %H:%M')}", align="L")
            pdf.ln(6)

    return bytes(pdf.output())
