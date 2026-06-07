# Panel de soporte (MVP) — Docker + FastAPI + PostgreSQL + MinIO

Este proyecto implementa el **backend** para un panel de soporte que:
- Obliga a **registrar motivo** antes de una conexión remota
- Registra sesiones (inicio/cierre) y auditoría
- Permite **adjuntar evidencias** (archivos) guardadas en MinIO
- Mantiene catálogo de **Activos/Clientes**
- Incluye endpoints básicos para **Links** (accesos directos) y **KB** (documentación interna)

> Nota: La app de escritorio (Windows/macOS) se conecta a esta API. Mientras tanto puedes usar Swagger UI como “panel” temporal.

## Requisitos
- Docker + Docker Compose

## Levantar el stack
En la carpeta del proyecto:

```bash
docker compose up -d --build
```

Servicios:
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- MinIO consola: `http://localhost:9001`

## Credenciales iniciales (bootstrap)
Por defecto se crea un admin al arrancar:
- usuario: `admin`
- contraseña: `admin1234`

**Cámbialo en producción** usando variables de entorno:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`

## Variables de entorno (opcional)
Puedes crear un `.env` en esta carpeta y docker compose lo toma automáticamente.

Ejemplo:
```env
JWT_SECRET=pon_un_secreto_largo
ADMIN_USERNAME=admin
ADMIN_PASSWORD=cambia_esto
POSTGRES_DB=soporte
POSTGRES_USER=soporte
POSTGRES_PASSWORD=soporte
S3_BUCKET=support-attachments
```

## Acceso desde la red local (LAN)
Por defecto el panel solo responde en `localhost`. Para acceder desde otras computadoras o celulares en la misma red WiFi/cable:

```bash
# 1. Detectá tu IP y verificá que los servicios respondan
./scripts/local-access.sh

# 2. Usá la URL que te muestre el script, por ejemplo:
# http://192.168.1.50:3000
```

**Si no carga desde otro dispositivo:**
1. Asegurate de que ambos estén en la **misma red** (mismo WiFi / cable).
2. **Mac:** Desactivá temporalmente el Firewall:
   - *Preferencias del Sistema → Seguridad y Privacidad → Firewall → Apagar*
   - Si querés dejarlo activo, agregá excepciones para `Docker` y `Docker Desktop`.
3. **Windows (como admin):**
   ```cmd
   netsh advfirewall firewall add rule name=PanelSoporte dir=in action=allow protocol=TCP localport=3000,8000
   ```

## Flujo mínimo recomendado
1) Login (`POST /auth/login`)
2) Crear un activo (`POST /assets`) — admin/supervisor
3) Crear sesión (`POST /sessions`) — motivo obligatorio (>= 20 chars)
4) Marcar “connect clicked” (`POST /sessions/{id}/connect`)
5) Subir evidencia (`POST /attachments/sessions/{id}`)
6) Cerrar sesión (`POST /sessions/{id}/close`) — resumen obligatorio (>= 30 chars)

## Siguientes pasos (cuando hagamos la app de escritorio)
- Configurar “lanzadores” por herramienta/OS (AnyDesk/RustDesk/UltraVNC)
- UI completa: activos, nueva sesión, conectar, cierre y evidencias
- Aprobaciones para activos sensibles + reportes

