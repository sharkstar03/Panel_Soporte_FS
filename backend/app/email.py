import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlmodel import Session
from sqlmodel import select

from app.crypto import decrypt_value
from app.models import User, UserSmtpConfig
from app.settings_helper import get_setting


def _smtp_config(db: Session, user_id: int) -> Optional[dict]:
    """Resuelve la configuración SMTP a usar para un usuario.

    Usa la configuración personal del usuario si está definida (tiene host),
    y cae a la configuración general del sistema en caso contrario. Devuelve
    ``None`` si no hay host configurado (SMTP no disponible).
    """
    cfg = db.exec(select(UserSmtpConfig).where(UserSmtpConfig.user_id == user_id)).first()

    smtp_host = cfg.smtp_host if cfg and cfg.smtp_host else get_setting(db, "smtp_host", "")
    if not smtp_host:
        return None

    smtp_port = int(cfg.smtp_port) if cfg and cfg.smtp_host else int(get_setting(db, "smtp_port", 587))
    smtp_user = cfg.smtp_username if cfg and cfg.smtp_host else get_setting(db, "smtp_username", "")
    smtp_pass = decrypt_value(cfg.smtp_password_enc) if cfg and cfg.smtp_host and cfg.smtp_password_enc else get_setting(db, "smtp_password", "")
    smtp_from = (cfg.smtp_from_email or smtp_user) if cfg and cfg.smtp_host else (get_setting(db, "smtp_from_email", "") or smtp_user)
    smtp_tls = bool(cfg.smtp_tls) if cfg and cfg.smtp_host else bool(get_setting(db, "smtp_tls", True))

    return {
        "host": smtp_host,
        "port": smtp_port,
        "user": smtp_user,
        "pass": smtp_pass,
        "from": smtp_from,
        "tls": smtp_tls,
    }


