"""SQLAlchemy Subject ORM Model."""

from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (
        CheckConstraint("max_marks > 0", name="chk_subject_max_marks"),
        CheckConstraint("passing_marks >= 0", name="chk_subject_passing_non_neg"),
        CheckConstraint("passing_marks <= max_marks", name="chk_passing_lte_max"),
        CheckConstraint("semester BETWEEN 1 AND 12", name="chk_subject_semester"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    subject_name = Column(String(100), nullable=False)
    subject_code = Column(String(30), nullable=False, unique=True, index=True)
    max_marks = Column(Integer, nullable=False, default=100)
    passing_marks = Column(Integer, nullable=False, default=40)
    semester = Column(Integer, nullable=False, default=3)

    marks = relationship("Mark", back_populates="subject", cascade="all, delete-orphan")
