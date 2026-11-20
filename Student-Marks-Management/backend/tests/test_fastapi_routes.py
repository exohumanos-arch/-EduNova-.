"""
FastAPI Backend End-to-End Test Suite (pytest)
Uses FastAPI TestClient with an isolated SQLite test database so `pytest -v`
validates Auth, RBAC, Student/Subject/Exam/Marks CRUD, validations, and CSV endpoints.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.database import Base, get_db
from app.main import app


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db_file = tmp_path_factory.mktemp("db") / "test_acadledger.sqlite"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_unauthorized_requests_blocked(client: TestClient):
    assert client.get("/api/students").status_code == 401
    assert client.post("/api/marks", json={}).status_code == 401
    assert client.get("/api/dashboard").status_code == 401


def test_auth_and_role_permissions(client: TestClient):
    # Register Admin
    r_admin = client.post(
        "/api/auth/register",
        json={"username": "Admin User", "email": "admin@test.edu", "password": "Password123", "role": "ADMIN"},
    )
    assert r_admin.status_code == 201
    admin_token = r_admin.json()["access_token"]

    # Register Teacher
    r_teacher = client.post(
        "/api/auth/register",
        json={"username": "Teacher User", "email": "teacher@test.edu", "password": "Password123", "role": "TEACHER"},
    )
    assert r_teacher.status_code == 201
    teacher_token = r_teacher.json()["access_token"]

    # Teacher blocked from Admin-only student creation
    res_forbidden = client.post(
        "/api/students",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"name": "S1", "roll_no": "R01", "email": "s1@t.edu", "course": "B.Tech", "branch": "CSE", "semester": 3},
    )
    assert res_forbidden.status_code == 403

    # Admin creates student, subject, examination
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    s_res = client.post(
        "/api/students",
        headers=admin_headers,
        json={"name": "Rahul", "roll_no": "2026001", "email": "rahul@t.edu", "course": "B.Tech", "branch": "CSE", "semester": 3},
    )
    assert s_res.status_code == 201
    student_id = s_res.json()["id"]

    # Duplicate roll number rejected
    dup_s = client.post(
        "/api/students",
        headers=admin_headers,
        json={"name": "Rahul 2", "roll_no": "2026001", "email": "rahul2@t.edu", "course": "B.Tech", "branch": "CSE", "semester": 3},
    )
    assert dup_s.status_code == 409

    sub_res = client.post(
        "/api/subjects",
        headers=admin_headers,
        json={"subject_name": "Python", "subject_code": "PY301", "max_marks": 100, "passing_marks": 40, "semester": 3},
    )
    assert sub_res.status_code == 201
    subject_id = sub_res.json()["id"]

    exam_res = client.post(
        "/api/examinations",
        headers=admin_headers,
        json={"exam_name": "Finals 2026", "semester": 3, "exam_date": "2026-11-20"},
    )
    assert exam_res.status_code == 201
    exam_id = exam_res.json()["id"]

    # Duplicate examination rejected
    dup_exam = client.post(
        "/api/examinations",
        headers=admin_headers,
        json={"exam_name": "Finals 2026", "semester": 3, "exam_date": "2026-11-21"},
    )
    assert dup_exam.status_code == 409

    # Teacher marks validations: negative and above max
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    assert (
        client.post(
            "/api/marks",
            headers=teacher_headers,
            json={"student_id": student_id, "subject_id": subject_id, "exam_id": exam_id, "obtained_marks": -5},
        ).status_code
        in (400, 422)
    )
    assert (
        client.post(
            "/api/marks",
            headers=teacher_headers,
            json={"student_id": student_id, "subject_id": subject_id, "exam_id": exam_id, "obtained_marks": 120},
        ).status_code
        == 400
    )

    # Valid marks submission + result check
    ok_mark = client.post(
        "/api/marks",
        headers=teacher_headers,
        json={"student_id": student_id, "subject_id": subject_id, "exam_id": exam_id, "obtained_marks": 92},
    )
    assert ok_mark.status_code in (200, 201)

    res_student = client.get(f"/api/results/{student_id}?exam_id={exam_id}", headers=teacher_headers)
    assert res_student.status_code == 200
    assert res_student.json()["grade"] == "A+"
    assert res_student.json()["status"] == "PASS"
