"""SQLAlchemy User ORM Model for Admin & Teacher RBAC."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, Integer, String
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    username = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("ADMIN", "TEACHER", name="user_roles"), nullable=False, default="TEACHER")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
