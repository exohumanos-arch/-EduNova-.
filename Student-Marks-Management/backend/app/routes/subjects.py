"""Subject CRUD routes (/api/subjects/*)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Subject, User
from app.routes.auth import get_current_user, require_admin
from app.schemas.academic import SubjectCreate

router = APIRouter(prefix="/api/subjects", tags=["Subjects"])


@router.get("")
def list_subjects(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Subject).order_by(Subject.semester.asc(), Subject.subject_code.asc()).all()


@router.post("", status_code=201)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    code = payload.subject_code.strip().upper()
    if db.query(Subject).filter(Subject.subject_code == code).first():
        raise HTTPException(status_code=409, detail="Subject code already exists")
    subj = Subject(
        subject_name=payload.subject_name.strip(),
        subject_code=code,
        max_marks=payload.max_marks,
        passing_marks=payload.passing_marks,
        semester=payload.semester,
    )
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return subj


@router.put("/{subject_id}")
def update_subject(
    subject_id: int,
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    subj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    subj.subject_name = payload.subject_name.strip()
    subj.subject_code = payload.subject_code.strip().upper()
    subj.max_marks = payload.max_marks
    subj.passing_marks = payload.passing_marks
    subj.semester = payload.semester
    db.commit()
    db.refresh(subj)
    return subj


@router.delete("/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    subj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(subj)
    db.commit()
    return {"deleted": True}
