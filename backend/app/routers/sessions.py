from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, require_permissions
from app.models import (
    Asset,
    Branch,
    SessionEvent,
    SessionEventType,
    SessionStatus,
    SupportSession,
    User,
)
from app.schemas import SessionCloseIn, SessionCreateIn, SessionOut, SessionReportOut, SessionEventOut, SessionAttachmentOut
from app.settings_helper import get_session_min_reason_length, get_session_min_summary_length

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut, dependencies=[Depends(require_permissions("sessions.manage"))])
def create_session(payload: SessionCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    min_reason = get_session_min_reason_length(db)
    if len(payload.reason.strip()) < min_reason:
        raise HTTPException(
            status_code=400,
            detail=f"El motivo debe tener al menos {min_reason} caracteres",
        )
    asset = db.get(Asset, payload.asset_id)
    asset = db.get(Asset, payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    # Validación mínima: debe existir el dato de conexión correspondiente
    if payload.tool.value == "anydesk" and not asset.anydesk_id:
        raise HTTPException(status_code=400, detail="El activo no tiene AnyDesk ID configurado")
    if payload.tool.value == "rustdesk" and not asset.rustdesk_id:
        raise HTTPException(status_code=400, detail="El activo no tiene RustDesk ID configurado")
    if payload.tool.value == "teamviewer" and not asset.teamviewer_id:
        raise HTTPException(status_code=400, detail="El activo no tiene TeamViewer ID configurado")
    if payload.tool.value == "ultravnc" and not asset.vnc_host:
        raise HTTPException(status_code=400, detail="El activo no tiene VNC host configurado")
    if payload.tool.value == "rdp" and not asset.rdp_host:
        raise HTTPException(status_code=400, detail="El activo no tiene RDP host configurado")

    s = SupportSession(
        user_id=user.id,
        asset_id=payload.asset_id,
        tool=payload.tool,
        reason=payload.reason.strip(),
        ticket=payload.ticket,
        status=SessionStatus.created,
        start_at=datetime.utcnow(),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    log_event(
        db,
        SessionEventType.session_created,
        user_id=user.id,
        session_id=s.id,
        metadata={"asset_id": s.asset_id, "tool": s.tool, "ticket": s.ticket},
    )
    return SessionOut.model_validate(s, from_attributes=True)


@router.post("/{session_id}/connect", response_model=SessionOut, dependencies=[Depends(require_permissions("sessions.manage"))])
def connect_clicked(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.get(SupportSession, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if s.user_id != user.id and user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="No autorizado")
    if s.status == SessionStatus.closed:
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")

    s.status = SessionStatus.in_progress
    db.add(s)
    db.commit()
    db.refresh(s)
    log_event(db, SessionEventType.connect_clicked, user_id=user.id, session_id=s.id)
    return SessionOut.model_validate(s, from_attributes=True)


@router.post("/{session_id}/close", response_model=SessionOut, dependencies=[Depends(require_permissions("sessions.manage"))])
def close_session(
    session_id: int,
    payload: SessionCloseIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.get(SupportSession, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if s.user_id != user.id and user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="No autorizado")
    min_summary = get_session_min_summary_length(db)
    if len(payload.summary.strip()) < min_summary:
        raise HTTPException(
            status_code=400,
            detail=f"El resumen debe tener al menos {min_summary} caracteres",
        )

    s.status = SessionStatus.closed
    s.end_at = datetime.utcnow()
    s.result = payload.result
    s.summary = payload.summary.strip()
    db.add(s)
    db.commit()
    db.refresh(s)
    log_event(db, SessionEventType.session_closed, user_id=user.id, session_id=s.id, metadata={"result": s.result})
    return SessionOut.model_validate(s, from_attributes=True)


@router.get("", response_model=list[SessionOut], dependencies=[Depends(require_permissions("sessions.view"))])
def list_sessions(
    asset_id: int | None = None,
    user_id: int | None = None,
    status: SessionStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(SupportSession).order_by(SupportSession.start_at.desc())
    if asset_id:
        stmt = stmt.where(SupportSession.asset_id == asset_id)
    if user_id:
        stmt = stmt.where(SupportSession.user_id == user_id)
    if status:
        stmt = stmt.where(SupportSession.status == status)
    sessions = db.exec(stmt).all()
    return [SessionOut.model_validate(s, from_attributes=True) for s in sessions]


@router.get("/{session_id}", response_model=SessionOut, dependencies=[Depends(require_permissions("sessions.view"))])
def get_session(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.get(SupportSession, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if s.user_id != user.id and user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="No autorizado")
    return SessionOut.model_validate(s, from_attributes=True)


@router.get("/{session_id}/report", response_model=SessionReportOut, dependencies=[Depends(require_permissions("sessions.view"))])
def get_session_report(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.get(SupportSession, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if s.user_id != user.id and user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="No autorizado")

    creator = db.get(User, s.user_id)
    asset = db.get(Asset, s.asset_id)
    branch = db.get(Branch, asset.branch_id) if asset and asset.branch_id else None

    from app.models import SessionEvent, Attachment
    events = db.exec(select(SessionEvent).where(SessionEvent.session_id == session_id).order_by(SessionEvent.at)).all()
    attachments = db.exec(select(Attachment).where(Attachment.session_id == session_id).order_by(Attachment.uploaded_at)).all()

    return SessionReportOut(
        session=SessionOut.model_validate(s, from_attributes=True),
        creator_username=creator.username if creator else "—",
        asset_name=asset.name if asset else f"#{s.asset_id}",
        branch_name=branch.name if branch else None,
        events=[SessionEventOut.model_validate(e, from_attributes=True) for e in events],
        attachments=[SessionAttachmentOut.model_validate(a, from_attributes=True) for a in attachments],
    )


@router.get("/{session_id}/report/pdf", dependencies=[Depends(require_permissions("sessions.view"))])
def download_session_report_pdf(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.get(SupportSession, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if s.user_id != user.id and user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="No autorizado")

    creator = db.get(User, s.user_id)
    asset = db.get(Asset, s.asset_id)
    branch = db.get(Branch, asset.branch_id) if asset and asset.branch_id else None
    events = db.exec(select(SessionEvent).where(SessionEvent.session_id == session_id).order_by(SessionEvent.at)).all()
    from app.models import Attachment
    attachments = db.exec(select(Attachment).where(Attachment.session_id == session_id).order_by(Attachment.uploaded_at)).all()

    from app.pdf import generate_session_report_pdf_bytes
    pdf_bytes = generate_session_report_pdf_bytes(
        session=s,
        events=events,
        attachments=attachments,
        creator_username=creator.username if creator else "—",
        asset_name=asset.name if asset else f"#{s.asset_id}",
        branch_name=branch.name if branch else None,
    )
    safe_title = f"reporte_sesion_{s.id}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )
