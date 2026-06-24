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
- Panel (frontend): `http://localhost:3000`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

### Almacenamiento de archivos
Por defecto los adjuntos, evidencias e imágenes se guardan en un **volumen local**
(`apidata`), sin dependencias externas. Si prefieres usar **S3/MinIO**, define las
variables `S3_ENDPOINT_URL`, `S3_ACCESS_KEY` y `S3_SECRET_KEY` en `.env`.

## Credenciales iniciales (bootstrap)
Al arrancar se crea un admin con `ADMIN_USERNAME` y `ADMIN_PASSWORD` (definidos
en `.env`). En producción la contraseña debe ser fuerte o el arranque fallará.
Cambia la contraseña tras el primer inicio de sesión.

## Desarrollo local
Para pruebas locales sin secretos fuertes, usa `APP_ENV=development` (desactiva
las validaciones estrictas). El stack de preview (`docker-compose.preview.yml`)
ya viene en modo desarrollo. **No uses ese modo en producción.**

## Desarrollo con Supabase local (Supabase CLI)
El repo incluye `supabase/config.toml` para levantar el stack local de Supabase
(Postgres + Studio + correo de prueba) con el [CLI de Supabase](https://supabase.com/docs/guides/cli).

```bash
# 1. Instala el CLI (una vez): https://supabase.com/docs/guides/cli
# 2. Levanta el stack local (usa Docker por debajo)
supabase start

# 3. Apunta el backend al Postgres local de Supabase (puerto 54322)
#    en tu .env:
DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres
APP_ENV=development

# 4. Arranca el backend (crea el esquema automáticamente al iniciar)
cd backend && uvicorn app.main:app --reload
```

- **Studio** (explorar tablas): http://127.0.0.1:54323
- **Correos de prueba** (verificación, 2FA, etc.): http://127.0.0.1:54324
- El esquema lo crea el backend al arrancar (`SQLModel.create_all` + `app/migrations.py`).
  Las tablas quedan agrupadas por módulo con prefijos (`auth_`, `rbac_`,
  `inventario_`, `soporte_`, `boveda_`, `conocimiento_`, `documentos_`,
  `fiscal_`, `sistema_`).
- Para detener el stack: `supabase stop` (agrega `--no-backup` para borrar los datos).

## Tests y CI
El backend tiene una suite de tests (`pytest`) que corre con SQLite, sin
necesidad de Docker ni PostgreSQL:

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Cada push y pull request ejecuta automáticamente el workflow de
**GitHub Actions** (`.github/workflows/ci.yml`): lint + tests del backend y
typecheck + build del frontend.

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

