from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, require_permissions
from app.models import Link, SessionEventType, User
from app.schemas import LinkIn, LinkOut

router = APIRouter(prefix="/links", tags=["links"])


@router.post("", response_model=LinkOut, dependencies=[Depends(require_permissions("links.manage"))])
def create_link(payload: LinkIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    link = Link(**payload.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    log_event(db, SessionEventType.link_created, user_id=user.id, metadata={"link_id": link.id, "title": link.title, "url": link.url})
    return LinkOut(id=link.id, **payload.model_dump())


@router.get("", response_model=list[LinkOut], dependencies=[Depends(require_permissions("links.view"))])
def list_links(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    links = db.exec(select(Link).order_by(Link.category, Link.title)).all()
    return [LinkOut(id=l.id, title=l.title, url=l.url, category=l.category, roles_allowed=l.roles_allowed) for l in links]


@router.delete("/{link_id}", dependencies=[Depends(require_permissions("links.manage"))])
def delete_link(link_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    link = db.exec(select(Link).where(Link.id == link_id)).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link no encontrado")
    log_event(db, SessionEventType.link_deleted, user_id=user.id, metadata={"link_id": link.id, "title": link.title})
    db.delete(link)
    db.commit()
    return {"ok": True}
