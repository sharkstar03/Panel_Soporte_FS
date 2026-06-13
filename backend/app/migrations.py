from sqlalchemy import inspect, text

from app.db import engine


def _add_enum_values(enum_name: str, values: list[str]) -> None:
    """Agrega valores a un enum de PostgreSQL de forma segura.

    ``ALTER TYPE ... ADD VALUE`` no puede compartir un bloque de transacción
    con otras sentencias: si una falla, aborta toda la transacción. Por eso
    cada adición se ejecuta en una conexión en AUTOCOMMIT, de modo que sea
    independiente e idempotente (``IF NOT EXISTS``).
    """
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for value in values:
            try:
                conn.execute(text(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{value}';"))
            except Exception:
                # El tipo puede no existir todavía o el valor ya estar presente.
                pass


def _ensure_enum_type(enum_name: str, values: list[str]) -> None:
    """Crea un tipo enum si no existe.

    PostgreSQL no soporta ``CREATE TYPE IF NOT EXISTS``; emitir ``CREATE TYPE``
    sobre un tipo ya existente lanza un error que abortaría la transacción aun
    capturándolo en Python. Por eso comprobamos ``pg_type`` y creamos en una
    conexión AUTOCOMMIT independiente.
    """
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_type WHERE typname = :name"), {"name": enum_name}
        ).first()
        if not exists:
            vals = ", ".join(f"'{v}'" for v in values)
            conn.execute(text(f"CREATE TYPE {enum_name} AS ENUM ({vals});"))


def run_migrations() -> None:
    # Estas migraciones usan SQL específico de PostgreSQL (ALTER TYPE, ADD COLUMN
    # IF NOT EXISTS, etc.). En otras bases (p. ej. SQLite para desarrollo local)
    # SQLModel.create_all() crea el esquema completo, así que no aplican.
    if engine.dialect.name != "postgresql":
        return

    inspector = inspect(engine)

    if not inspector.has_table("asset"):
        return

    # Adiciones a enums: deben correr fuera de la transacción principal
    # (ver _add_enum_values). Son idempotentes gracias a IF NOT EXISTS.
    _add_enum_values("remotetool", ["teamviewer", "rdp"])
    _add_enum_values("sessioneventtype", [
        "ATTACHMENT_DOWNLOADED",
        "ASSET_DELETED",
        "LINK_CREATED", "LINK_DELETED",
        "KB_CREATED", "KB_UPDATED", "KB_DELETED",
        "SETTING_UPDATED",
        "PASSWORD_CREATED", "PASSWORD_DELETED", "PASSWORD_VIEWED",
        "OTP_CREATED", "OTP_DELETED", "OTP_VIEWED",
        "SECKEY_CREATED", "SECKEY_DELETED", "SECKEY_VIEWED",
        "DOCUMENT_CREATED", "DOCUMENT_APPROVED", "DOCUMENT_REJECTED", "DOCUMENT_DOWNLOADED",
    ])

    # Tipos enum de documentos (también fuera de la transacción principal).
    _ensure_enum_type("documenttype", [
        "entrega_equipo", "control_equipo", "pago_proveedor", "checklist_diario",
    ])
    _ensure_enum_type("documentstatus", ["pending", "approved", "rejected"])

    with engine.begin() as conn:
        # Crear tabla branch si no existe
        if not inspector.has_table("branch"):
            conn.execute(text("""
                CREATE TABLE branch (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    code VARCHAR,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_branch_name ON branch(name);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_branch_code ON branch(code);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_branch_sort_order ON branch(sort_order);"))
        else:
            # Agregar sort_order si falta
            conn.execute(text("ALTER TABLE branch ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_branch_sort_order ON branch(sort_order);"))

        # Agregar branch_id a asset si falta
        asset_cols = {c["name"] for c in inspector.get_columns("asset")}
        if "branch_id" not in asset_cols:
            conn.execute(text("""
                ALTER TABLE asset
                ADD COLUMN branch_id INTEGER,
                ADD CONSTRAINT fk_asset_branch FOREIGN KEY (branch_id) REFERENCES branch(id);
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_asset_branch_id ON asset(branch_id);"))

        # Columnas de herramientas remotas
        conn.execute(text("""
            ALTER TABLE asset
            ADD COLUMN IF NOT EXISTS anydesk_password VARCHAR,
            ADD COLUMN IF NOT EXISTS rustdesk_password VARCHAR,
            ADD COLUMN IF NOT EXISTS teamviewer_id VARCHAR,
            ADD COLUMN IF NOT EXISTS teamviewer_password VARCHAR,
            ADD COLUMN IF NOT EXISTS rdp_host VARCHAR,
            ADD COLUMN IF NOT EXISTS rdp_port INTEGER DEFAULT 3389,
            ADD COLUMN IF NOT EXISTS rdp_username VARCHAR;
        """))

        # Vincular impresoras fiscales con activos (columna nueva).
        if inspector.has_table("fiscalmapping"):
            conn.execute(text("ALTER TABLE fiscalmapping ADD COLUMN IF NOT EXISTS asset_id INTEGER;"))

        # Agregar category a kbarticle si falta
        if inspector.has_table("kbarticle"):
            kb_cols = {c["name"] for c in inspector.get_columns("kbarticle")}
            if "category" not in kb_cols:
                conn.execute(text("ALTER TABLE kbarticle ADD COLUMN category VARCHAR DEFAULT 'general';"))

        if not inspector.has_table("documenttemplate"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS documenttemplate (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE,
                    doc_type documenttype NOT NULL,
                    html TEXT NOT NULL,
                    is_default BOOLEAN NOT NULL DEFAULT FALSE,
                    created_by_id INTEGER NOT NULL REFERENCES "user"(id),
                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_documenttemplate_name ON documenttemplate(name);
                CREATE INDEX IF NOT EXISTS ix_documenttemplate_doc_type ON documenttemplate(doc_type);
                CREATE INDEX IF NOT EXISTS ix_documenttemplate_is_default ON documenttemplate(is_default);
                CREATE INDEX IF NOT EXISTS ix_documenttemplate_created_by_id ON documenttemplate(created_by_id);
                CREATE INDEX IF NOT EXISTS ix_documenttemplate_updated_at ON documenttemplate(updated_at);
            """))

        # Crear tabla document
        if not inspector.has_table("document"):
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
        conn.execute(text("ALTER TABLE document ADD COLUMN IF NOT EXISTS template_id INTEGER;"))
        conn.execute(text("ALTER TABLE document ADD COLUMN IF NOT EXISTS rendered_html TEXT;"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_template_id ON document(template_id);"))

        # Crear tabla documentevidence
        if not inspector.has_table("documentevidence"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS documentevidence (
                    id SERIAL PRIMARY KEY,
                    document_id INTEGER NOT NULL REFERENCES document(id),
                    checklist_item VARCHAR NOT NULL,
                    storage_key VARCHAR NOT NULL,
                    filename VARCHAR NOT NULL,
                    mime VARCHAR NOT NULL,
                    uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_documentevidence_document_id ON documentevidence(document_id);
            """))

        # Crear tabla usersmtpconfig
        if not inspector.has_table("usersmtpconfig"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS usersmtpconfig (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id),
                    smtp_host VARCHAR NOT NULL DEFAULT '',
                    smtp_port INTEGER NOT NULL DEFAULT 587,
                    smtp_username VARCHAR NOT NULL DEFAULT '',
                    smtp_password_enc TEXT NOT NULL DEFAULT '',
                    smtp_from_email VARCHAR NOT NULL DEFAULT '',
                    smtp_tls BOOLEAN NOT NULL DEFAULT TRUE,
                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_usersmtpconfig_user_id ON usersmtpconfig(user_id);
            """))

        if not inspector.has_table("permission"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS permission (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR NOT NULL UNIQUE,
                    category VARCHAR NOT NULL DEFAULT 'general',
                    description VARCHAR NOT NULL DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS ix_permission_code ON permission(code);
                CREATE INDEX IF NOT EXISTS ix_permission_category ON permission(category);
            """))

        if not inspector.has_table("role"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS role (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE,
                    description VARCHAR NOT NULL DEFAULT '',
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_role_name ON role(name);
            """))

        if not inspector.has_table("rolepermission"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS rolepermission (
                    role_id INTEGER NOT NULL REFERENCES role(id),
                    permission_id INTEGER NOT NULL REFERENCES permission(id),
                    PRIMARY KEY (role_id, permission_id)
                );
                CREATE INDEX IF NOT EXISTS ix_rolepermission_role_id ON rolepermission(role_id);
                CREATE INDEX IF NOT EXISTS ix_rolepermission_permission_id ON rolepermission(permission_id);
            """))

        if not inspector.has_table("userrolelink"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS userrolelink (
                    user_id INTEGER NOT NULL REFERENCES "user"(id),
                    role_id INTEGER NOT NULL REFERENCES role(id),
                    PRIMARY KEY (user_id, role_id)
                );
                CREATE INDEX IF NOT EXISTS ix_userrolelink_user_id ON userrolelink(user_id);
                CREATE INDEX IF NOT EXISTS ix_userrolelink_role_id ON userrolelink(role_id);
            """))

        # Convertir sessionevent.type de enum a VARCHAR para evitar problemas de sincronizacion
        conn.execute(text("""
            ALTER TABLE sessionevent
            ALTER COLUMN type TYPE VARCHAR
            USING type::text;
        """))

        # Perfil de usuario: correo (para recuperación de contraseña, 2FA y
        # verificación), nombre para mostrar, avatar, cumpleaños y tema.
        conn.execute(text("""
            ALTER TABLE "user"
            ADD COLUMN IF NOT EXISTS email VARCHAR,
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS display_name VARCHAR,
            ADD COLUMN IF NOT EXISTS avatar_key VARCHAR,
            ADD COLUMN IF NOT EXISTS birthday DATE,
            ADD COLUMN IF NOT EXISTS theme VARCHAR NOT NULL DEFAULT 'dark';
        """))
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_user_email ON "user"(email);'))
