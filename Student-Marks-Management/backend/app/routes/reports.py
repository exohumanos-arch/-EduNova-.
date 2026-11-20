"""CSV Import & Export Routes (/api/import/* and /api/export/*)."""

from __future__ import annotations

import os
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Examination, Mark, Student, Subject, User
from app.routes.auth import get_current_user, require_admin
from app.routes.results import get_all_results, get_student_result
from app.services.file_processor import (
    generate_csv_export,
    generate_error_report_csv,
    parse_marks_csv,
    parse_students_csv,
)

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOADS_DIR = os.path.join(BACKEND_ROOT, "uploads")
EXPORTS_DIR = os.path.join(BACKEND_ROOT, "exports")
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(EXPORTS_DIR, exist_ok=True)

router = APIRouter(tags=["CSV File Processing"])


@router.post("/api/import/students")
async def import_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are permitted")

    raw_bytes = await file.read()
    upload_path = os.path.join(UPLOADS_DIR, os.path.basename(file.filename))
    with open(upload_path, "wb") as f:
        f.write(raw_bytes)

    parsed = parse_students_csv(raw_bytes.decode("utf-8", errors="ignore"))
    inserted = 0
    errors: List[str] = list(parsed["errors"])

    for row in parsed["valid_rows"]:
        if db.query(Student).filter(Student.roll_no == row["roll_no"]).first():
            errors.append(f"Roll {row['roll_no']} already exists in database.")
            continue
        db.add(Student(**row))
        inserted += 1
    db.commit()

    error_report_csv = (
        generate_error_report_csv(errors, os.path.join(EXPORTS_DIR, "students_import_errors.csv"))
        if errors
        else ""
    )
    return {
        "inserted": inserted,
        "total_valid": len(parsed["valid_rows"]),
        "errors": errors,
        "error_report_csv": error_report_csv,
    }


@router.post("/api/import/marks")
async def import_marks(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are permitted")

    raw_bytes = await file.read()
    upload_path = os.path.join(UPLOADS_DIR, os.path.basename(file.filename))
    with open(upload_path, "wb") as f:
        f.write(raw_bytes)

    parsed = parse_marks_csv(raw_bytes.decode("utf-8", errors="ignore"))
    upserted = 0
    errors: List[str] = list(parsed["errors"])

    for row in parsed["valid_rows"]:
        student = db.query(Student).filter(Student.roll_no == row["roll_no"]).first()
        if not student:
            errors.append(f"Student roll_no '{row['roll_no']}' not found.")
            continue
        subject = db.query(Subject).filter(Subject.subject_code == row["subject_code"]).first()
        if not subject:
            errors.append(f"Subject code '{row['subject_code']}' not found.")
            continue
        if row["obtained_marks"] > subject.max_marks:
            errors.append(f"Marks {row['obtained_marks']} exceed max marks ({subject.max_marks}).")
            continue
        exam = db.query(Examination).filter(Examination.exam_name.ilike(row["exam_name"])).first()
        if not exam:
            errors.append(f"Examination '{row['exam_name']}' not found.")
            continue

        existing = (
            db.query(Mark)
            .filter(Mark.student_id == student.id, Mark.subject_id == subject.id, Mark.exam_id == exam.id)
            .first()
        )
        if existing:
            existing.obtained_marks = row["obtained_marks"]
        else:
            db.add(Mark(student_id=student.id, subject_id=subject.id, exam_id=exam.id, obtained_marks=row["obtained_marks"]))
        upserted += 1

    db.commit()
    error_report_csv = (
        generate_error_report_csv(errors, os.path.join(EXPORTS_DIR, "marks_import_errors.csv"))
        if errors
        else ""
    )
    return {
        "upserted": upserted,
        "total_valid": len(parsed["valid_rows"]),
        "errors": errors,
        "error_report_csv": error_report_csv,
    }


@router.get("/api/export/students", response_class=PlainTextResponse)
def export_students(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = [
        {
            "roll_no": s.roll_no,
            "name": s.name,
            "email": s.email,
            "course": s.course,
            "branch": s.branch,
            "semester": s.semester,
        }
        for s in db.query(Student).order_by(Student.roll_no.asc()).all()
    ]
    return generate_csv_export(
        ["roll_no", "name", "email", "course", "branch", "semester"],
        rows,
        out_path=os.path.join(EXPORTS_DIR, "students_export.csv"),
    )


@router.get("/api/export/marks", response_class=PlainTextResponse)
def export_marks(exam_id: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(Mark)
    if exam_id is not None:
        q = q.filter(Mark.exam_id == exam_id)
    rows = [
        {
            "roll_no": m.student.roll_no,
            "student_name": m.student.name,
            "subject_code": m.subject.subject_code,
            "subject_name": m.subject.subject_name,
            "exam_name": m.examination.exam_name,
            "obtained_marks": float(m.obtained_marks),
            "max_marks": m.subject.max_marks,
        }
        for m in q.all()
    ]
    return generate_csv_export(
        ["roll_no", "student_name", "subject_code", "subject_name", "exam_name", "obtained_marks", "max_marks"],
        rows,
        out_path=os.path.join(EXPORTS_DIR, "marks_export.csv"),
    )


@router.get("/api/export/results", response_class=PlainTextResponse)
def export_results(exam_id: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cohort = get_all_results(exam_id=exam_id, db=db, _=_)
    rows = [
        {
            "roll_no": r["roll_no"],
            "name": r["name"],
            "branch": r["branch"],
            "semester": r["semester"],
            "total_obtained": r["total_obtained"],
            "total_maximum": r["total_maximum"],
            "percentage": r["percentage"],
            "grade": r["grade"],
            "status": r["status"],
            "failed_subjects": "; ".join(r["failed_subjects"]),
        }
        for r in cohort["results"]
    ]
    return generate_csv_export(
        ["roll_no", "name", "branch", "semester", "total_obtained", "total_maximum", "percentage", "grade", "status", "failed_subjects"],
        rows,
        out_path=os.path.join(EXPORTS_DIR, "results_report.csv"),
    )


@router.get("/api/export/results/{student_id}", response_class=PlainTextResponse)
def export_individual_result(
    student_id: int,
    exam_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    res = get_student_result(student_id=student_id, exam_id=exam_id, db=db, _=_)
    rows = [
        {
            "roll_no": res["roll_no"],
            "student_name": res["name"],
            "subject_code": b["subject_code"],
            "subject_name": b["subject_name"],
            "obtained_marks": b["obtained_marks"],
            "max_marks": b["max_marks"],
            "passing_marks": b["passing_marks"],
            "subject_status": "PASS" if b["passed"] else "FAIL",
            "overall_percentage": res["percentage"],
            "overall_grade": res["grade"],
            "overall_status": res["status"],
        }
        for b in res["subject_breakdown"]
    ]
    return generate_csv_export(
        [
            "roll_no",
            "student_name",
            "subject_code",
            "subject_name",
            "obtained_marks",
            "max_marks",
            "passing_marks",
            "subject_status",
            "overall_percentage",
            "overall_grade",
            "overall_status",
        ],
        rows,
        out_path=os.path.join(EXPORTS_DIR, f"result_{res['roll_no']}.csv"),
    )
