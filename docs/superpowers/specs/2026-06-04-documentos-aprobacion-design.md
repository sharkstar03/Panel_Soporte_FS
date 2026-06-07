# Módulo de Documentos con Workflow de Aprobación

**Proyecto:** Panel de Soporte — QUANTIUM CREW  
**Fecha:** 2026-06-04  
**Estado:** Aprobado por usuario

---

## Resumen

Nuevo módulo dentro del Panel de Soporte para crear, gestionar y aprobar documentos digitales mediante un flujo de aprobación por correo electrónico. Reemplaza formularios Excel dispersos con un sistema centralizado, profesional y auditable.

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| ¿Form builder o plantillas? | Plantillas predefinidas (más rápido, más robusto) |
| ¿Aprobador necesita cuenta? | No — enlace público con token UUID |
| ¿Firma digital? | No — sello digital de aprobación en el PDF |
| ¿Rechazo con motivo? | Sí — campo de motivo obligatorio, aparece solo al hacer clic en "Rechazar" |
| ¿Expiración del enlace? | 7 días para responder; 24h después de aprobado para descargar |

---

## Plantillas MVP (4)

### 1. Entrega de Equipo
Registro formal de entrega de un activo a un empleado o área.

**Campos:**
- Equipo (nombre del activo)
- Número de serie
- Entregado a (nombre del receptor)
- Sucursal
- Fecha de entrega
- Condición del equipo (selección: Nuevo / Buen estado / Regular / Dañado)
- Observaciones (texto libre)
- Correo del aprobador

### 2. Control / Inspección de Equipo
Revisión periódica del estado de un equipo técnico.

**Campos:**
- Equipo inspeccionado
- Técnico responsable
- Sucursal
- Fecha de inspección
- Checklist de componentes (ítems con estado: OK / Falla / N/A)
- Estado general (Óptimo / Funcional / Requiere mantenimiento / Fuera de servicio)
- Observaciones
- Correo del aprobador

### 3. Pago a Proveedor
Solicitud formal de pago con términos y condiciones aceptados.

**Campos:**
- Nombre del proveedor
- RUC / NIT / ID fiscal
- Servicio o producto
- Monto total
- Moneda
- Fecha de pago acordada
- Notas adicionales
- Correo del aprobador

### 4. Checklist Diario con Evidencia
Reporte diario de tareas completadas por el técnico, con adjuntos como evidencia.

**Campos:**
- Técnico
- Fecha
- Lista de tareas predefinidas (hardcoded en el backend para MVP), cada una con:
  - Checkbox de completado
  - Botón "Agregar evidencia" (sube imagen o archivo)
  - Vista previa del archivo adjunto
- Observaciones generales del día
- Correo del supervisor aprobador

---

## Flujo completo del sistema

```
Técnico llena formulario
    → Selecciona plantilla
    → Completa campos
    → Ingresa correo del aprobador
    → Clic "Enviar para aprobar"
        → Backend genera Document (status: pending)
        → Backend genera token UUID + expira en 7 días
        → Backend envía correo SMTP con enlace público
        → Técnico ve el documento como "Pendiente" en la tabla

Aprobador recibe correo
    → Clic en enlace → página pública /approve/:token (sin login)
    → Ve resumen del documento
    → Lee y marca checkbox de Términos y Condiciones (requerido)
    → Opción A: clic "Aprobar"
        → Document.status = approved
        → Document.approved_at = now()
        → Document.approver_email = email del aprobador
        → PDF generado con sello de aprobación
        → Enlace muestra estado aprobado + botón descarga (disponible 24h)
        → Se actualiza en tabla del Panel en tiempo real
    → Opción B: clic "Rechazar"
        → Aparece campo de motivo (obligatorio)
        → Clic "Confirmar rechazo"
        → Document.status = rejected
        → Document.rejection_reason = motivo
        → Enlace muestra motivo del rechazo
        → Se actualiza en tabla del Panel

Expiración:
    - Token pendiente: expira a los 7 días → link muestra "Expirado"
    - Token aprobado: descarga disponible 24h post-aprobación → luego "Expirado"
    - PDF siempre accesible desde el Panel para usuarios con cuenta
```

---

## Arquitectura

### Backend (FastAPI — existente)

**Nuevos modelos:**

```python
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
    id: int
    type: DocumentType
    title: str
    data: str          # JSON con campos del formulario
    status: DocumentStatus = "pending"
    created_by: int    # FK → User
    approver_email: str
    token: str         # UUID v4, índice único
    token_expires_at: datetime    # created_at + 7 días
    download_expires_at: datetime | None  # approved_at + 24h
    approved_at: datetime | None
    rejection_reason: str | None
    pdf_path: str | None
    created_at: datetime

class DocumentEvidence(SQLModel, table=True):
    id: int
    document_id: int   # FK → Document
    checklist_item: str
    file_path: str
    filename: str
    uploaded_at: datetime
```

