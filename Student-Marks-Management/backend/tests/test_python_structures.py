import os
import sys

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.file_processor import (
    generate_csv_export,
    generate_error_report_csv,
    parse_marks_csv,
    parse_students_csv,
)
from app.services.grade_calculator import (
    calculate_average,
    calculate_grade,
    calculate_percentage,
    calculate_total,
    find_highest_marks,
    find_lowest_marks,
)
from app.services.result_processor import generate_cohort_results, generate_student_result


def test_list_calculations():
    marks = [85, 78, 90, 82]
    assert calculate_total(marks) == 335.0
    assert calculate_average(marks) == 83.75
    assert find_highest_marks(marks) == 90.0
    assert find_lowest_marks(marks) == 78.0
    assert calculate_percentage(335, 400) == 83.75
    assert calculate_total([]) == 0.0
    assert calculate_percentage(0, 0) == 0.0


def test_tuple_grade_boundaries():
    assert calculate_grade(100.0)[0] == "A+"
    assert calculate_grade(90.0)[0] == "A+"
    assert calculate_grade(89.99)[0] == "A"
    assert calculate_grade(80.0)[0] == "A"
    assert calculate_grade(70.0)[0] == "B"
    assert calculate_grade(60.0)[0] == "C"
    assert calculate_grade(50.0)[0] == "D"
    assert calculate_grade(49.99)[0] == "F"
    assert calculate_grade(0.0)[0] == "F"


def test_subject_fail_overrides_overall_pass():
    student = {
        "id": 1,
        "roll_no": "2026001",
        "name": "Rahul Sharma",
        "email": "rahul@example.com",
        "course": "B.Tech",
        "branch": "CSE",
        "semester": 3,
    }
    marks = [
        {
            "subject_id": 1,
            "subject_code": "PY301",
            "subject_name": "Python",
            "obtained_marks": 95,
            "max_marks": 100,
            "passing_marks": 40,
        },
        {
            "subject_id": 2,
            "subject_code": "MA301",
            "subject_name": "Maths",
            "obtained_marks": 32,
            "max_marks": 100,
            "passing_marks": 40,
        },
    ]
    res = generate_student_result(student, marks)
    assert res["status"] == "FAIL"
    assert res["grade"] == "F"
    assert "Maths" in res["failed_subjects"]


def test_pending_student_result_without_marks():
    student = {
        "id": 2,
        "roll_no": "2026002",
        "name": "Ananya Iyer",
        "email": "ananya@example.com",
        "course": "B.Tech",
        "branch": "CSE",
        "semester": 3,
    }
    res = generate_student_result(student, [])
    assert res["status"] == "PENDING"
    assert res["subject_count"] == 0
    assert res["total_obtained"] == 0.0


def test_cohort_aggregation():
    students = [
        {"id": 1, "roll_no": "101", "name": "Alice", "email": "a@e.com", "course": "BTech", "branch": "CSE", "semester": 3},
        {"id": 2, "roll_no": "102", "name": "Bob", "email": "b@e.com", "course": "BTech", "branch": "ECE", "semester": 3},
    ]
    marks = [
        {"student_id": 1, "exam_id": 1, "subject_id": 1, "subject_code": "PY301", "subject_name": "Python", "obtained_marks": 92, "max_marks": 100, "passing_marks": 40},
        {"student_id": 2, "exam_id": 1, "subject_id": 1, "subject_code": "PY301", "subject_name": "Python", "obtained_marks": 54, "max_marks": 100, "passing_marks": 40},
    ]
    cohort = generate_cohort_results(students, marks, exam_id=1)
    assert cohort["summary"]["evaluated_count"] == 2
    assert cohort["summary"]["pass_count"] == 2
    assert cohort["summary"]["average_percentage"] == 73.0
    assert cohort["summary"]["highest_percentage"] == 92.0
    assert cohort["summary"]["lowest_percentage"] == 54.0


def test_csv_file_processing_and_error_reports():
    # Empty CSV
    empty_res = parse_students_csv("")
    assert len(empty_res["valid_rows"]) == 0
    assert len(empty_res["errors"]) == 1

    # Missing required headers
    bad_header = parse_students_csv("roll_no,name\n101,Rahul\n")
    assert len(bad_header["valid_rows"]) == 0
    assert "Missing required CSV header" in bad_header["errors"][0]

    # Duplicate roll_no, missing field, and invalid semester
    csv_data = (
        "roll_no,name,course,branch,semester\n"
        "101,Rahul,BTech,CSE,3\n"
        "101,Rahul Dup,BTech,CSE,3\n"
        "102,Aman,BTech,AIML,19\n"
        "103,,BTech,CSE,3\n"
    )
    parsed = parse_students_csv(csv_data)
    assert len(parsed["valid_rows"]) == 1
    assert len(parsed["errors"]) == 3

    # Marks CSV: negative marks, non-numeric, duplicate entry
    marks_csv = (
        "roll_no,subject_code,exam_name,marks\n"
        "101,PY301,Finals,88\n"
        "101,PY301,Finals,90\n"
        "102,PY301,Finals,-5\n"
        "103,PY301,Finals,abc\n"
    )
    parsed_marks = parse_marks_csv(marks_csv)
    assert len(parsed_marks["valid_rows"]) == 1
    assert len(parsed_marks["errors"]) == 3

    err_csv = generate_error_report_csv(parsed_marks["errors"])
    assert "error_number,detail" in err_csv
    assert "negative" in err_csv or "Invalid marks" in err_csv

    exported = generate_csv_export(["roll_no", "name"], [{"roll_no": "101", "name": "Rahul"}])
    assert "roll_no,name" in exported
    assert "101,Rahul" in exported
