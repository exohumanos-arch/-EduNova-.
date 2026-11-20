"""SQLAlchemy Student ORM Model."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import CheckConstraint, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint("semester BETWEEN 1 AND 12", name="chk_student_semester"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    roll_no = Column(String(30), nullable=False, unique=True, index=True)
    email = Column(String(100), nullable=False, unique=True)
    course = Column(String(100), nullable=False)
    branch = Column(String(100), nullable=False, index=True)
    semester = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    marks = relationship("Mark", back_populates="student", cascade="all, delete-orphan")
