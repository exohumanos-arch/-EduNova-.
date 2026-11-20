"""Marks Management CRUD & Validation Routes (/api/marks/*)."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Examination, Mark, Student, Subject, User
from app.routes.auth import get_current_user, require_admin
from app.schemas.academic import MarkCreate

router = APIRouter(prefix="/api/marks", tags=["Marks"])


class MarkUpdate(BaseModel):
    obtained_marks: float = Field(..., ge=0)


@router.get("")
def list_marks(
    exam_id: Optional[int] = None,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Mark)
    if exam_id is not None:
        q = q.filter(Mark.exam_id == exam_id)
    if student_id is not None:
        q = q.filter(Mark.student_id == student_id)
    rows = q.all()
    return [
        {
            "mark_id": m.id,
            "student_id": m.student_id,
            "subject_id": m.subject_id,
            "exam_id": m.exam_id,
            "obtained_marks": float(m.obtained_marks),
            "student_name": m.student.name,
            "roll_no": m.student.roll_no,
            "branch": m.student.branch,
            "semester": m.student.semester,
            "subject_name": m.subject.subject_name,
            "subject_code": m.subject.subject_code,
            "max_marks": m.subject.max_marks,
            "passing_marks": m.subject.passing_marks,
            "exam_name": m.examination.exam_name,
            "exam_date": str(m.examination.exam_date),
        }
        for m in rows
    ]


@router.post("", status_code=201)
def upsert_mark(payload: MarkCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    exam = db.query(Examination).filter(Examination.id == payload.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    if payload.obtained_marks > subject.max_marks:
        raise HTTPException(status_code=400, detail=f"Marks cannot exceed max marks ({subject.max_marks})")

    existing = (
        db.query(Mark)
        .filter(
            Mark.student_id == payload.student_id,
            Mark.subject_id == payload.subject_id,
            Mark.exam_id == payload.exam_id,
        )
        .first()
    )
    if existing:
        existing.obtained_marks = payload.obtained_marks
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "updated": True, "obtained_marks": float(existing.obtained_marks)}

    mark = Mark(**payload.model_dump())
    db.add(mark)
    db.commit()
    db.refresh(mark)
    return {"id": mark.id, "obtained_marks": float(mark.obtained_marks)}


@router.put("/{mark_id}")
def update_mark(mark_id: int, payload: MarkUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    mark = db.query(Mark).filter(Mark.id == mark_id).first()
    if not mark:
        raise HTTPException(status_code=404, detail="Mark record not found")
    if payload.obtained_marks > mark.subject.max_marks:
        raise HTTPException(
            status_code=400,
            detail=f"Marks cannot exceed subject maximum ({mark.subject.max_marks})",
        )
    mark.obtained_marks = payload.obtained_marks
    db.commit()
    db.refresh(mark)
    return {"id": mark.id, "obtained_marks": float(mark.obtained_marks)}


@router.delete("/{mark_id}")
def delete_mark(mark_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    mark = db.query(Mark).filter(Mark.id == mark_id).first()
    if not mark:
        raise HTTPException(status_code=404, detail="Mark record not found")
    db.delete(mark)
    db.commit()
    return {"deleted": True}
