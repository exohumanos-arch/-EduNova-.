"""
SQLAlchemy Database Configuration for MySQL (student_management_db).
Reads database credentials from environment variables (.env).
"""

from __future__ import annotations

import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DB_HOST = os.getenv("MYSQL_HOST", "localhost")
DB_PORT = os.getenv("MYSQL_PORT", "3306")
DB_USER = os.getenv("MYSQL_USER", "root")
DB_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
DB_NAME = os.getenv("MYSQL_DATABASE", "student_management_db")


def get_database_url() -> str:
    """Build SQLAlchemy connection URL from environment variables."""
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url
    encoded_user = quote_plus(DB_USER)
    encoded_pass = quote_plus(DB_PASSWORD)
    auth = f"{encoded_user}:{encoded_pass}" if DB_PASSWORD else encoded_user
    return f"mysql+pymysql://{auth}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"


DATABASE_URL = get_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a scoped SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Import all ORM models and create missing tables in MySQL."""
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)


def verify_connection() -> dict:
    """Verify MySQL connectivity and inspect the 5 core tables."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    expected = ["users", "students", "subjects", "examinations", "marks"]
    missing = [t for t in expected if t not in tables]
    return {
        "connected": True,
        "database": DB_NAME,
        "host": DB_HOST,
        "port": DB_PORT,
        "tables": tables,
        "missing_tables": missing,
    }
