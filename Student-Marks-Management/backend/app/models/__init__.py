"""Export all SQLAlchemy ORM models so Base.metadata discovers them."""

from app.models.examination import Examination
from app.models.marks import Mark
from app.models.student import Student
from app.models.subject import Subject
from app.models.user import User

__all__ = ["User", "Student", "Subject", "Examination", "Mark"]
