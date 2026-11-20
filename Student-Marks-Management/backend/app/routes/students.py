"""Student CRUD, search, and filtering routes (/api/students/*)."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Student, User
from app.routes.auth import get_current_user, require_admin
from app.schemas.academic import StudentCreate, StudentUpdate

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.get("")
def list_students(
    search: Optional[str] = None,
    branch: Optional[str] = None,
    semester: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Student)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            (Student.name.ilike(like))
            | (Student.roll_no.ilike(like))
            | (Student.email.ilike(like))
        )
    if branch and branch.upper() != "ALL":
        query = query.filter(Student.branch == branch.strip())
    if semester is not None:
        query = query.filter(Student.semester == semester)
    return query.order_by(Student.roll_no.asc()).all()


@router.get("/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("", status_code=201)
def create_student(payload: StudentCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(Student).filter(Student.roll_no == payload.roll_no.strip()).first():
        raise HTTPException(status_code=409, detail="Roll number already exists")
    if db.query(Student).filter(Student.email == payload.email.lower()).first():
        raise HTTPException(status_code=409, detail="Student email already exists")
    student = Student(**payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.put("/{student_id}")
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    updates = payload.model_dump(exclude_unset=True)
    if "roll_no" in updates:
        conflict = db.query(Student).filter(Student.roll_no == updates["roll_no"], Student.id != student_id).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Roll number already assigned to another student")
    for key, val in updates.items():
        setattr(student, key, val)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
    return {"deleted": True}