**Nuevos routers:**
- `POST /documents` — crear documento, generar token, enviar correo
- `GET /documents` — listar (con filtros: tipo, status, fecha)
- `GET /documents/:id` — detalle (requiere auth)
- `GET /documents/:id/pdf` — descarga PDF (requiere auth)
- `GET /approve/:token` — página pública de aprobación (valida token)
- `POST /approve/:token/approve` — confirmar aprobación
- `POST /approve/:token/reject` — confirmar rechazo (requiere body: reason)
- `GET /approve/:token/download` — descarga PDF pública (solo si aprobado y dentro de 24h)
- `POST /documents/:id/evidence` — subir evidencia para checklist

**PDF:** WeasyPrint — genera HTML con jinja2 template → PDF con sello de aprobación.

**SMTP:** Usa configuración existente de `app/settings_helper.py` (ya tiene SMTP configurado).

**Archivos de evidencia:** Usa `app/s3.py` existente (S3 o almacenamiento local).

### Frontend (React + TypeScript — existente)

**Nuevas rutas:**
- `/documents` — lista de documentos con filtros por status y tipo
- `/documents/new` — wizard: elegir plantilla → llenar formulario → confirmar envío
- `/documents/:id` — detalle del documento (vista + descarga PDF)
- `/approve/:token` — página pública (sin RequireAuth)

**Nuevos componentes:**
- `DocumentsPage` — tabla con badges de status, filtros, botón nuevo
- `NewDocumentWizard` — step 1: elegir plantilla / step 2: formulario específico / step 3: confirmación
- `ApprovalPage` — página pública: resumen doc + T&C checkbox + botones Aprobar/Rechazar → campo motivo
- `TemplateForm/EntregaEquipo` — formulario específico
- `TemplateForm/ControlEquipo` — formulario específico
- `TemplateForm/PagoProveedor` — formulario específico
- `TemplateForm/ChecklistDiario` — formulario con evidencia por ítem
- `EvidenceUploader` — componente de subida de archivo/imagen por ítem de checklist

---

## Página pública de aprobación — comportamiento detallado

**URL:** `/approve/:token` (sin RequireAuth — acceso público)

**Estado 1 — Pendiente (token válido):**
- Muestra resumen del documento
- Checkbox T&C: requerido, texto expandible al hacer clic en "Términos y Condiciones"
- Botones "Aprobar" y "Rechazar" (Aprobar deshabilitado hasta marcar T&C)
- Al clic en "Rechazar": aparece campo de motivo + "Confirmar rechazo" + "Cancelar"
- Nota de expiración en 7 días

**Estado 2 — Aprobado (dentro de 24h post-aprobación):**
- Sello de aprobación con email, fecha/hora e ID de transacción
- Botón de descarga PDF
- Countdown de expiración de descarga

**Estado 3 — Expirado (token vencido o +24h post-aprobación):**
- Pantalla de bloqueo con fecha de aprobación y mensaje de contacto

**Estado 4 — Rechazado:**
- Muestra motivo del rechazo

---

## PDF generado

Template HTML con jinja2 renderizado por WeasyPrint:
- Logo + nombre empresa en header
- Número de documento (DOC-YYYY-NNNN)
- Todos los campos del formulario en grid
- Si es checklist: tabla de tareas + thumbs de evidencia
- Footer con sello "APROBADO" (o "RECHAZADO"), email del aprobador, fecha/hora, ID de transacción

---

## Términos y Condiciones por plantilla

Cada plantilla tiene su propio texto de T&C almacenado en el backend (constantes). Se muestra expandible en la página de aprobación. El técnico NO necesita aceptar T&C al crear — solo el aprobador.

---

## Seguridad

- Token UUID v4 generado con `secrets.token_urlsafe(32)` — no predecible
- Expiración verificada en cada request al endpoint `/approve/:token`
- No se expone información sensible en el token (solo un identificador opaco)
- El PDF de descarga pública expira a las 24h post-aprobación
- Cualquier persona con el enlace puede aprobar (el campo `approver_email` es solo el destino del correo, no se valida en el momento de la aprobación — por diseño)

---

## Rol y permisos

| Acción | Técnico | Supervisor | Admin |
|---|---|---|---|
| Crear documento | ✅ | ✅ | ✅ |
| Ver propios documentos | ✅ | ✅ | ✅ |
| Ver todos los documentos | ❌ | ✅ | ✅ |
| Descargar PDF desde Panel | ✅ (propios) | ✅ | ✅ |
| Aprobar desde Panel | ❌ | ✅ | ✅ |
| Aprobar vía enlace público | ✅ (cualquiera con link) | ✅ | ✅ |

---

## Fuera de alcance (esta versión)

- Constructor visual de formularios (drag & drop)
- Firma digital con pad
- Múltiples aprobadores en cadena
- Recordatorios automáticos de aprobación pendiente
- Versionado de documentos
