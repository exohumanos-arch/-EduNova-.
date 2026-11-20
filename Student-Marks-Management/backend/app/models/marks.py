"""SQLAlchemy Mark ORM Model with foreign keys and composite unique constraint."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class Mark(Base):
    __tablename__ = "marks"
    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "exam_id", name="uq_student_subject_exam"),
        CheckConstraint("obtained_marks >= 0", name="chk_obtained_marks_non_neg"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    subject_id = Column(
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    exam_id = Column(
        Integer,
        ForeignKey("examinations.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    obtained_marks = Column(Numeric(6, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    student = relationship("Student", back_populates="marks")
    subject = relationship("Subject", back_populates="marks")
    examination = relationship("Examination", back_populates="marks")
