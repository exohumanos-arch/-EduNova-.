"""Authentication & RBAC Dependencies + Routes (/api/auth/* and /api/users/*)."""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.academic import LoginRequest, RegisterRequest

SECRET_KEY = os.getenv("JWT_SECRET", "change-this-secret-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

router = APIRouter(tags=["Authentication & Users"])


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


@router.post("/api/auth/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        username=req.username.strip(),
        email=req.email.lower(),
        password_hash=pwd_context.hash(req.password),
        role=req.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.email, "role": user.role, "uid": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role},
    }


@router.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user.email, "role": user.role, "uid": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role},
    }


@router.post("/api/auth/refresh")
def refresh_token(user: User = Depends(get_current_user)):
    token = create_access_token({"sub": user.email, "role": user.role, "uid": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/api/auth/logout")
def logout(_: User = Depends(get_current_user)):
    return {"logged_out": True}


@router.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role}}


@router.get("/api/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users = db.query(User).order_by(User.id.asc()).all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "created_at": u.created_at} for u in users]


@router.post("/api/users", status_code=201)
def create_user(req: RegisterRequest, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        username=req.username.strip(),
        email=req.email.lower(),
        password_hash=pwd_context.hash(req.password),
        role=req.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role}


@router.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_admin: User = Depends(require_admin)):
    if current_admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete currently active administrator")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"deleted": True}
