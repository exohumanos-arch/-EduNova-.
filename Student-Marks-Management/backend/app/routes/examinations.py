"""Examination CRUD routes (/api/examinations/*)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Examination, User
from app.routes.auth import get_current_user, require_admin
from app.schemas.academic import ExamCreate

router = APIRouter(prefix="/api/examinations", tags=["Examinations"])


@router.get("")
def list_examinations(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Examination).order_by(Examination.exam_date.desc()).all()


@router.post("", status_code=201)
def create_examination(payload: ExamCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    existing = (
        db.query(Examination)
        .filter(Examination.exam_name == payload.exam_name.strip(), Examination.semester == payload.semester)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Examination already exists for this semester")
    exam = Examination(
        exam_name=payload.exam_name.strip(),
        semester=payload.semester,
        exam_date=payload.exam_date,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@router.put("/{exam_id}")
def update_examination(
    exam_id: int,
    payload: ExamCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    conflict = (
        db.query(Examination)
        .filter(
            Examination.exam_name == payload.exam_name.strip(),
            Examination.semester == payload.semester,
            Examination.id != exam_id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail="Examination already exists for this semester")
    exam.exam_name = payload.exam_name.strip()
    exam.semester = payload.semester
    exam.exam_date = payload.exam_date
    db.commit()
    db.refresh(exam)
    return exam


@router.delete("/{exam_id}")
def delete_examination(exam_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    db.delete(exam)
    db.commit()
    return {"deleted": True}
