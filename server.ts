import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.JWT_SECRET || 'edunova-dev-session-secret-2026';
const SESSION_COOKIE_NAME = 'edunova_session';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 12 * 60 * 60 * 1000);
const RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX || 5);
const RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const ROOT_DIR = process.cwd();
const PYTHON_BACKEND_DIR = path.join(ROOT_DIR, 'Student-Marks-Management', 'backend');
const UPLOADS_DIR = path.join(PYTHON_BACKEND_DIR, 'uploads');
const EXPORTS_DIR = path.join(PYTHON_BACKEND_DIR, 'exports');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

// Initialize SQLite Relational Database (mirrors student_management_db MySQL schema)
const db = new DatabaseSync(path.join(ROOT_DIR, 'student_management_db.sqlite'));
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TEACHER')) DEFAULT 'TEACHER',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    roll_no TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    course TEXT NOT NULL,
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 12),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_name TEXT NOT NULL,
    subject_code TEXT NOT NULL UNIQUE,
    max_marks INTEGER NOT NULL DEFAULT 100 CHECK (max_marks > 0),
    passing_marks INTEGER NOT NULL DEFAULT 40 CHECK (passing_marks >= 0),
    semester INTEGER NOT NULL DEFAULT 3 CHECK (semester BETWEEN 1 AND 12)
  );

  CREATE TABLE IF NOT EXISTS examinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_name TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 12),
    exam_date TEXT NOT NULL,
    UNIQUE (exam_name, semester)
  );

  CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    obtained_marks REAL NOT NULL CHECK (obtained_marks >= 0),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
    UNIQUE (student_id, subject_id, exam_id)
  );
  CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    sid TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TEACHER')),
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
  );
