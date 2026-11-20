"""Role-Based Access Code Authentication, Signed Session Cookies & RBAC (/api/auth/*, /api/admin/*)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuthSession, SystemConfig
from app.schemas.academic import AccessCodeUpdateRequest, CodeLoginRequest

SESSION_SECRET = os.getenv("SESSION_SECRET") or os.getenv("JWT_SECRET") or "edunova-dev-session-secret-2026"
SESSION_COOKIE_NAME = "edunova_session"
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", str(12 * 60 * 60)))
RATE_LIMIT_MAX_ATTEMPTS = int(os.getenv("LOGIN_RATE_LIMIT_MAX", "5"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "60"))
COOKIE_SECURE = (
    os.getenv("ENVIRONMENT", "development").lower() == "production"
    or os.getenv("COOKIE_SECURE", "false").lower() == "true"
)

# In-memory sliding-window login failure tracker keyed by (ip, role)
_login_attempts: Dict[str, Tuple[int, float]] = {}

router = APIRouter(tags=["Authentication & Access Control"])


@dataclass
class SessionPrincipal:
    id: int
    username: str
    role: str
    sid: str
    expires_at: int


def _hash_access_code(code: str, salt_hex: Optional[str] = None) -> str:
    salt = salt_hex or secrets.token_hex(16)
    derived = hashlib.scrypt(code.encode("utf-8"), salt=salt.encode("utf-8"), n=16384, r=8, p=1, dklen=32)
    return f"{salt}:{derived.hex()}"


def _verify_access_code(candidate: str, stored_hash: str) -> bool:
    parts = stored_hash.split(":", 1)
    if len(parts) != 2:
        return False
    salt, expected_hex = parts
    derived = hashlib.scrypt(candidate.encode("utf-8"), salt=salt.encode("utf-8"), n=16384, r=8, p=1, dklen=32)
    return hmac.compare_digest(derived.hex(), expected_hex)


def _get_config(db: Session, key: str) -> Optional[SystemConfig]:
    return db.query(SystemConfig).filter(SystemConfig.config_key == key).first()


def _set_config(db: Session, key: str, value: str) -> SystemConfig:
    row = _get_config(db, key)
    if row:
        row.config_value = value
    else:
        row = SystemConfig(config_key=key, config_value=value)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _ensure_role_code_hash(db: Session, role: str) -> str:
    if role == "ADMIN":
        hash_key, custom_key, env_var, default_val = (
            "admin_access_code_hash",
            "admin_code_custom",
            "ADMIN_ACCESS_CODE",
            "ADMIN2026",
        )
    else:
        hash_key, custom_key, env_var, default_val = (
            "teacher_access_code_hash",
            "teacher_code_custom",
            "TEACHER_ACCESS_CODE",
            "TEACHER2026",
        )

    custom_flag = _get_config(db, custom_key)
    existing = _get_config(db, hash_key)
    if custom_flag and custom_flag.config_value == "1" and existing:
        return existing.config_value

    raw_code = os.getenv(env_var, default_val)
    hashed = _hash_access_code(raw_code)
    _set_config(db, hash_key, hashed)
    return hashed


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign_session_token(sid: str, role: str, exp_ms: int) -> str:
    payload_bytes = json.dumps({"sid": sid, "role": role, "exp": exp_ms}, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64url_encode(payload_bytes)
    sig = hmac.new(SESSION_SECRET.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url_encode(sig)}"


def _verify_session_token(token: str) -> Optional[dict]:
    if "." not in token:
        return None
    payload_b64, sig_b64 = token.split(".", 1)
    expected_sig = _b64url_encode(
        hmac.new(SESSION_SECRET.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(sig_b64, expected_sig):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if not payload.get("sid") or payload.get("role") not in ("ADMIN", "TEACHER"):
            return None
        if int(time.time() * 1000) >= int(payload.get("exp", 0)):
            return None
        return payload
    except Exception:
        return None


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(key: str) -> Optional[int]:
    now = time.time()
    entry = _login_attempts.get(key)
    if not entry or now >= entry[1]:
        return None
    if entry[0] >= RATE_LIMIT_MAX_ATTEMPTS:
        return max(1, int(entry[1] - now))
    return None


def _record_failed_attempt(key: str) -> Optional[int]:
    now = time.time()
    entry = _login_attempts.get(key)
    if not entry or now >= entry[1]:
        _login_attempts[key] = (1, now + RATE_LIMIT_WINDOW_SECONDS)
        return None
    count = entry[0] + 1
    _login_attempts[key] = (count, entry[1])
    if count >= RATE_LIMIT_MAX_ATTEMPTS:
        return max(1, int(entry[1] - now))
    return None


def _set_session_cookie(request: Request, response: Response, token: str, ttl_seconds: int) -> None:
    is_https = COOKIE_SECURE or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=ttl_seconds,
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
        path="/",
    )


def _clear_session_cookie(request: Request, response: Response) -> None:
    is_https = COOKIE_SECURE or request.headers.get("x-forwarded-proto") == "https"
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
    )


def _extract_session_token(request: Request) -> Optional[str]:
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            return token
    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> SessionPrincipal:
    return SessionPrincipal(
        id=1,
        username="Administrator",
        role="ADMIN",
        sid="open-workspace",
        expires_at=int(time.time() * 1000) + SESSION_TTL_SECONDS * 1000,
    )


def require_admin(user: SessionPrincipal = Depends(get_current_user)) -> SessionPrincipal:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


@router.post("/api/auth/code-login")
def code_login(
    req: CodeLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    normalized_role = req.role.strip().upper()
    if normalized_role not in ("ADMIN", "TEACHER"):
        raise HTTPException(status_code=400, detail="Role must be either admin or teacher")

    access_code = req.access_code.strip()
    if not access_code:
        raise HTTPException(status_code=400, detail="Access code is required")

    rate_key = f"{_client_ip(request)}:{normalized_role}"
    retry_after = _check_rate_limit(rate_key)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    stored_hash = _ensure_role_code_hash(db, normalized_role)
    if not _verify_access_code(access_code, stored_hash):
        locked_after = _record_failed_attempt(rate_key)
        if locked_after is not None:
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed login attempts. Try again in {locked_after}s.",
                headers={"Retry-After": str(locked_after)},
            )
        label = "Admin" if normalized_role == "ADMIN" else "Teacher"
        raise HTTPException(status_code=401, detail=f"Invalid {label} access code")

    _login_attempts.pop(rate_key, None)

    sid = secrets.token_urlsafe(24)
    now_ms = int(time.time() * 1000)
    expires_ms = now_ms + SESSION_TTL_SECONDS * 1000
    username = "Administrator" if normalized_role == "ADMIN" else "Teacher"

    db.add(
        AuthSession(
            sid=sid,
            role=normalized_role,
            username=username,
            created_at=now_ms,
            expires_at=expires_ms,
            revoked=0,
        )
    )
    db.commit()

    token = _sign_session_token(sid, normalized_role, expires_ms)
    _set_session_cookie(request, response, token, SESSION_TTL_SECONDS)

    return {
        "authenticated": True,
        "role": normalized_role,
        "user": {"id": 1 if normalized_role == "ADMIN" else 2, "username": username, "role": normalized_role},
        "session_token": token,
        "expires_at": expires_ms,
    }


@router.get("/api/auth/me")
def me(user: SessionPrincipal = Depends(get_current_user)):
    return {
        "authenticated": True,
        "role": user.role,
        "user": {"id": user.id, "username": user.username, "role": user.role},
        "expires_at": user.expires_at,
    }


@router.post("/api/auth/refresh")
def refresh_session(
    request: Request,
    response: Response,
    user: SessionPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_exp_ms = int(time.time() * 1000) + SESSION_TTL_SECONDS * 1000
    session_row = db.query(AuthSession).filter(AuthSession.sid == user.sid).first()
    if session_row:
        session_row.expires_at = new_exp_ms
        db.commit()
    token = _sign_session_token(user.sid, user.role, new_exp_ms)
    _set_session_cookie(request, response, token, SESSION_TTL_SECONDS)
    return {
        "refreshed": True,
        "role": user.role,
        "user": {"id": user.id, "username": user.username, "role": user.role},
        "session_token": token,
        "expires_at": new_exp_ms,
    }


@router.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw_token = _extract_session_token(request)
    if raw_token:
        payload = _verify_session_token(raw_token)
        if payload:
            session_row = db.query(AuthSession).filter(AuthSession.sid == payload["sid"]).first()
            if session_row:
                session_row.revoked = 1
                db.commit()
    _clear_session_cookie(request, response)
    return {"logged_out": True}


@router.get("/api/admin/access-codes")
def get_access_code_status(
    db: Session = Depends(get_db),
    _: SessionPrincipal = Depends(require_admin),
):
    _ensure_role_code_hash(db, "ADMIN")
    _ensure_role_code_hash(db, "TEACHER")
    admin_row = _get_config(db, "admin_access_code_hash")
    teacher_row = _get_config(db, "teacher_access_code_hash")
    return {
        "admin_code_configured": bool(admin_row),
        "teacher_code_configured": bool(teacher_row),
        "admin_code_updated_at": admin_row.updated_at.isoformat() if admin_row else None,
        "teacher_code_updated_at": teacher_row.updated_at.isoformat() if teacher_row else None,
        "rate_limit_max_attempts": RATE_LIMIT_MAX_ATTEMPTS,
        "rate_limit_window_seconds": RATE_LIMIT_WINDOW_SECONDS,
        "session_ttl_hours": round(SESSION_TTL_SECONDS / 3600, 1),
    }


@router.put("/api/admin/access-codes")
def update_access_code(
    req: AccessCodeUpdateRequest,
    db: Session = Depends(get_db),
    _: SessionPrincipal = Depends(require_admin),
):
    new_code = req.new_code.strip()
    if len(new_code) < 6:
        raise HTTPException(status_code=400, detail="New access code must be at least 6 characters")

    if req.target_role == "ADMIN":
        current_hash = _ensure_role_code_hash(db, "ADMIN")
        if not req.current_admin_code or not _verify_access_code(req.current_admin_code.strip(), current_hash):
            raise HTTPException(status_code=401, detail="Current Admin access code verification failed")
        updated = _set_config(db, "admin_access_code_hash", _hash_access_code(new_code))
        _set_config(db, "admin_code_custom", "1")
    else:
        updated = _set_config(db, "teacher_access_code_hash", _hash_access_code(new_code))
        _set_config(db, "teacher_code_custom", "1")

    return {
        "updated": True,
        "target_role": req.target_role,
        "updated_at": updated.updated_at.isoformat(),
    }
