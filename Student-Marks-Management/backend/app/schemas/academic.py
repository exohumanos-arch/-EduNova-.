"""Pydantic Validation Schemas for FastAPI REST APIs."""

from __future__ import annotations

from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class CodeLoginRequest(BaseModel):
    role: str = Field(..., min_length=4, max_length=16)
    access_code: str = Field(..., min_length=1, max_length=128)


class AccessCodeUpdateRequest(BaseModel):
    target_role: Literal["ADMIN", "TEACHER"]
    new_code: str = Field(..., min_length=6, max_length=64)
    current_admin_code: Optional[str] = None


class StudentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    roll_no: str = Field(..., min_length=2, max_length=30)
    email: EmailStr
    course: str = Field(..., min_length=2, max_length=100)
    branch: str = Field(..., min_length=2, max_length=100)
    semester: int = Field(..., ge=1, le=12)


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    roll_no: Optional[str] = Field(None, min_length=2, max_length=30)
    email: Optional[EmailStr] = None
    course: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[int] = Field(None, ge=1, le=12)


class SubjectCreate(BaseModel):
    subject_name: str = Field(..., min_length=2, max_length=100)
    subject_code: str = Field(..., min_length=2, max_length=30)
    max_marks: int = Field(..., gt=0, le=500)
    passing_marks: int = Field(..., ge=0)
    semester: int = Field(..., ge=1, le=12)

    @field_validator("passing_marks")
    @classmethod
    def check_passing(cls, v: int, info):
        max_m = info.data.get("max_marks")
        if max_m is not None and v > max_m:
            raise ValueError("passing_marks cannot exceed max_marks")
        return v


class ExamCreate(BaseModel):
    exam_name: str = Field(..., min_length=2, max_length=100)
    semester: int = Field(..., ge=1, le=12)
    exam_date: date


class MarkCreate(BaseModel):
    student_id: int
    subject_id: int
    exam_id: int
    obtained_marks: float = Field(..., ge=0)
