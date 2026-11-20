"""
CSV File Processing Service
Uses Python's built-in csv.DictReader and csv.DictWriter to validate,
parse, import, and export student and examination marks records,
plus generate downloadable CSV error reports.
"""

from __future__ import annotations

import csv
import io
import json
import os
import sys
from typing import Any, Dict, List, Tuple

REQUIRED_STUDENT_HEADERS: Tuple[str, ...] = ("roll_no", "name", "course", "branch", "semester")
REQUIRED_MARKS_HEADERS: Tuple[str, ...] = ("roll_no", "subject_code", "exam_name", "marks")


def parse_students_csv(csv_text: str) -> Dict[str, Any]:
    """Read and validate a student CSV string using csv.DictReader."""
    if not csv_text or not csv_text.strip():
        return {"valid_rows": [], "errors": ["Uploaded CSV file is empty."]}

    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    if not reader.fieldnames:
        return {"valid_rows": [], "errors": ["CSV header row is missing."]}

    normalized_headers = [h.strip().lower() for h in reader.fieldnames if h]
    missing_headers = [h for h in REQUIRED_STUDENT_HEADERS if h not in normalized_headers]
    if missing_headers:
        return {
            "valid_rows": [],
            "errors": [f"Missing required CSV header(s): {', '.join(missing_headers)}"],
        }

    valid_rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    seen_rolls: set[str] = set()

    for idx, raw_row in enumerate(reader, start=2):
        row = {str(k).strip().lower(): (v.strip() if v is not None else "") for k, v in raw_row.items() if k}
        roll_no = row.get("roll_no", "")
        name = row.get("name", "")
        course = row.get("course", "")
        branch = row.get("branch", "")
        sem_raw = row.get("semester", "")
        email = row.get("email", "") or f"{roll_no.lower()}@student.acadledger.edu"

        if not roll_no or not name or not course or not branch or not sem_raw:
            errors.append(f"Row {idx}: Missing required field (roll_no, name, course, branch, or semester).")
            continue

        if roll_no in seen_rolls:
            errors.append(f"Row {idx}: Duplicate roll_no '{roll_no}' inside CSV file.")
            continue

        try:
            semester = int(sem_raw)
            if semester < 1 or semester > 12:
                raise ValueError("out of range")
        except ValueError:
            errors.append(f"Row {idx}: Invalid semester '{sem_raw}' (must be 1–12).")
            continue

        seen_rolls.add(roll_no)
        valid_rows.append(
            {
                "roll_no": roll_no,
                "name": name,
                "email": email,
                "course": course,
                "branch": branch,
                "semester": semester,
            }
        )

    return {"valid_rows": valid_rows, "errors": errors}


def parse_marks_csv(csv_text: str) -> Dict[str, Any]:
    """Read and validate an examination marks CSV string using csv.DictReader."""
    if not csv_text or not csv_text.strip():
        return {"valid_rows": [], "errors": ["Uploaded CSV file is empty."]}

    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    if not reader.fieldnames:
        return {"valid_rows": [], "errors": ["CSV header row is missing."]}

    normalized_headers = [h.strip().lower() for h in reader.fieldnames if h]
    missing_headers = [h for h in REQUIRED_MARKS_HEADERS if h not in normalized_headers]
    if missing_headers:
        return {
            "valid_rows": [],
            "errors": [f"Missing required CSV header(s): {', '.join(missing_headers)}"],
        }

    valid_rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    seen_keys: set[Tuple[str, str, str]] = set()

    for idx, raw_row in enumerate(reader, start=2):
        row = {str(k).strip().lower(): (v.strip() if v is not None else "") for k, v in raw_row.items() if k}
        roll_no = row.get("roll_no", "")
        subject_code = row.get("subject_code", "")
        exam_name = row.get("exam_name", "")
        marks_raw = row.get("marks", "")

        if not roll_no or not subject_code or not exam_name or marks_raw == "":
            errors.append(f"Row {idx}: Missing roll_no, subject_code, exam_name, or marks.")
            continue

        key = (roll_no, subject_code.upper(), exam_name.lower())
        if key in seen_keys:
            errors.append(f"Row {idx}: Duplicate entry for {roll_no} / {subject_code} / {exam_name}.")
            continue

        try:
            marks_val = float(marks_raw)
            if marks_val < 0:
                raise ValueError("negative")
        except ValueError:
            errors.append(f"Row {idx}: Invalid marks value '{marks_raw}' (must be >= 0).")
            continue

        seen_keys.add(key)
        valid_rows.append(
            {
                "roll_no": roll_no,
                "subject_code": subject_code.upper(),
                "exam_name": exam_name,
                "obtained_marks": round(marks_val, 2),
            }
        )

    return {"valid_rows": valid_rows, "errors": errors}


def generate_csv_export(columns: List[str], rows: List[Dict[str, Any]], out_path: str | None = None) -> str:
    """Generate CSV content using Python csv.DictWriter and optionally persist to exports/."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    csv_output = buf.getvalue()

    if out_path:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8", newline="") as f:
            f.write(csv_output)

    return csv_output


def generate_error_report_csv(errors: List[str], out_path: str | None = None) -> str:
    """Create a downloadable CSV error report from validation error messages."""
    rows = [{"error_number": idx, "detail": msg} for idx, msg in enumerate(errors, start=1)]
    return generate_csv_export(["error_number", "detail"], rows, out_path=out_path)


if __name__ == "__main__":
    raw = sys.stdin.read()
    payload = json.loads(raw)
    action = payload.get("action")
    if action == "parse_students":
        print(json.dumps(parse_students_csv(payload.get("csv_text", ""))))
    elif action == "parse_marks":
        print(json.dumps(parse_marks_csv(payload.get("csv_text", ""))))
    elif action == "export_csv":
        csv_str = generate_csv_export(
            columns=payload.get("columns", []),
            rows=payload.get("rows", []),
            out_path=payload.get("out_path"),
        )
        print(json.dumps({"csv": csv_str}))
    elif action == "error_report":
        csv_str = generate_error_report_csv(
            errors=payload.get("errors", []),
            out_path=payload.get("out_path"),
        )
        print(json.dumps({"csv": csv_str}))
