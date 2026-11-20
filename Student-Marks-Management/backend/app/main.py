"""
FastAPI Application Entry Point for Student Marks Management System.
Registers modular routers for Auth, Students, Subjects, Examinations,
Marks, Results, Dashboard Analytics, and CSV File Processing.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, verify_connection
from app.routes import (
    auth_router,
    examinations_router,
    marks_router,
    reports_router,
    results_router,
    students_router,
    subjects_router,
)

app = FastAPI(
    title="Student Marks Management System API",
    description="Modular FastAPI + SQLAlchemy + MySQL + Python Data Structures & CSV File Processing",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health/db", tags=["Health"])
def database_health():
    return verify_connection()


app.include_router(auth_router)
app.include_router(students_router)
app.include_router(subjects_router)
app.include_router(examinations_router)
app.include_router(marks_router)
app.include_router(results_router)
app.include_router(reports_router)
