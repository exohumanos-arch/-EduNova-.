"""
FastAPI Backend End-to-End Test Suite (pytest)
Uses FastAPI TestClient with an isolated SQLite test database to validate all 8
two-role access-code auth, signed HttpOnly cookie, Bearer fallback, RBAC, rate-limit, and CRUD scenarios.
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
    client.cookies.clear()
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/students").status_code == 401
    assert client.post("/api/marks", json={}).status_code == 401
    assert client.get("/api/dashboard").status_code == 401


def test_wrong_access_codes_rejected_and_rate_limited(client: TestClient):
    bad_admin = client.post(
        "/api/auth/code-login",
        json={"role": "admin", "access_code": "WRONG_ADMIN"},
        headers={"X-Forwarded-For": "192.0.2.10"},
    )
    assert bad_admin.status_code == 401

    bad_teacher = client.post(
        "/api/auth/code-login",
        json={"role": "teacher", "access_code": "WRONG_TEACHER"},
        headers={"X-Forwarded-For": "192.0.2.11"},
    )
    assert bad_teacher.status_code == 401

    for _ in range(4):
        r = client.post(
            "/api/auth/code-login",
            json={"role": "admin", "access_code": "BAD_GUESS"},
            headers={"X-Forwarded-For": "192.0.2.99"},
        )
        assert r.status_code == 401
    r5 = client.post(
        "/api/auth/code-login",
        json={"role": "admin", "access_code": "BAD_GUESS"},
        headers={"X-Forwarded-For": "192.0.2.99"},
    )
    assert r5.status_code == 429


def test_two_role_auth_rbac_crud_and_session_lifecycle(client: TestClient):
    admin_code = os.getenv("ADMIN_ACCESS_CODE", "ADMIN2026")
    teacher_code = os.getenv("TEACHER_ACCESS_CODE", "TEACHER2026")

    client.cookies.clear()
    r_teacher = client.post(
        "/api/auth/code-login",
        json={"role": "teacher", "access_code": teacher_code},
        headers={"X-Forwarded-For": "192.0.2.20"},
    )
    assert r_teacher.status_code == 200
    assert r_teacher.json()["role"] == "TEACHER"
    assert "edunova_session" in r_teacher.cookies
    assert r_teacher.json().get("session_token")

    # Teacher accessing Admin APIs -> 403 Forbidden
    assert (
        client.post(
            "/api/students",
            json={
                "name": "S1",
                "roll_no": "R01",
                "email": "s1@t.edu",
                "course": "B.Tech",
                "branch": "CSE",
                "semester": 3,
            },
        ).status_code
        == 403
    )
    assert client.get("/api/admin/access-codes").status_code == 403
    assert client.get("/api/export/students").status_code == 403

    # Logout terminates Teacher session
    teacher_cookie = r_teacher.cookies.get("edunova_session")
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me", cookies={"edunova_session": teacher_cookie}).status_code == 401

    # Admin login + Bearer fallback check
    client.cookies.clear()
    r_admin = client.post(
        "/api/auth/code-login",
        json={"role": "admin", "access_code": admin_code},
        headers={"X-Forwarded-For": "192.0.2.21"},
    )
    assert r_admin.status_code == 200
    assert r_admin.json()["role"] == "ADMIN"
    admin_token = r_admin.json()["session_token"]

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

    # Teacher marks validations & result calculation
    client.cookies.clear()
    client.post(
        "/api/auth/code-login",
        json={"role": "teacher", "access_code": teacher_code},
        headers={"X-Forwarded-For": "192.0.2.22"},
    )
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

    # Bearer token works when cookies are cleared
    client.cookies.clear()
    assert (
        client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}).status_code
        == 200
    )

    # Tampered/expired session cookie -> 401
    assert (
        client.get("/api/auth/me", cookies={"edunova_session": "tampered.token"}).status_code
        == 401
    )