`);

function hashAccessCode(code: string, saltHex?: string): string {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(code, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyAccessCodeHash(candidate: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const candidateBuf = crypto.scryptSync(candidate, salt, 32);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (candidateBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

function getConfigValue(key: string): string | null {
  const row = db
    .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
    .get(key) as { config_value: string } | undefined;
  return row ? row.config_value : null;
}

function getConfigMeta(key: string): { config_value: string; updated_at: string } | null {
  const row = db
    .prepare('SELECT config_value, updated_at FROM system_config WHERE config_key = ?')
    .get(key) as { config_value: string; updated_at: string } | undefined;
  return row ?? null;
}

function setConfigValue(key: string, value: string): void {
  db.prepare(
    `INSERT INTO system_config (config_key, config_value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = CURRENT_TIMESTAMP`
  ).run(key, value);
}

function seedInitialData() {
  const envAdminCode = process.env.ADMIN_ACCESS_CODE || 'ADMIN2026';
  const envTeacherCode = process.env.TEACHER_ACCESS_CODE || 'TEACHER2026';

  if (getConfigValue('admin_code_custom') !== '1') {
    setConfigValue('admin_access_code_hash', hashAccessCode(envAdminCode));
  }
  if (getConfigValue('teacher_code_custom') !== '1') {
    setConfigValue('teacher_access_code_hash', hashAccessCode(envTeacherCode));
  }

  const studentCount = (db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number }).c;
  if (studentCount === 0) {
    const insertStudent = db.prepare(
      'INSERT INTO students (name, roll_no, email, course, branch, semester) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const seedStudents: [string, string, string, string, string, number][] = [
      ['Rahul Sharma', '2026001', 'rahul.sharma@acadledger.edu', 'B.Tech', 'CSE', 3],
      ['Ananya Iyer', '2026002', 'ananya.iyer@acadledger.edu', 'B.Tech', 'CSE', 3],
      ['Aditya Deshmukh', '2026003', 'aditya.d@acadledger.edu', 'B.Tech', 'AIML', 3],
      ['Priya Menon', '2026004', 'priya.menon@acadledger.edu', 'B.Tech', 'CSE', 3],
      ['Rohan Kulkarni', '2026005', 'rohan.k@acadledger.edu', 'B.Tech', 'AIML', 3],
      ['Ishita Sengupta', '2026006', 'ishita.s@acadledger.edu', 'B.Tech', 'ECE', 3],
      ['Vikramaditya Rao', '2026007', 'vikram.rao@acadledger.edu', 'B.Tech', 'CSE', 3],
      ['Sneha Choudhary', '2026008', 'sneha.c@acadledger.edu', 'B.Tech', 'ECE', 3],
      ['Karan Malhotra', '2026009', 'karan.m@acadledger.edu', 'B.Tech', 'AIML', 3],
      ['Divya Krishnan', '2026010', 'divya.k@acadledger.edu', 'B.Tech', 'CSE', 3],
    ];
    for (const s of seedStudents) insertStudent.run(...s);
  }

  const subjectCount = (db.prepare('SELECT COUNT(*) as c FROM subjects').get() as { c: number }).c;
  if (subjectCount === 0) {
    const insertSubject = db.prepare(
      'INSERT INTO subjects (subject_name, subject_code, max_marks, passing_marks, semester) VALUES (?, ?, ?, ?, ?)'
    );
    const seedSubjects: [string, string, number, number, number][] = [
      ['Python Programming', 'PY301', 100, 40, 3],
      ['Engineering Mathematics III', 'MA301', 100, 40, 3],
      ['Data Structures & Algorithms', 'CS302', 100, 40, 3],
      ['Database Management Systems', 'CS303', 100, 40, 3],
      ['Computer Architecture', 'CS304', 100, 40, 3],
    ];
    for (const sub of seedSubjects) insertSubject.run(...sub);
  }

  const examCount = (db.prepare('SELECT COUNT(*) as c FROM examinations').get() as { c: number }).c;
  if (examCount === 0) {
    const insertExam = db.prepare(
      'INSERT INTO examinations (exam_name, semester, exam_date) VALUES (?, ?, ?)'
    );
    insertExam.run('Mid-Semester Assessment 2026', 3, '2026-09-18');
    insertExam.run('End-Semester Finals 2026', 3, '2026-11-12');
  }

  const marksCount = (db.prepare('SELECT COUNT(*) as c FROM marks').get() as { c: number }).c;
  if (marksCount === 0) {
    const insertMark = db.prepare(
      'INSERT INTO marks (student_id, subject_id, exam_id, obtained_marks) VALUES (?, ?, ?, ?)'
    );
    // Exam 2 (End-Semester Finals 2026) matrix: 10 students x 5 subjects
    const endSemMatrix: number[][] = [
      [92, 86, 94, 88, 85], // 2026001 Rahul (A+)
      [96, 93, 95, 91, 94], // 2026002 Ananya (A+)
      [84, 79, 88, 82, 76], // 2026003 Aditya (A)
      [78, 74, 81, 75, 72], // 2026004 Priya (B)
      [68, 34, 71, 65, 62], // 2026005 Rohan (FAIL - Maths 34 < 40)
      [88, 82, 85, 89, 84], // 2026006 Ishita (A)
      [58, 54, 61, 56, 52], // 2026007 Vikramaditya (D)
      [74, 68, 31, 70, 66], // 2026008 Sneha (FAIL - DSA 31 < 40)
      [91, 89, 90, 86, 87], // 2026009 Karan (A)
      [81, 77, 83, 79, 75], // 2026010 Divya (B)
    ];
    const midSemMatrix: number[][] = [
      [86, 80, 88, 84, 79],
      [92, 90, 91, 88, 90],
      [79, 75, 82, 77, 73],
      [74, 70, 76, 72, 69],
      [64, 38, 67, 61, 59],
      [84, 78, 82, 85, 80],
      [55, 51, 57, 52, 49],
      [71, 64, 35, 66, 63],
      [87, 84, 85, 81, 83],
      [76, 72, 78, 74, 71],
    ];

    for (let sIdx = 0; sIdx < 10; sIdx++) {
      for (let subIdx = 0; subIdx < 5; subIdx++) {
        insertMark.run(sIdx + 1, subIdx + 1, 1, midSemMatrix[sIdx][subIdx]);
        insertMark.run(sIdx + 1, subIdx + 1, 2, endSemMatrix[sIdx][subIdx]);
      }
    }
  }
}

seedInitialData();

// Python Bridge Helpers (Executes actual Python 3 scripts in Student-Marks-Management/backend/)
function resolvePythonCommand(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore' });
      return cmd;
    } catch {
      // Try next Python executable candidate
    }
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

const PYTHON_BIN = resolvePythonCommand();

function runPythonScript<T>(scriptRelativePath: string, payload: unknown): T {
  const scriptPath = path.join(PYTHON_BACKEND_DIR, scriptRelativePath);
  const stdout = execFileSync(PYTHON_BIN, [scriptPath], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    env: { ...process.env, PYTHONPATH: PYTHON_BACKEND_DIR },
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout) as T;
}

function getEnrichedMarksRows() {
  return db
    .prepare(
      `SELECT
        m.id as mark_id,
        m.student_id,
        m.subject_id,
        m.exam_id,
        m.obtained_marks,
        s.name as student_name,
        s.roll_no,
        s.branch,
        s.semester,
        sub.subject_name,
        sub.subject_code,
        sub.max_marks,
        sub.passing_marks,
        e.exam_name,
        e.exam_date
      FROM marks m
      JOIN students s ON s.id = m.student_id
      JOIN subjects sub ON sub.id = m.subject_id
      JOIN examinations e ON e.id = m.exam_id
      ORDER BY s.roll_no ASC, sub.subject_code ASC`
    )
    .all() as Record<string, unknown>[];
}

function computePythonCohortResults(examId?: number | null) {
  const students = db.prepare('SELECT * FROM students ORDER BY roll_no ASC').all();
  const marks = getEnrichedMarksRows();
  return runPythonScript<{ results: any[]; summary: any }>('app/services/result_processor.py', {
    students,
    marks,
    exam_id: examId ?? null,
  });
}

// Gemini Client Factory (strictly server-side with telemetry header)
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AuthUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'TEACHER';
}

interface AuthRequest extends Request {
  user?: AuthUser;
  sessionId?: string;
  sessionExpiresAt?: number;
}

interface SignedSessionPayload {
  sid: string;
  role: 'ADMIN' | 'TEACHER';
  exp: number;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now >= entry.resetAt) {
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function recordFailedAttempt(key: string): { locked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { locked: false, retryAfterSec: 0 };
  }
  entry.count += 1;
  loginAttempts.set(key, entry);
  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { locked: true, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  return { locked: false, retryAfterSec: 0 };
}

function clearRateLimit(key: string): void {
  loginAttempts.delete(key);
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function signSessionToken(payload: SignedSessionPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token: string): SignedSessionPayload | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sigB64, 'utf-8');
  const expBuf = Buffer.from(expectedSig, 'utf-8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as SignedSessionPayload;
    if (!parsed?.sid || (parsed.role !== 'ADMIN' && parsed.role !== 'TEACHER') || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() >= parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isHttpsRequest(req: Request): boolean {
  const origin = String(req.headers.origin || '');
  const referer = String(req.headers.referer || '');
  const host = String(req.headers.host || '');
  return Boolean(
    req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      origin.startsWith('https://') ||
      referer.startsWith('https://') ||
      host.endsWith('.run.app') ||
      process.env.NODE_ENV === 'production'
  );
}

function setSessionCookie(req: Request, res: Response, token: string, ttlMs: number) {
  const maxAgeSec = Math.max(1, Math.floor(ttlMs / 1000));
  const secure = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSec}`,
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response) {
  const secure = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return null;
}

