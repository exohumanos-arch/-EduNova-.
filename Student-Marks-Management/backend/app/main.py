"""
FastAPI Application Entry Point for Student Marks Management System.
Registers modular routers for Auth, Students, Subjects, Examinations,
Marks, Results, Dashboard Analytics, and CSV File Processing.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, str):
        message = detail
    elif isinstance(detail, dict) and isinstance(detail.get("message"), str):
        message = detail["message"]
    elif isinstance(detail, list):
        message = ", ".join(
            item.get("msg", str(item)) if isinstance(item, dict) else str(item)
            for item in detail
        )
    else:
        message = "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": message, "detail": detail},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    parts = []
    for err in exc.errors():
        loc = ".".join(str(x) for x in err.get("loc", []) if x != "body")
        msg = err.get("msg", "Invalid value")
        parts.append(f"{loc}: {msg}" if loc else str(msg))
    message = ", ".join(parts) if parts else "Invalid request payload"
    return JSONResponse(
        status_code=422,
        content={"success": False, "message": message, "detail": exc.errors()},
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
