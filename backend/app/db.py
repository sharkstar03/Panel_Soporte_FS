from contextlib import contextmanager

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

# SQLite (desarrollo local) requiere desactivar la verificación de hilo, ya que
# FastAPI atiende peticiones en un pool de hilos. No afecta a PostgreSQL.
_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session():
    with Session(engine) as session:
        yield session

