import json
import traceback
from typing import Any, Optional

from sqlmodel import Session

from app.models import SessionEvent, SessionEventType


def log_event(
    db: Session,
    event_type: SessionEventType,
    user_id: Optional[int] = None,
    session_id: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    try:
        ev = SessionEvent(
            type=event_type,
            user_id=user_id,
            session_id=session_id,
            metadata_json=json.dumps(metadata or {}, ensure_ascii=False),
        )
        db.add(ev)
        db.commit()
    except Exception:
        # La auditoría nunca debe romper la operación principal.
        # Hacemos rollback de la sesión para no contaminar la transacción principal.
        db.rollback()
        traceback.print_exc()

