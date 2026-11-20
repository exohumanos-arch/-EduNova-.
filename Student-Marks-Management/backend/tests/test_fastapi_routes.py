"""
FastAPI Backend End-to-End Test Suite (pytest)
Uses FastAPI TestClient with an isolated SQLite test database to validate direct
open API access, Student/Subject/Exam/Marks CRUD, validations, and result calculation.
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


def test_direct_open_crud_and_results(client: TestClient):
    s_res = client.post(
        "/api/students",
        json={
            "name": "Rahul",
            "roll_no": "2026001",
            "email": "rahul@t.edu",
            "course": "B.Tech",
            "branch": "CSE",
            "semester": 3,
        },
    )
    assert s_res.status_code == 201
    student_id = s_res.json()["id"]

    dup_s = client.post(
        "/api/students",
        json={
            "name": "Rahul 2",
            "roll_no": "2026001",
            "email": "rahul2@t.edu",
            "course": "B.Tech",
            "branch": "CSE",
            "semester": 3,
        },
    )
    assert dup_s.status_code == 409

    sub_res = client.post(
        "/api/subjects",
        json={
            "subject_name": "Python",
            "subject_code": "PY301",
            "max_marks": 100,
            "passing_marks": 40,
            "semester": 3,
        },
    )
    assert sub_res.status_code == 201
    subject_id = sub_res.json()["id"]

    exam_res = client.post(
        "/api/examinations",
        json={"exam_name": "Finals 2026", "semester": 3, "exam_date": "2026-11-20"},
    )
    assert exam_res.status_code == 201
    exam_id = exam_res.json()["id"]

    ok_mark = client.post(
        "/api/marks",
        json={
            "student_id": student_id,
            "subject_id": subject_id,
            "exam_id": exam_id,
            "obtained_marks": 92,
        },
    )
    assert ok_mark.status_code in (200, 201)

    res_student = client.get(f"/api/results/{student_id}?exam_id={exam_id}")
    assert res_student.status_code == 200
    assert res_student.json()["grade"] == "A+"
    assert res_student.json()["status"] == "PASS"
