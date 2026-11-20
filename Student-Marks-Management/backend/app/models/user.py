"""SQLAlchemy ORM Models for Role-Based Access Code Auth, Sessions & Config."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import BigInteger, Column, DateTime, Enum, Integer, String, Text
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    username = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("ADMIN", "TEACHER", name="user_roles"), nullable=False, default="TEACHER")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SystemConfig(Base):
    __tablename__ = "system_config"

    config_key = Column(String(100), primary_key=True, index=True)
    config_value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    sid = Column(String(128), primary_key=True, index=True)
    role = Column(String(20), nullable=False)
    username = Column(String(100), nullable=False)
    created_at = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=False)
    revoked = Column(Integer, nullable=False, default=0)
