"""
Result Processor Service
Computes complete student result dictionaries and cohort analytics from raw database rows.
Enforces strict rule: a student cannot pass overall if they fail any required subject.
Supports direct Python CLI execution via stdin/stdout JSON for Node.js integration.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List

# Allow standalone execution from any working directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.grade_calculator import (
    calculate_average,
    calculate_grade,
    calculate_percentage,
    calculate_total,
    find_highest_marks,
    find_lowest_marks,
)
from app.utils.python_data_structures import (
    RESULT_CATEGORIES,
    build_student_dictionary,
    summarize_cohort_collections,
)


def generate_student_result(
    student_row: Dict[str, Any],
    subject_marks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Build a complete calculated result dictionary for one student."""
    student_dict = build_student_dictionary(student_row, subject_marks)
    marks_list: List[float] = student_dict["marks_list"]
    max_marks_list: List[float] = student_dict["max_marks_list"]
    failed_subjects: List[str] = student_dict["failed_subjects"]

    total_obtained = calculate_total(marks_list)
    total_maximum = calculate_total(max_marks_list)
    average_marks = calculate_average(marks_list)
    percentage = calculate_percentage(total_obtained, total_maximum)
    highest_mark = find_highest_marks(marks_list)
    lowest_mark = find_lowest_marks(marks_list)

    grade, grade_label = calculate_grade(percentage)

    # Rule: Student cannot receive overall PASS if any required subject is failed
    if not marks_list:
        status = "PENDING"
        grade = "—"
        grade_label = "No Marks Recorded"
    elif len(failed_subjects) > 0 or percentage < 50.0:
        status = RESULT_CATEGORIES[1]  # "FAIL"
        if len(failed_subjects) > 0:
            grade = "F"
            grade_label = f"Failed in {len(failed_subjects)} subject(s)"
    else:
        status = RESULT_CATEGORIES[0]  # "PASS"

    return {
        "student_id": student_dict["student_id"],
        "roll_no": student_dict["roll_no"],
        "name": student_dict["name"],
        "email": student_dict["email"],
        "course": student_dict["course"],
        "branch": student_dict["branch"],
        "semester": student_dict["semester"],
        "subject_count": len(marks_list),
        "marks": student_dict["marks"],
        "marks_list": marks_list,
        "subject_breakdown": student_dict["subject_breakdown"],
        "total_obtained": total_obtained,
        "total_maximum": total_maximum,
        "average_marks": average_marks,
        "highest_mark": highest_mark,
        "lowest_mark": lowest_mark,
        "percentage": percentage,
        "grade": grade,
        "grade_label": grade_label,
        "failed_subjects": failed_subjects,
        "status": status,
    }


def generate_cohort_results(
    students: List[Dict[str, Any]],
    marks_rows: List[Dict[str, Any]],
    exam_id: int | None = None,
) -> Dict[str, Any]:
    """Compute results for all students and aggregate cohort analytics."""
    results_list: List[Dict[str, Any]] = []

    for student in students:
        sid = int(student["id"])
        student_marks = [
            m
            for m in marks_rows
            if int(m["student_id"]) == sid
            and (exam_id is None or int(m["exam_id"]) == int(exam_id))
        ]
        results_list.append(generate_student_result(student, student_marks))

    summary = summarize_cohort_collections(results_list)
    return {
        "results": results_list,
        "summary": summary,
    }


if __name__ == "__main__":
    raw_input = sys.stdin.read().strip()
    if not raw_input:
        print(json.dumps({"results": [], "summary": {}}))
        sys.exit(0)
    data = json.loads(raw_input)
    output = generate_cohort_results(
        students=data.get("students", []),
        marks_rows=data.get("marks", []),
        exam_id=data.get("exam_id"),
    )
    print(json.dumps(output))