def _send_email(cfg: dict, to_email: str, subject: str, html: str) -> None:
    """Envía un correo HTML. Falla en silencio si SMTP no responde."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["from"]
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as server:
            if cfg["tls"]:
                server.starttls()
            if cfg["user"] and cfg["pass"]:
                server.login(cfg["user"], cfg["pass"])
            server.sendmail(cfg["from"], [to_email], msg.as_string())
    except Exception:
        pass


TYPE_LABELS = {
    "entrega_equipo": "Entrega de Equipo",
    "control_equipo": "Control / Inspeccion de Equipo",
    "pago_proveedor": "Pago a Proveedor",
    "checklist_diario": "Checklist Diario",
}

TYPE_ICONS = {
    "entrega_equipo": "&#128230;",
    "control_equipo": "&#128269;",
    "pago_proveedor": "&#128176;",
    "checklist_diario": "&#9989;",
}


def send_approval_email(
    db: Session,
    approver_email: str,
    document_title: str,
    document_type: str,
    creator_username: str,
    creator_user_id: int,
    token: str,
) -> None:
    """Send approval request email. Silently skips if SMTP not configured."""
    cfg = _smtp_config(db, creator_user_id)
    if cfg is None:
        return

    public_url = get_setting(db, "app_public_url", "http://localhost:3000").rstrip("/")
    approval_url = f"{public_url}/approve/{token}"
    type_label = TYPE_LABELS.get(document_type, document_type)
    type_icon = TYPE_ICONS.get(document_type, "&#128196;")

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Solicitud de Aprobacion</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;background:#0d1724;border:1px solid #1e3a4a;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:28px;line-height:1;">&#9889;</p>
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">FARMACIA SABA</h1>
            <p style="margin:6px 0 0;color:#c5f6fa;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Panel Soporte</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
              El usuario <strong style="color:#e2e8f0;">{creator_username}</strong> ha creado un documento que requiere tu aprobacion:
            </p>

            <!-- Document card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a1929;border:1px solid #1e3a4a;border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 8px;font-size:24px;line-height:1;">{type_icon}</p>
                  <p style="margin:0 0 4px;color:#67e8f9;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">{type_label}</p>
                  <p style="margin:0;color:#f1f5f9;font-size:16px;font-weight:600;">{document_title}</p>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="{approval_url}" style="display:inline-block;background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 16px rgba(8,145,178,0.35);">
                    Ver documento y responder &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
              Este enlace es valido por <strong style="color:#94a3b8;">7 dias</strong>.<br>
              Si ya fue respondido, mostrara el estado actual.
            </p>

            <!-- URL fallback -->
            <p style="margin:0;color:#475569;font-size:11px;text-align:center;word-break:break-all;">
              {approval_url}
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;text-align:center;border-top:1px solid #1e3a4a;background:#091320;">
            <p style="margin:0;color:#475569;font-size:11px;">
              &copy; Farmacia Saba — Panel Soporte<br>
              Este correo fue generado automaticamente. No respondas a esta direccion.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""

    _send_email(cfg, approver_email, f"Solicitud de aprobacion — {type_label}", html)


def send_verification_email(db: Session, user: User, token: str) -> None:
    """Envía el correo de verificación de dirección de email al usuario."""
    cfg = _smtp_config(db, user.id)
    if cfg is None:
        return

    public_url = get_setting(db, "app_public_url", "http://localhost:3000").rstrip("/")
    verify_url = f"{public_url}/verify-email/{token}"
    display_name = user.display_name or user.username

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verifica tu correo</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;background:#0d1724;border:1px solid #1e3a4a;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:28px;line-height:1;">&#9889;</p>
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">FARMACIA SABA</h1>
            <p style="margin:6px 0 0;color:#c5f6fa;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Panel Soporte</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
              Hola <strong style="color:#e2e8f0;">{display_name}</strong>, confirma que esta es tu direccion de correo para activar las notificaciones de tu cuenta.
            </p>

            <!-- CTA Button -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 16px rgba(8,145,178,0.35);">
                    Verificar mi correo &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
              Este enlace es valido por <strong style="color:#94a3b8;">24 horas</strong>.<br>
              Si no solicitaste esto, puedes ignorar este correo.
            </p>

            <!-- URL fallback -->
            <p style="margin:0;color:#475569;font-size:11px;text-align:center;word-break:break-all;">
              {verify_url}
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;text-align:center;border-top:1px solid #1e3a4a;background:#091320;">
            <p style="margin:0;color:#475569;font-size:11px;">
              &copy; Farmacia Saba — Panel Soporte<br>
              Este correo fue generado automaticamente. No respondas a esta direccion.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""

    _send_email(cfg, user.email, "Verifica tu correo — Panel Soporte", html)


def send_password_reset_email(db: Session, user: User, token: str) -> None:
    """Envía el correo de recuperación de contraseña al usuario."""
    cfg = _smtp_config(db, user.id)
    if cfg is None:
        return

    public_url = get_setting(db, "app_public_url", "http://localhost:3000").rstrip("/")
    reset_url = f"{public_url}/reset-password/{token}"
    display_name = user.display_name or user.username

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Restablecer contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;background:#0d1724;border:1px solid #1e3a4a;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:28px;line-height:1;">&#9889;</p>
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">FARMACIA SABA</h1>
            <p style="margin:6px 0 0;color:#c5f6fa;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Panel Soporte</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
              Hola <strong style="color:#e2e8f0;">{display_name}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta.
            </p>

            <!-- CTA Button -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="{reset_url}" style="display:inline-block;background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 16px rgba(8,145,178,0.35);">
                    Restablecer mi contraseña &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
              Este enlace es valido por <strong style="color:#94a3b8;">1 hora</strong>.<br>
              Si no solicitaste esto, puedes ignorar este correo: tu contraseña no cambiara.
            </p>

            <!-- URL fallback -->
            <p style="margin:0;color:#475569;font-size:11px;text-align:center;word-break:break-all;">
              {reset_url}
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;text-align:center;border-top:1px solid #1e3a4a;background:#091320;">
            <p style="margin:0;color:#475569;font-size:11px;">
              &copy; Farmacia Saba — Panel Soporte<br>
              Este correo fue generado automaticamente. No respondas a esta direccion.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""

    _send_email(cfg, user.email, "Restablece tu contraseña — Panel Soporte", html)