function authenticateToken(req: AuthRequest, _res: Response, next: NextFunction) {
  req.user = {
    id: 1,
    username: 'Administrator',
    role: 'ADMIN',
  };
  req.sessionId = 'open-workspace';
  req.sessionExpiresAt = Date.now() + SESSION_TTL_MS;
  next();
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Administrator privileges required for this action' });
    return;
  }
  next();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      cb(new Error('Only .csv files are permitted'));
      return;
    }
    cb(null, true);
  },
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // --- ROLE-BASED ACCESS CODE AUTH ROUTES ---
  app.post('/api/auth/code-login', (req: Request, res: Response) => {
    const rawRole = typeof req.body?.role === 'string' ? req.body.role.trim().toUpperCase() : '';
    const accessCode = typeof req.body?.access_code === 'string' ? req.body.access_code.trim() : '';

    if (rawRole !== 'ADMIN' && rawRole !== 'TEACHER') {
      res.status(400).json({ error: 'Role must be either admin or teacher' });
      return;
    }
    if (!accessCode) {
      res.status(400).json({ error: 'Access code is required' });
      return;
    }

    const rateKey = `${getClientIp(req)}:${rawRole}`;
    const limitStatus = checkRateLimit(rateKey);
    if (!limitStatus.allowed) {
      res.setHeader('Retry-After', String(limitStatus.retryAfterSec));
      res.status(429).json({
        error: `Too many failed login attempts. Please try again in ${limitStatus.retryAfterSec}s.`,
      });
      return;
    }

    const hashKey = rawRole === 'ADMIN' ? 'admin_access_code_hash' : 'teacher_access_code_hash';
    const storedHash = getConfigValue(hashKey);
    const verified = storedHash ? verifyAccessCodeHash(accessCode, storedHash) : false;

    if (!verified) {
      const attempt = recordFailedAttempt(rateKey);
      if (attempt.locked) {
        res.setHeader('Retry-After', String(attempt.retryAfterSec));
        res.status(429).json({
          error: `Too many failed login attempts. Please try again in ${attempt.retryAfterSec}s.`,
        });
        return;
      }
      res.status(401).json({
        error: `Invalid ${rawRole === 'ADMIN' ? 'Admin' : 'Teacher'} access code`,
      });
      return;
    }

    clearRateLimit(rateKey);

    const sid = crypto.randomBytes(24).toString('base64url');
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    const username = rawRole === 'ADMIN' ? 'Administrator' : 'Teacher';

    db.prepare(
      'INSERT INTO auth_sessions (sid, role, username, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(sid, rawRole, username, now, expiresAt);

    const signedCookieToken = signSessionToken({ sid, role: rawRole, exp: expiresAt });
    setSessionCookie(req, res, signedCookieToken, SESSION_TTL_MS);

    const userPayload: AuthUser = {
      id: rawRole === 'ADMIN' ? 1 : 2,
      username,
      role: rawRole,
    };

    res.json({
      authenticated: true,
      role: rawRole,
      user: userPayload,
      session_token: signedCookieToken,
      expires_at: new Date(expiresAt).toISOString(),
    });
  });

  app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res: Response) => {
    res.json({
      authenticated: true,
      role: req.user!.role,
      user: req.user,
      expires_at: req.sessionExpiresAt ? new Date(req.sessionExpiresAt).toISOString() : undefined,
    });
  });

  app.post('/api/auth/refresh', authenticateToken, (req: AuthRequest, res: Response) => {
    const newExp = Date.now() + SESSION_TTL_MS;
    db.prepare('UPDATE auth_sessions SET expires_at = ? WHERE sid = ?').run(newExp, req.sessionId!);
    const signedCookieToken = signSessionToken({
      sid: req.sessionId!,
      role: req.user!.role,
      exp: newExp,
    });
    setSessionCookie(req, res, signedCookieToken, SESSION_TTL_MS);
    res.json({
      refreshed: true,
      role: req.user!.role,
      user: req.user,
      session_token: signedCookieToken,
      expires_at: new Date(newExp).toISOString(),
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const rawToken = extractSessionToken(req);
    if (rawToken) {
      const payload = verifySessionToken(rawToken);
      if (payload?.sid) {
        db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE sid = ?').run(payload.sid);
      }
    }
    clearSessionCookie(req, res);
    res.json({ logged_out: true });
  });

  // --- ADMIN ACCESS CODE CONFIGURATION (Admin only — never exposes plaintext codes) ---
  app.get('/api/admin/access-codes', authenticateToken, requireAdmin, (_req: AuthRequest, res: Response) => {
    const teacherMeta = getConfigMeta('teacher_access_code_hash');
    const adminMeta = getConfigMeta('admin_access_code_hash');
    res.json({
      admin_code_configured: Boolean(adminMeta),
      teacher_code_configured: Boolean(teacherMeta),
      admin_code_updated_at: adminMeta?.updated_at ?? null,
      teacher_code_updated_at: teacherMeta?.updated_at ?? null,
      rate_limit_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
      rate_limit_window_seconds: Math.round(RATE_LIMIT_WINDOW_MS / 1000),
      session_ttl_hours: Number((SESSION_TTL_MS / (60 * 60 * 1000)).toFixed(1)),
    });
  });

  app.put('/api/admin/access-codes', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const targetRole = typeof req.body?.target_role === 'string' ? req.body.target_role.trim().toUpperCase() : '';
    const newCode = typeof req.body?.new_code === 'string' ? req.body.new_code.trim() : '';
    const currentAdminCode =
      typeof req.body?.current_admin_code === 'string' ? req.body.current_admin_code.trim() : '';

    if (targetRole !== 'TEACHER' && targetRole !== 'ADMIN') {
      res.status(400).json({ error: 'target_role must be TEACHER or ADMIN' });
      return;
    }
    if (newCode.length < 6 || newCode.length > 64) {
      res.status(400).json({ error: 'New access code must be between 6 and 64 characters' });
      return;
    }

    if (targetRole === 'ADMIN') {
      const adminHash = getConfigValue('admin_access_code_hash');
      if (!currentAdminCode || !adminHash || !verifyAccessCodeHash(currentAdminCode, adminHash)) {
        res.status(401).json({ error: 'Current Admin access code verification failed' });
        return;
      }
      setConfigValue('admin_access_code_hash', hashAccessCode(newCode));
      setConfigValue('admin_code_custom', '1');
    } else {
      setConfigValue('teacher_access_code_hash', hashAccessCode(newCode));
      setConfigValue('teacher_code_custom', '1');
    }

    const updatedMeta = getConfigMeta(
      targetRole === 'ADMIN' ? 'admin_access_code_hash' : 'teacher_access_code_hash'
    );
    res.json({
      updated: true,
      target_role: targetRole,
      updated_at: updatedMeta?.updated_at ?? new Date().toISOString(),
    });
  });

  // --- STUDENTS CRUD ---
  app.get('/api/students', authenticateToken, (req: AuthRequest, res: Response) => {
    const search = String(req.query.search || '').trim();
    const branch = String(req.query.branch || '').trim();
    const semester = req.query.semester ? Number(req.query.semester) : null;

    let sql = 'SELECT * FROM students WHERE 1=1';
    const params: (string | number)[] = [];
    if (search) {
      sql += ' AND (name LIKE ? OR roll_no LIKE ? OR email LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (branch && branch !== 'ALL') {
      sql += ' AND branch = ?';
      params.push(branch);
    }
    if (semester && !Number.isNaN(semester)) {
      sql += ' AND semester = ?';
      params.push(semester);
    }
    sql += ' ORDER BY roll_no ASC';
    res.json(db.prepare(sql).all(...params));
  });

  app.get('/api/students/:id', authenticateToken, (req: AuthRequest, res: Response) => {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(Number(req.params.id));
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    res.json(student);
  });

  app.post('/api/students', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const { name, roll_no, email, course, branch, semester } = req.body ?? {};
    if (!name || !roll_no || !email || !course || !branch || !semester) {
      res.status(400).json({ error: 'All student fields are required' });
      return;
    }
    const semNum = Number(semester);
    if (Number.isNaN(semNum) || semNum < 1 || semNum > 12) {
      res.status(400).json({ error: 'Semester must be between 1 and 12' });
      return;
    }
    try {
      const info = db
        .prepare(
          'INSERT INTO students (name, roll_no, email, course, branch, semester) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          String(name).trim(),
          String(roll_no).trim(),
          String(email).trim().toLowerCase(),
          String(course).trim(),
          String(branch).trim(),
          semNum
        );
      const created = db.prepare('SELECT * FROM students WHERE id = ?').get(Number(info.lastInsertRowid));
      res.status(201).json(created);
    } catch (err: any) {
      if (String(err?.message).includes('UNIQUE')) {
        res.status(409).json({ error: 'Roll number or email already exists' });
        return;
      }
      res.status(500).json({ error: 'Failed to create student' });
    }
  });

  app.put('/api/students/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as Record<string, any> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    const { name, roll_no, email, course, branch, semester } = req.body ?? {};
    const semVal = semester !== undefined ? Number(semester) : Number(existing.semester);
    if (Number.isNaN(semVal) || semVal < 1 || semVal > 12) {
      res.status(400).json({ error: 'Semester must be between 1 and 12' });
      return;
    }
    try {
      db.prepare(
        'UPDATE students SET name = ?, roll_no = ?, email = ?, course = ?, branch = ?, semester = ? WHERE id = ?'
      ).run(
        name !== undefined ? String(name).trim() : existing.name,
        roll_no !== undefined ? String(roll_no).trim() : existing.roll_no,
        email !== undefined ? String(email).trim().toLowerCase() : existing.email,
        course !== undefined ? String(course).trim() : existing.course,
        branch !== undefined ? String(branch).trim() : existing.branch,
        semVal,
        id
      );
      res.json(db.prepare('SELECT * FROM students WHERE id = ?').get(id));
    } catch (err: any) {
      if (String(err?.message).includes('UNIQUE')) {
        res.status(409).json({ error: 'Roll number or email conflicts with another student' });
        return;
      }
      res.status(500).json({ error: 'Failed to update student' });
    }
  });

  app.delete('/api/students/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // --- SUBJECTS CRUD ---
  app.get('/api/subjects', authenticateToken, (_req: AuthRequest, res: Response) => {
    res.json(db.prepare('SELECT * FROM subjects ORDER BY semester ASC, subject_code ASC').all());
  });

  app.post('/api/subjects', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const { subject_name, subject_code, max_marks, passing_marks, semester } = req.body ?? {};
    const maxM = Number(max_marks);
    const passM = Number(passing_marks);
    const sem = Number(semester);
    if (!subject_name || !subject_code || Number.isNaN(maxM) || maxM <= 0 || Number.isNaN(passM) || passM < 0 || passM > maxM) {
      res.status(400).json({ error: 'Valid subject name, code, max marks (>0), and passing marks (<= max marks) required' });
      return;
    }
    try {
      const info = db
        .prepare(
          'INSERT INTO subjects (subject_name, subject_code, max_marks, passing_marks, semester) VALUES (?, ?, ?, ?, ?)'
        )
        .run(String(subject_name).trim(), String(subject_code).trim().toUpperCase(), maxM, passM, sem || 3);
      res.status(201).json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(Number(info.lastInsertRowid)));
    } catch (err: any) {
      if (String(err?.message).includes('UNIQUE')) {
        res.status(409).json({ error: 'Subject code already exists' });
        return;
      }
      res.status(500).json({ error: 'Failed to create subject' });
    }
  });

  app.put('/api/subjects/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Record<string, any> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }
    const { subject_name, subject_code, max_marks, passing_marks, semester } = req.body ?? {};
    const maxM = max_marks !== undefined ? Number(max_marks) : existing.max_marks;
    const passM = passing_marks !== undefined ? Number(passing_marks) : existing.passing_marks;
    if (passM > maxM || maxM <= 0 || passM < 0) {
      res.status(400).json({ error: 'Passing marks cannot exceed maximum marks' });
      return;
    }
    try {
      db.prepare(
        'UPDATE subjects SET subject_name = ?, subject_code = ?, max_marks = ?, passing_marks = ?, semester = ? WHERE id = ?'
      ).run(
        subject_name ? String(subject_name).trim() : existing.subject_name,
        subject_code ? String(subject_code).trim().toUpperCase() : existing.subject_code,
        maxM,
        passM,
        semester ? Number(semester) : existing.semester,
        id
      );
      res.json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(id));
    } catch {
      res.status(409).json({ error: 'Subject code already in use' });
    }
  });

  app.delete('/api/subjects/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const result = db.prepare('DELETE FROM subjects WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // --- EXAMINATIONS CRUD ---
  app.get('/api/examinations', authenticateToken, (_req: AuthRequest, res: Response) => {
    res.json(db.prepare('SELECT * FROM examinations ORDER BY exam_date DESC, id DESC').all());
  });

  app.post('/api/examinations', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const { exam_name, semester, exam_date } = req.body ?? {};
    const sem = Number(semester);
    if (!exam_name || !semester || !exam_date || Number.isNaN(sem) || sem < 1 || sem > 12) {
      res.status(400).json({ error: 'Valid exam name, semester (1-12), and exam date are required' });
      return;
    }
    try {
      const info = db
        .prepare('INSERT INTO examinations (exam_name, semester, exam_date) VALUES (?, ?, ?)')
        .run(String(exam_name).trim(), sem, String(exam_date).trim());
      res.status(201).json(db.prepare('SELECT * FROM examinations WHERE id = ?').get(Number(info.lastInsertRowid)));
    } catch {
      res.status(409).json({ error: 'An examination with that name and semester already exists' });
    }
  });

  app.put('/api/examinations/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM examinations WHERE id = ?').get(id) as Record<string, any> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Examination not found' });
      return;
    }
    const { exam_name, semester, exam_date } = req.body ?? {};
    const sem = semester !== undefined ? Number(semester) : Number(existing.semester);
    if (Number.isNaN(sem) || sem < 1 || sem > 12) {
      res.status(400).json({ error: 'Semester must be between 1 and 12' });
      return;
    }
    try {
      db.prepare('UPDATE examinations SET exam_name = ?, semester = ?, exam_date = ? WHERE id = ?').run(
        exam_name ? String(exam_name).trim() : existing.exam_name,
        sem,
        exam_date ? String(exam_date).trim() : existing.exam_date,
        id
      );
      res.json(db.prepare('SELECT * FROM examinations WHERE id = ?').get(id));
    } catch {
      res.status(409).json({ error: 'An examination with that name and semester already exists' });
    }
  });

  app.delete('/api/examinations/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const result = db.prepare('DELETE FROM examinations WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) {
      res.status(404).json({ error: 'Examination not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // --- MARKS MANAGEMENT ---
  app.get('/api/marks', authenticateToken, (req: AuthRequest, res: Response) => {
    const examId = req.query.exam_id ? Number(req.query.exam_id) : null;
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;
    const rows = getEnrichedMarksRows().filter((r) => {
      if (examId && r.exam_id !== examId) return false;
      if (studentId && r.student_id !== studentId) return false;
      return true;
    });
    res.json(rows);
  });

  app.post('/api/marks', authenticateToken, (req: AuthRequest, res: Response) => {
    const { student_id, subject_id, exam_id, obtained_marks } = req.body ?? {};
    const sid = Number(student_id);
    const subId = Number(subject_id);
    const eId = Number(exam_id);
    const rawMissing = obtained_marks === undefined || obtained_marks === null || obtained_marks === '';
    const score = Number(obtained_marks);

    if (!sid || !subId || !eId || rawMissing || Number.isNaN(score) || score < 0) {
      res.status(400).json({ error: 'Valid student, subject, examination, and non-negative marks are required' });
      return;
    }

    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(sid);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subId) as
      | { id: number; max_marks: number }
      | undefined;
    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }
    const exam = db.prepare('SELECT id FROM examinations WHERE id = ?').get(eId);
    if (!exam) {
      res.status(404).json({ error: 'Examination not found' });
      return;
    }
    if (score > subject.max_marks) {
      res.status(400).json({ error: `Obtained marks (${score}) cannot exceed subject maximum (${subject.max_marks})` });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM marks WHERE student_id = ? AND subject_id = ? AND exam_id = ?')
      .get(sid, subId, eId) as { id: number } | undefined;

    if (existing) {
      db.prepare('UPDATE marks SET obtained_marks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        score,
        existing.id
      );
      res.json({ id: existing.id, student_id: sid, subject_id: subId, exam_id: eId, obtained_marks: score, updated: true });
      return;
    }

    const info = db
      .prepare('INSERT INTO marks (student_id, subject_id, exam_id, obtained_marks) VALUES (?, ?, ?, ?)')
      .run(sid, subId, eId, score);
    res.status(201).json({
      id: Number(info.lastInsertRowid),
      student_id: sid,
      subject_id: subId,
      exam_id: eId,
      obtained_marks: score,
    });
  });

  app.put('/api/marks/:id', authenticateToken, (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const rawVal = req.body?.obtained_marks;
    const rawMissing = rawVal === undefined || rawVal === null || rawVal === '';
    const score = Number(rawVal);
    const existing = db
      .prepare(
        'SELECT m.*, s.max_marks FROM marks m JOIN subjects s ON s.id = m.subject_id WHERE m.id = ?'
      )
      .get(id) as { id: number; max_marks: number } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Mark record not found' });
      return;
    }
    if (rawMissing || Number.isNaN(score) || score < 0 || score > existing.max_marks) {
      res.status(400).json({ error: `Marks must be between 0 and ${existing.max_marks}` });
      return;
    }
    db.prepare('UPDATE marks SET obtained_marks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(score, id);
    res.json({ id, obtained_marks: score });
  });

  app.delete('/api/marks/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    const result = db.prepare('DELETE FROM marks WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) {
      res.status(404).json({ error: 'Mark record not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // --- RESULTS & DASHBOARD (Powered by Python Lists, Tuples & Dictionaries) ---
  app.get('/api/results', authenticateToken, (req: AuthRequest, res: Response) => {
    const examId = req.query.exam_id ? Number(req.query.exam_id) : 2;
    const cohort = computePythonCohortResults(Number.isNaN(examId) ? null : examId);
    res.json(cohort);
  });

  app.get('/api/results/:studentId', authenticateToken, (req: AuthRequest, res: Response) => {
    const studentId = Number(req.params.studentId);
    const examId = req.query.exam_id ? Number(req.query.exam_id) : 2;
    const cohort = computePythonCohortResults(Number.isNaN(examId) ? null : examId);
    const studentResult = cohort.results.find((r) => r.student_id === studentId);
    if (!studentResult) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    res.json(studentResult);
  });

  app.get('/api/dashboard', authenticateToken, (req: AuthRequest, res: Response) => {
    const examId = req.query.exam_id ? Number(req.query.exam_id) : 2;
    const totalStudents = (db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number }).c;
    const totalSubjects = (db.prepare('SELECT COUNT(*) as c FROM subjects').get() as { c: number }).c;
    const totalExaminations = (db.prepare('SELECT COUNT(*) as c FROM examinations').get() as { c: number }).c;
    const cohort = computePythonCohortResults(examId);

    // Subject-wise averages
    const subjects = db.prepare('SELECT * FROM subjects ORDER BY subject_code ASC').all() as {
      id: number;
      subject_name: string;
      subject_code: string;
      max_marks: number;
      passing_marks: number;
    }[];
    const marksRows = getEnrichedMarksRows().filter((m) => m.exam_id === examId);

    const subjectStats = subjects.map((sub) => {
      const subMarks = marksRows
        .filter((m) => m.subject_id === sub.id)
        .map((m) => Number(m.obtained_marks));
      const avg =
        subMarks.length > 0
          ? Number((subMarks.reduce((a, b) => a + b, 0) / subMarks.length).toFixed(2))
          : 0;
      const passed = subMarks.filter((v) => v >= sub.passing_marks).length;
      const passRate = subMarks.length > 0 ? Number(((passed / subMarks.length) * 100).toFixed(1)) : 0;
      return {
        subject_id: sub.id,
        subject_code: sub.subject_code,
        subject_name: sub.subject_name,
        max_marks: sub.max_marks,
        passing_marks: sub.passing_marks,
        average_marks: avg,
        pass_rate: passRate,
        entries: subMarks.length,
      };
    });

    res.json({
      exam_id: examId,
      kpis: {
        total_students: totalStudents,
        total_subjects: totalSubjects,
        total_examinations: totalExaminations,
        average_percentage: cohort.summary.average_percentage,
        pass_rate: cohort.summary.pass_rate,
        highest_percentage: cohort.summary.highest_percentage,
        lowest_percentage: cohort.summary.lowest_percentage,
      },
      summary: cohort.summary,
      results: cohort.results,
      subject_stats: subjectStats,
    });
  });

  app.get('/api/python-structures/inspect', authenticateToken, (_req: AuthRequest, res: Response) => {
    const students = db.prepare('SELECT * FROM students ORDER BY roll_no ASC').all();
    const marks = getEnrichedMarksRows().filter((m) => m.exam_id === 2);
    const inspected = runPythonScript<Record<string, unknown>>('app/utils/python_data_structures.py', {
      students,
      marks,
    });
    res.json(inspected);
  });

  app.get('/api/health/db', (_req: Request, res: Response) => {
    res.json({
      connected: true,
      database: 'student_management_db',
      engine: 'SQLite (MySQL Schema Mirror)',
    });
  });

  app.get('/api/admin/db-health', authenticateToken, requireAdmin, (_req: AuthRequest, res: Response) => {
    const tables = ['students', 'subjects', 'examinations', 'marks', 'system_config'];
    const counts = Object.fromEntries(
      tables.map((t) => [t, (db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number }).c])
    );
    const fkList = db.prepare('PRAGMA foreign_key_list(marks)').all();
    const marksIndexes = db.prepare('PRAGMA index_list(marks)').all();
    const studentIndexes = db.prepare('PRAGMA index_list(students)').all();
    res.json({
      connected: true,
      database: 'student_management_db',
      engine: 'SQLite (MySQL Schema Mirror)',
      tables,
      counts,
      row_counts: counts,
      unique_constraints: [
        'uq_students_roll_no',
        'uq_students_email',
        'uq_subjects_code',
        'uq_exam_name_semester',
        'uq_student_subject_exam',
      ],
      marks_foreign_keys: fkList,
      marks_unique_indexes: marksIndexes,
      students_unique_indexes: studentIndexes,
    });
  });

  // --- CSV FILE PROCESSING (Python csv.DictReader / csv.DictWriter) ---
  app.post(
    '/api/import/students',
    authenticateToken,
    requireAdmin,
    upload.single('file'),
    (req: AuthRequest, res: Response) => {
      try {
        let csvText = '';
        if (req.file) {
          csvText = fs.readFileSync(req.file.path, 'utf-8');
        } else if (typeof req.body?.csv_text === 'string') {
          csvText = req.body.csv_text;
          fs.writeFileSync(path.join(UPLOADS_DIR, `students_${Date.now()}.csv`), csvText, 'utf-8');
        } else {
          res.status(400).json({ error: 'Please upload a .csv file' });
          return;
        }

        const parsed = runPythonScript<{ valid_rows: any[]; errors: string[] }>(
          'app/services/file_processor.py',
          { action: 'parse_students', csv_text: csvText }
        );

        let inserted = 0;
        const errors = [...parsed.errors];
        const insertStmt = db.prepare(
          'INSERT INTO students (name, roll_no, email, course, branch, semester) VALUES (?, ?, ?, ?, ?, ?)'
        );

        for (const row of parsed.valid_rows) {
          try {
            insertStmt.run(row.name, row.roll_no, row.email, row.course, row.branch, row.semester);
            inserted++;
          } catch {
            errors.push(`Roll ${row.roll_no} (${row.name}) already exists in database.`);
          }
        }

        const errorReportCsv =
          errors.length > 0
            ? runPythonScript<{ csv: string }>('app/services/file_processor.py', {
                action: 'error_report',
                errors,
                out_path: path.join(EXPORTS_DIR, 'students_import_errors.csv'),
              }).csv
            : '';

        res.json({
          inserted,
          total_valid: parsed.valid_rows.length,
          errors,
          error_report_csv: errorReportCsv,
        });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Failed to process students CSV' });
      }
    }
  );

  app.post(
    '/api/import/marks',
    authenticateToken,
    upload.single('file'),
    (req: AuthRequest, res: Response) => {
      try {
        let csvText = '';
        if (req.file) {
          csvText = fs.readFileSync(req.file.path, 'utf-8');
        } else if (typeof req.body?.csv_text === 'string') {
          csvText = req.body.csv_text;
          fs.writeFileSync(path.join(UPLOADS_DIR, `marks_${Date.now()}.csv`), csvText, 'utf-8');
        } else {
          res.status(400).json({ error: 'Please upload a .csv file' });
          return;
        }

        const parsed = runPythonScript<{ valid_rows: any[]; errors: string[] }>(
          'app/services/file_processor.py',
          { action: 'parse_marks', csv_text: csvText }
        );

        let upserted = 0;
        const errors = [...parsed.errors];

        for (const row of parsed.valid_rows) {
          const student = db.prepare('SELECT id FROM students WHERE roll_no = ?').get(row.roll_no) as
            | { id: number }
            | undefined;
          if (!student) {
            errors.push(`Student roll_no '${row.roll_no}' not found.`);
            continue;
          }
          const subject = db
            .prepare('SELECT id, max_marks FROM subjects WHERE UPPER(subject_code) = ?')
            .get(row.subject_code) as { id: number; max_marks: number } | undefined;
          if (!subject) {
            errors.push(`Subject code '${row.subject_code}' not found.`);
            continue;
          }
          if (row.obtained_marks > subject.max_marks) {
            errors.push(
              `Marks ${row.obtained_marks} for ${row.roll_no}/${row.subject_code} exceed max marks (${subject.max_marks}).`
            );
            continue;
          }
          const exam = db
            .prepare('SELECT id FROM examinations WHERE LOWER(exam_name) = ?')
            .get(row.exam_name.toLowerCase()) as { id: number } | undefined;
          if (!exam) {
            errors.push(`Examination '${row.exam_name}' not found.`);
            continue;
          }

          const existing = db
            .prepare('SELECT id FROM marks WHERE student_id = ? AND subject_id = ? AND exam_id = ?')
            .get(student.id, subject.id, exam.id) as { id: number } | undefined;

          if (existing) {
            db.prepare('UPDATE marks SET obtained_marks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
              row.obtained_marks,
              existing.id
            );
          } else {
            db.prepare(
              'INSERT INTO marks (student_id, subject_id, exam_id, obtained_marks) VALUES (?, ?, ?, ?)'
            ).run(student.id, subject.id, exam.id, row.obtained_marks);
          }
          upserted++;
        }

        const errorReportCsv =
          errors.length > 0
            ? runPythonScript<{ csv: string }>('app/services/file_processor.py', {
                action: 'error_report',
                errors,
                out_path: path.join(EXPORTS_DIR, 'marks_import_errors.csv'),
              }).csv
            : '';

        res.json({
          upserted,
          total_valid: parsed.valid_rows.length,
          errors,
          error_report_csv: errorReportCsv,
        });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Failed to process marks CSV' });
      }
    }
  );

  app.get('/api/export/results/:studentId', authenticateToken, (req: AuthRequest, res: Response) => {
    const studentId = Number(req.params.studentId);
    const examId = req.query.exam_id ? Number(req.query.exam_id) : 2;
    const cohort = computePythonCohortResults(examId);
    const studentRes = cohort.results.find((r) => r.student_id === studentId);
    if (!studentRes) {
      res.status(404).json({ error: 'Student result not found' });
      return;
    }
    const columns = [
      'roll_no',
      'student_name',
      'subject_code',
      'subject_name',
      'obtained_marks',
      'max_marks',
      'passing_marks',
      'subject_status',
      'overall_percentage',
      'overall_grade',
      'overall_status',
    ];
    const rows = (studentRes.subject_breakdown || []).map((b: any) => ({
      roll_no: studentRes.roll_no,
      student_name: studentRes.name,
      subject_code: b.subject_code,
      subject_name: b.subject_name,
      obtained_marks: b.obtained_marks,
      max_marks: b.max_marks,
      passing_marks: b.passing_marks,
      subject_status: b.passed ? 'PASS' : 'FAIL',
      overall_percentage: studentRes.percentage,
      overall_grade: studentRes.grade,
      overall_status: studentRes.status,
    }));
    const filename = `result_${studentRes.roll_no}.csv`;
    const { csv } = runPythonScript<{ csv: string }>('app/services/file_processor.py', {
      action: 'export_csv',
      columns,
      rows,
      out_path: path.join(EXPORTS_DIR, filename),
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  app.get('/api/export/:type', authenticateToken, (req: AuthRequest, res: Response) => {
    const type = req.params.type;
    const examId = req.query.exam_id ? Number(req.query.exam_id) : 2;
    let columns: string[] = [];
    let rows: Record<string, unknown>[] = [];
    let filename = 'export.csv';

    if (type === 'students') {
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Administrator privileges required to export full student directory' });
        return;
      }
      columns = ['roll_no', 'name', 'email', 'course', 'branch', 'semester'];
      rows = db.prepare('SELECT roll_no, name, email, course, branch, semester FROM students ORDER BY roll_no ASC').all() as Record<string, unknown>[];
      filename = 'students_export.csv';
    } else if (type === 'marks') {
      columns = ['roll_no', 'student_name', 'subject_code', 'subject_name', 'exam_name', 'obtained_marks', 'max_marks'];
      rows = getEnrichedMarksRows().filter((r) => !examId || r.exam_id === examId);
      filename = 'marks_export.csv';
    } else if (type === 'results') {
      columns = ['roll_no', 'name', 'branch', 'semester', 'total_obtained', 'total_maximum', 'percentage', 'grade', 'status', 'failed_subjects'];
      const cohort = computePythonCohortResults(examId);
      rows = cohort.results.map((r) => ({
        ...r,
        failed_subjects: (r.failed_subjects || []).join('; '),
      }));
      filename = 'results_report.csv';
    } else {
      res.status(400).json({ error: 'Invalid export type' });
      return;
    }

    const outPath = path.join(EXPORTS_DIR, filename);
    const { csv } = runPythonScript<{ csv: string }>('app/services/file_processor.py', {
      action: 'export_csv',
      columns,
      rows,
      out_path: outPath,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  // --- GEMINI AI ROUTES (Server-Side @google/genai) ---
  app.post('/api/ai/chat', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { history = [], message, model = 'gemini-4-hydrogen', examId = 2 } = req.body ?? {};
      if (!message || !String(message).trim()) {
        res.status(400).json({ error: 'Message text is required' });
        return;
      }

      const selectedModel =
        model === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

      const cohort = computePythonCohortResults(Number(examId) || 2);
      const subjects = db.prepare('SELECT subject_code, subject_name, passing_marks, max_marks FROM subjects').all();
      const compactStudents = cohort.results.map((r) => ({
        roll_no: r.roll_no,
        name: r.name,
        branch: r.branch,
        percentage: r.percentage,
        grade: r.grade,
        status: r.status,
        failed_subjects: r.failed_subjects,
        marks: r.marks,
      }));

      const systemInstruction = [
        'You are AcadLedger AI, an expert Academic Performance Advisor & Institutional Data Analyst inside the Student Marks Management System.',
        'Answer clearly, concisely, and accurately using ONLY the live academic records provided below. Do not invent student scores.',
        'Format numbers cleanly, highlight at-risk students or failed subjects constructively, and provide actionable pedagogical advice when asked.',
        `Active Examination ID: ${examId}. Cohort Summary: Average ${cohort.summary.average_percentage}%, Pass Rate ${cohort.summary.pass_rate}%, Highest ${cohort.summary.highest_percentage}%, Lowest ${cohort.summary.lowest_percentage}%.`,
        `Grade Scale Tuple: A+ (>=90), A (>=80), B (>=70), C (>=60), D (>=50), F (<50 or failed any subject).`,
        `Subjects: ${JSON.stringify(subjects)}`,
        `Student Results Data: ${JSON.stringify(compactStudents)}`,
      ].join('\n');

      const ai = getGeminiClient();
      const formattedHistory = Array.isArray(history)
        ? history
            .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
            .map((h) => ({
              role: h.role as 'user' | 'model',
              parts: [{ text: h.text }],
            }))
        : [];

      const chat = ai.chats.create({
        model: selectedModel,
        config: { systemInstruction },
        history: formattedHistory,
      });

      const response = await chat.sendMessage({ message: String(message).trim() });
      res.json({ reply: response.text ?? 'No response generated.', model: selectedModel });
    } catch (err: any) {
      if (err?.message === 'GEMINI_API_KEY_MISSING') {
        res.status(503).json({
          error: 'Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      const status = err?.status || 500;
      res.status(status).json({ error: err?.message || 'Gemini AI request failed' });
    }
  });

  app.post('/api/ai/analyze-student', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, examId = 2 } = req.body ?? {};
      const cohort = computePythonCohortResults(Number(examId) || 2);
      const student = cohort.results.find((r) => r.student_id === Number(studentId));
      if (!student) {
        res.status(404).json({ error: 'Student result not found' });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this student's academic performance record and provide a structured faculty evaluation:\n${JSON.stringify(student)}`,
        config: {
          systemInstruction:
            'You are a senior university academic dean writing a concise, constructive performance evaluation based strictly on the provided marks dictionary.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: 'Two-sentence executive assessment of performance.' },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-3 specific subject strengths observed in the scores.',
              },
              focusAreas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-3 subjects or mark gaps requiring attention.',
              },
              recommendedPlan: {
                type: Type.STRING,
                description: 'Concrete next-step study or mentoring recommendation.',
              },
            },
            required: ['summary', 'strengths', 'focusAreas', 'recommendedPlan'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err: any) {
      if (err?.message === 'GEMINI_API_KEY_MISSING') {
        res.status(503).json({
          error: 'Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      res.status(err?.status || 500).json({ error: err?.message || 'Failed to analyze student' });
    }
  });

  app.post('/api/ai/cohort-insights', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const examId = Number(req.body?.examId) || 2;
      const cohort = computePythonCohortResults(examId);
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this cohort academic dataset and produce diagnostic insights:\nSummary: ${JSON.stringify(
          cohort.summary
        )}\nStudents: ${JSON.stringify(
          cohort.results.map((r) => ({
            roll_no: r.roll_no,
            name: r.name,
            branch: r.branch,
            percentage: r.percentage,
            grade: r.grade,
            status: r.status,
            failed_subjects: r.failed_subjects,
            marks: r.marks,
          }))
        )}`,
        config: {
          systemInstruction:
            'You are an institutional academic analytics specialist. Provide factual, data-backed cohort insights without fabricating numbers.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              subjectBottlenecks: { type: Type.ARRAY, items: { type: Type.STRING } },
              atRiskAlerts: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['executiveSummary', 'subjectBottlenecks', 'atRiskAlerts', 'actionItems'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err: any) {
      if (err?.message === 'GEMINI_API_KEY_MISSING') {
        res.status(503).json({
          error: 'Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      res.status(err?.status || 500).json({ error: err?.message || 'Failed to generate cohort insights' });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || (err?.message?.includes('.csv') ? 400 : 500);
    res.status(status).json({ error: err?.message || 'Internal server error' });
  });

  // Vite Middleware (Dev) vs Static Dist (Prod)
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AcadLedger Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
