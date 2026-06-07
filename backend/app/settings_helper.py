import json
from typing import Any, Optional

from sqlmodel import Session, select

from app.models import SystemSetting


def get_setting(db: Session, key: str, default: Any = None) -> Any:
    s = db.exec(select(SystemSetting).where(SystemSetting.key == key)).first()
    if not s:
        return default
    try:
        return json.loads(s.value)
    except (json.JSONDecodeError, TypeError):
        return s.value


def set_setting(
    db: Session,
    key: str,
    value: Any,
    description: Optional[str] = None,
    category: str = "general",
    updated_by_id: Optional[int] = None,
) -> SystemSetting:
    existing = db.exec(select(SystemSetting).where(SystemSetting.key == key)).first()
    val_str = json.dumps(value) if not isinstance(value, str) else value
    if existing:
        existing.value = val_str
        if description is not None:
            existing.description = description
        if category:
            existing.category = category
        existing.updated_by_id = updated_by_id
        db.add(existing)
    else:
        existing = SystemSetting(
            key=key,
            value=val_str,
            description=description,
            category=category,
            updated_by_id=updated_by_id,
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


DEFAULT_SETTINGS: list[dict[str, Any]] = [
    {
        "key": "app_name",
        "value": "QUANTIUM SOPORTE OPS",
        "description": "Nombre de la aplicación mostrado en el login y panel.",
        "category": "branding",
    },
    {
        "key": "jwt_expires_minutes",
        "value": 720,
        "description": "Tiempo de expiración del token JWT en minutos.",
        "category": "security",
    },
    {
        "key": "cors_origins",
        "value": "*",
        "description": "Orígenes permitidos para CORS (separados por coma).",
        "category": "security",
    },
    {
        "key": "session_min_reason_length",
        "value": 20,
        "description": "Mínimo de caracteres para el motivo al crear una sesión de soporte.",
        "category": "sessions",
    },
    {
        "key": "session_min_summary_length",
        "value": 30,
        "description": "Mínimo de caracteres para el resumen al cerrar una sesión.",
        "category": "sessions",
    },
    {
        "key": "s3_bucket",
        "value": "support-attachments",
        "description": "Nombre del bucket S3/MinIO para adjuntos.",
        "category": "storage",
    },
    {
        "key": "s3_region",
        "value": "us-east-1",
        "description": "Región del bucket S3/MinIO.",
        "category": "storage",
    },
    {
        "key": "maintenance_mode",
        "value": False,
        "description": "Activa el modo mantenimiento (solo admins pueden ingresar).",
        "category": "general",
    },
    {
        "key": "kb_categories",
        "value": ["general", "redes", "vpn", "windows", "linux", "hardware", "procedimientos", "seguridad"],
        "description": "Lista de categorías sugeridas para la Base de Conocimiento (JSON array).",
        "category": "catalogos",
    },
    {
        "key": "links_categories",
        "value": ["general", "monitoreo", "herramientas", "documentacion", "clientes"],
        "description": "Lista de categorías sugeridas para Links (JSON array).",
        "category": "catalogos",
    },
    {
        "key": "vault_categories",
        "value": ["general", "infra", "clientes", "proveedores", "interno"],
        "description": "Lista de categorías sugeridas para la Bóveda de Seguridad (JSON array).",
        "category": "catalogos",
    },
    {"key": "smtp_host", "value": "", "description": "Host del servidor SMTP (ej: smtp.gmail.com).", "category": "email"},
    {"key": "smtp_port", "value": 587, "description": "Puerto SMTP (587=TLS, 465=SSL, 25=sin cifrado).", "category": "email"},
    {"key": "smtp_username", "value": "", "description": "Usuario/correo de autenticación SMTP.", "category": "email"},
    {"key": "smtp_password", "value": "", "description": "Contraseña SMTP (se almacena en texto plano — usar usuario dedicado).", "category": "email"},
    {"key": "smtp_from_email", "value": "", "description": "Dirección remitente (ej: soporte@empresa.com).", "category": "email"},
    {"key": "smtp_tls", "value": True, "description": "Usar STARTTLS al conectar al servidor SMTP.", "category": "email"},
    {"key": "app_public_url", "value": "http://localhost:3000", "description": "URL pública del panel usada en los enlaces de aprobación por correo.", "category": "general"},
    # Módulo de Documentos
    {"key": "doc_token_expiry_days", "value": 7, "description": "Días que permanece válido el enlace de aprobación antes de expirar.", "category": "documentos"},
    {"key": "doc_download_expiry_hours", "value": 24, "description": "Horas disponibles para descargar el PDF después de ser aprobado.", "category": "documentos"},
    {"key": "doc_company_name", "value": "", "description": "Nombre de la empresa en el encabezado del PDF (vacío = usa el nombre de la app).", "category": "documentos"},
    {"key": "doc_checklist_items", "value": '["Backup de servidores","Monitoreo de red","Actualización de sistemas","Revisión UPS","Limpieza de logs","Verificación de antivirus","Revisión de tickets pendientes","Informe de incidencias"]', "description": "Lista de tareas predeterminadas del checklist diario (JSON array).", "category": "documentos"},
    {"key": "doc_require_tc", "value": True, "description": "Requerir que el aprobador acepte los Términos y Condiciones antes de aprobar.", "category": "documentos"},
    {"key": "doc_notify_creator", "value": True, "description": "Enviar correo al creador cuando el documento es aprobado o rechazado.", "category": "documentos"},
]


def seed_settings(db: Session, updated_by_id: Optional[int] = None) -> None:
    for item in DEFAULT_SETTINGS:
        existing = db.exec(select(SystemSetting).where(SystemSetting.key == item["key"])).first()
        if not existing:
            set_setting(
                db,
                key=item["key"],
                value=item["value"],
                description=item["description"],
                category=item["category"],
                updated_by_id=updated_by_id,
            )
