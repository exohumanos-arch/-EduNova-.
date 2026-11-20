"""Modular FastAPI API Routers."""

from app.routes.auth import router as auth_router
from app.routes.examinations import router as examinations_router
from app.routes.marks import router as marks_router
from app.routes.reports import router as reports_router
from app.routes.results import router as results_router
from app.routes.students import router as students_router
from app.routes.subjects import router as subjects_router

__all__ = [
    "auth_router",
    "students_router",
    "subjects_router",
    "examinations_router",
    "marks_router",
    "results_router",
    "reports_router",
]
