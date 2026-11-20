"""
Core Python Data Structures Module (Lists, Tuples, Dictionaries)
Used directly in backend result computation, cohort analytics, and validation.
Also supports CLI JSON execution so Node/Express or FastAPI can invoke identical logic.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, List, Tuple

# ---------------------------------------------------------------------------
# TUPLES: Fixed immutable academic configurations & grade boundaries
# ---------------------------------------------------------------------------
GRADE_RANGES: Tuple[Tuple[float, str, str], ...] = (
    (90.0, "A+", "Outstanding"),
    (80.0, "A", "Excellent"),
    (70.0, "B", "Very Good"),
    (60.0, "C", "Good"),
    (50.0, "D", "Pass"),
    (0.0, "F", "Needs Improvement"),
)

ACADEMIC_BRANCHES: Tuple[str, ...] = ("CSE", "AIML", "ECE", "IT", "ME")
RESULT_CATEGORIES: Tuple[str, str] = ("PASS", "FAIL")
SEMESTER_BOUNDS: Tuple[int, int] = (1, 8)


def build_student_dictionary(
    student_row: Dict[str, Any],
    subject_marks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Construct a structured Python Dictionary representing an individual student
    along with nested subject-wise marks dictionaries and raw marks lists.
    """
    # Dictionary mapping subject_name -> obtained marks
    marks_by_subject: Dict[str, float] = {}
    # List of individual mark values for aggregate arithmetic
    marks_list: List[float] = []
    max_marks_list: List[float] = []
    failed_subjects_list: List[str] = []
    subject_breakdown: List[Dict[str, Any]] = []

    for item in subject_marks:
        subj_name = str(item["subject_name"])
        subj_code = str(item["subject_code"])
        obtained = float(item["obtained_marks"])
        max_m = float(item["max_marks"])
        passing_m = float(item["passing_marks"])

        marks_by_subject[subj_name] = obtained
        marks_list.append(obtained)
        max_marks_list.append(max_m)

        passed_subject = obtained >= passing_m
        if not passed_subject:
            failed_subjects_list.append(subj_name)

        subject_breakdown.append(
            {
                "mark_id": item.get("mark_id"),
                "subject_id": item.get("subject_id"),
                "subject_code": subj_code,
                "subject_name": subj_name,
                "obtained_marks": round(obtained, 2),
                "max_marks": int(max_m),
                "passing_marks": int(passing_m),
                "passed": passed_subject,
            }
        )

    return {
        "student_id": int(student_row["id"]),
        "roll_no": str(student_row["roll_no"]),
        "name": str(student_row["name"]),
        "email": str(student_row.get("email", "")),
        "course": str(student_row["course"]),
        "branch": str(student_row["branch"]),
        "semester": int(student_row["semester"]),
        "marks": marks_by_subject,
        "marks_list": marks_list,
        "max_marks_list": max_marks_list,
        "failed_subjects": failed_subjects_list,
        "subject_breakdown": subject_breakdown,
    }


def summarize_cohort_collections(
    student_results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Demonstrate Lists, Tuples, and Dictionaries across the full cohort.
    Computes aggregate metrics, grade frequency dictionary, and ordered rankings.
    """
    percentages_list: List[float] = [
        float(r["percentage"]) for r in student_results if r["subject_count"] > 0
    ]

    # Dictionary counting grades across immutable GRADE_RANGES tuple
    grade_distribution: Dict[str, int] = {grade: 0 for _, grade, _ in GRADE_RANGES}
    for r in student_results:
        if r["subject_count"] > 0:
            g = r["grade"]
            grade_distribution[g] = grade_distribution.get(g, 0) + 1

    # Ranked list of student dictionaries (sorted descending by percentage)
    evaluated_students: List[Dict[str, Any]] = [
        r for r in student_results if r["subject_count"] > 0
    ]
    ranked_students: List[Dict[str, Any]] = sorted(
        evaluated_students,
        key=lambda item: (item["percentage"], item["total_obtained"]),
        reverse=True,
    )

    low_performers: List[Dict[str, Any]] = [
        r for r in evaluated_students if r["status"] == "FAIL" or r["percentage"] < 60.0
    ]

    avg_percentage = (
        round(sum(percentages_list) / len(percentages_list), 2)
        if percentages_list
        else 0.0
    )
    highest_pct = round(max(percentages_list), 2) if percentages_list else 0.0
    lowest_pct = round(min(percentages_list), 2) if percentages_list else 0.0
    pass_count = sum(1 for r in evaluated_students if r["status"] == "PASS")
    pass_rate = (
        round((pass_count / len(evaluated_students)) * 100.0, 2)
        if evaluated_students
        else 0.0
    )

    return {
        "grade_ranges_tuple": [
            {"min_percentage": min_p, "grade": g, "label": lbl}
            for min_p, g, lbl in GRADE_RANGES
        ],
        "academic_branches_tuple": list(ACADEMIC_BRANCHES),
        "percentages_list": percentages_list,
        "grade_distribution_dict": grade_distribution,
        "average_percentage": avg_percentage,
        "highest_percentage": highest_pct,
        "lowest_percentage": lowest_pct,
        "pass_count": pass_count,
        "evaluated_count": len(evaluated_students),
        "pass_rate": pass_rate,
        "top_students": ranked_students[:5],
        "low_performers": low_performers,
    }


if __name__ == "__main__":
    # CLI entry point for inspecting live data structures from JSON stdin
    raw = sys.stdin.read().strip()
    if raw:
        payload = json.loads(raw)
        students = payload.get("students", [])
        marks = payload.get("marks", [])
        built_dicts = []
        for s in students:
            s_marks = [m for m in marks if m["student_id"] == s["id"]]
            built_dicts.append(build_student_dictionary(s, s_marks))
        print(
            json.dumps(
                {
                    "grade_ranges_tuple": [
                        [min_p, grade, label] for min_p, grade, label in GRADE_RANGES
                    ],
                    "academic_branches_tuple": list(ACADEMIC_BRANCHES),
                    "sample_student_dict": built_dicts[0] if built_dicts else {},
                    "all_marks_matrix_list": [d["marks_list"] for d in built_dicts],
                }
            )
        )
