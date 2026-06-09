from contextlib import contextmanager

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")

if _is_sqlite:
    # SQLite (desarrollo local) requiere desactivar la verificación de hilo, ya
    # que FastAPI atiende peticiones en un pool de hilos.
    _connect_args: dict = {"check_same_thread": False}
else:
    # PostgreSQL: statement_timeout corta consultas colgadas;
    # idle_in_transaction_session_timeout libera transacciones abandonadas.
    _options = (
        f"-c statement_timeout={settings.db_statement_timeout_ms} "
        f"-c idle_in_transaction_session_timeout={settings.db_statement_timeout_ms * 2}"
    )
    _connect_args = {"options": _options}
    if settings.db_sslmode:
        _connect_args["sslmode"] = settings.db_sslmode

# pool_pre_ping descarta conexiones muertas; pool_recycle las renueva cada 30 min.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=_connect_args,
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session():
    with Session(engine) as session:
        yield session

