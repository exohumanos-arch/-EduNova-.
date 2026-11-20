"""
MySQL + SQLAlchemy Database Connection & Schema Verification Script.
Run: python verify_db.py
"""

from __future__ import annotations

import os
import sys

BACKEND_ROOT = os.path.dirname(os.path.abspath(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, init_db, verify_connection
from app.models import Examination, Mark, Student, Subject


def main() -> None:
    print("1. Initializing SQLAlchemy models in MySQL...")
    init_db()

    print("2. Verifying MySQL database connection...")
    status = verify_connection()
    print(f"   Connected to '{status['database']}' on {status['host']}:{status['port']}")
    print(f"   Tables found: {status['tables']}")
    if status["missing_tables"]:
        raise RuntimeError(f"Missing expected tables: {status['missing_tables']}")

    inspector = inspect(SessionLocal().get_bind())
    print("3. Verifying foreign keys and unique constraints on 'marks' and 'students'...")
    student_uniques = [u["column_names"] for u in inspector.get_unique_constraints("students")]
    marks_uniques = [u["column_names"] for u in inspector.get_unique_constraints("marks")]
    marks_fks = [fk["referred_table"] for fk in inspector.get_foreign_keys("marks")]

    print(f"   students unique constraints: {student_uniques}")
    print(f"   marks unique constraints:    {marks_uniques}")
    print(f"   marks foreign keys ->:       {marks_fks}")

    # Test duplicate prevention inside a rolled-back transaction
    db = SessionLocal()
    try:
        s1 = Student(
            name="Verify Test",
            roll_no="VERIFY999",
            email="verify999@test.edu",
            course="B.Tech",
            branch="CSE",
            semester=3,
        )
        db.add(s1)
        db.flush()

        s_dup = Student(
            name="Verify Dup",
            roll_no="VERIFY999",
            email="verify999b@test.edu",
            course="B.Tech",
            branch="CSE",
            semester=3,
        )
        db.add(s_dup)
        try:
            db.flush()
            raise AssertionError("Expected IntegrityError for duplicate roll_no!")
        except IntegrityError:
            db.rollback()
            print("   Verified: Duplicate student roll_no rejected by DB constraint.")
    finally:
        db.close()

    print("Database verification completed successfully.")


if __name__ == "__main__":
    main()
