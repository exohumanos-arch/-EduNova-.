"""SQLAlchemy Examination ORM Model."""

from __future__ import annotations

from datetime import date
from sqlalchemy import CheckConstraint, Column, Date, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class Examination(Base):
    __tablename__ = "examinations"
    __table_args__ = (
        UniqueConstraint("exam_name", "semester", name="uq_exam_name_sem"),
        CheckConstraint("semester BETWEEN 1 AND 12", name="chk_exam_semester"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    exam_name = Column(String(100), nullable=False)
    semester = Column(Integer, nullable=False)
    exam_date = Column(Date, nullable=False, default=date.today)

    marks = relationship("Mark", back_populates="examination", cascade="all, delete-orphan")
