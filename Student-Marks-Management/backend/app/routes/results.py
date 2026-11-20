"""Result Management & Dashboard Analytics Routes (/api/results/*, /api/dashboard)."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Examination, Mark, Student, Subject, User
from app.routes.auth import get_current_user
from app.services.result_processor import generate_cohort_results, generate_student_result

router = APIRouter(tags=["Results & Dashboard"])


def _fetch_marks_dicts(db: Session, exam_id: Optional[int] = None):
    q = db.query(Mark)
    if exam_id is not None:
        q = q.filter(Mark.exam_id == exam_id)
    return [
        {
            "mark_id": m.id,
            "student_id": m.student_id,
            "subject_id": m.subject_id,
            "exam_id": m.exam_id,
            "obtained_marks": float(m.obtained_marks),
            "subject_name": m.subject.subject_name,
            "subject_code": m.subject.subject_code,
            "max_marks": m.subject.max_marks,
            "passing_marks": m.subject.passing_marks,
        }
        for m in q.all()
    ]


@router.get("/api/results")
def get_all_results(exam_id: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    students = [
        {
            "id": s.id,
            "roll_no": s.roll_no,
            "name": s.name,
            "email": s.email,
            "course": s.course,
            "branch": s.branch,
            "semester": s.semester,
        }
        for s in db.query(Student).order_by(Student.roll_no.asc()).all()
    ]
    marks_rows = _fetch_marks_dicts(db, exam_id=exam_id)
    return generate_cohort_results(students, marks_rows, exam_id=exam_id)


@router.get("/api/results/{student_id}")
def get_student_result(
    student_id: int,
    exam_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    marks_rows = [m for m in _fetch_marks_dicts(db, exam_id=exam_id) if m["student_id"] == student_id]
    return generate_student_result(
        {
            "id": student.id,
            "roll_no": student.roll_no,
            "name": student.name,
            "email": student.email,
            "course": student.course,
            "branch": student.branch,
            "semester": student.semester,
        },
        marks_rows,
    )


@router.get("/api/dashboard")
def get_dashboard(exam_id: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cohort = get_all_results(exam_id=exam_id, db=db, _=_)
    total_students = db.query(Student).count()
    total_subjects = db.query(Subject).count()
    total_exams = db.query(Examination).count()

    subjects = db.query(Subject).order_by(Subject.subject_code.asc()).all()
    marks_rows = _fetch_marks_dicts(db, exam_id=exam_id)

    subject_stats = []
    for sub in subjects:
        sub_scores = [float(m["obtained_marks"]) for m in marks_rows if m["subject_id"] == sub.id]
        avg = round(sum(sub_scores) / len(sub_scores), 2) if sub_scores else 0.0
        passed = sum(1 for v in sub_scores if v >= sub.passing_marks)
        pass_rate = round((passed / len(sub_scores)) * 100.0, 1) if sub_scores else 0.0
        subject_stats.append(
            {
                "subject_id": sub.id,
                "subject_code": sub.subject_code,
                "subject_name": sub.subject_name,
                "max_marks": sub.max_marks,
                "passing_marks": sub.passing_marks,
                "average_marks": avg,
                "pass_rate": pass_rate,
                "entries": len(sub_scores),
            }
        )

    return {
        "exam_id": exam_id,
        "kpis": {
            "total_students": total_students,
            "total_subjects": total_subjects,
            "total_examinations": total_exams,
            "average_percentage": cohort["summary"]["average_percentage"],
            "pass_rate": cohort["summary"]["pass_rate"],
            "highest_percentage": cohort["summary"]["highest_percentage"],
            "lowest_percentage": cohort["summary"]["lowest_percentage"],
        },
        "summary": cohort["summary"],
        "results": cohort["results"],
        "subject_stats": subject_stats,
    }
