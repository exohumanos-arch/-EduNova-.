"""Re-export modular SQLAlchemy ORM models for backward compatibility."""

from app.models.examination import Examination
from app.models.marks import Mark
from app.models.student import Student
from app.models.subject import Subject
from app.models.user import AuthSession, SystemConfig, User

__all__ = ["User", "SystemConfig", "AuthSession", "Student", "Subject", "Examination", "Mark"]
