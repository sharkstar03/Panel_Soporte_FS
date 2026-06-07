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

## Configuración obligatoria (producción)
El stack de producción **exige secretos fuertes** y no arranca con valores por
defecto inseguros. Antes de levantarlo:

```bash
# 1. Copia la plantilla de entorno
cp .env.example .env

# 2. Genera secretos aleatorios (uno distinto por variable)
openssl rand -hex 32   # úsalo para JWT_SECRET
openssl rand -hex 32   # úsalo para MASTER_KEY (DEBE ser distinta de JWT_SECRET)

# 3. Edita .env y completa: JWT_SECRET, MASTER_KEY, CORS_ORIGINS,
#    ADMIN_PASSWORD y POSTGRES_PASSWORD
```

> ⚠️ **MASTER_KEY** cifra toda la bóveda de secretos (contraseñas, OTP, llaves,
> credenciales remotas). Si la pierdes o la cambias, no podrás descifrar lo ya
> guardado. Guárdala en un gestor de secretos.
>
> El archivo `.env` está en `.gitignore`: **nunca** lo subas al repositorio.

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
Al arrancar se crea un admin con `ADMIN_USERNAME` y `ADMIN_PASSWORD` (definidos
en `.env`). En producción la contraseña debe ser fuerte o el arranque fallará.
Cambia la contraseña tras el primer inicio de sesión.

## Desarrollo local
Para pruebas locales sin secretos fuertes, usa `APP_ENV=development` (desactiva
las validaciones estrictas). El stack de preview (`docker-compose.preview.yml`)
ya viene en modo desarrollo. **No uses ese modo en producción.**

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

