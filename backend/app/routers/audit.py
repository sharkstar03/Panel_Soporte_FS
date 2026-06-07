from typing import Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.deps import get_db, require_permissions
from app.models import SessionEvent
from app.schemas import AuditEventOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditEventOut], dependencies=[Depends(require_permissions("audit.view"))])
def list_audit_events(
    limit: int = 100,
    offset: int = 0,
    event_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    stmt = select(SessionEvent).order_by(SessionEvent.at.desc())
    if event_type:
        stmt = stmt.where(SessionEvent.type == event_type)
    stmt = stmt.offset(offset).limit(limit)
    events = db.exec(stmt).all()
    return [AuditEventOut.model_validate(e, from_attributes=True) for e in events]
