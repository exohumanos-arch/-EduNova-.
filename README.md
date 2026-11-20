# AcadLedger — Student Marks Management System

**Tagline:** *Smart, Simple, and Efficient Academic Performance Management.*

---

## 1. Project Introduction

**AcadLedger (Student Marks Management System)** is a full-stack academic administration platform built with **React**, **TypeScript**, **Tailwind CSS**, **Recharts**, **Three.js**, **Python (FastAPI + SQLAlchemy + CSV File Processing)**, **MySQL / SQLite**, and **Gemini AI**.

It provides administrators and faculty with a single workspace to enroll students, configure subjects and examination cycles, record and verify marks, automate percentage and grade computation, import/export bulk CSV datasets with validation error reports, inspect cohorts in an interactive 3D Observatory, and query live academic metrics through an AI Academic Advisor.

---

## 2. Problem Statement

Educational institutions frequently rely on fragmented spreadsheets and manual calculation workflows to manage semester marks, verify pass/fail eligibility across multiple subjects, and generate performance summaries. This leads to calculation errors, duplicate entries, lack of role-based access control, poor auditability, and delayed feedback for at-risk students.

---

## 3. Objectives

1. **Centralized Relational Storage**: Persist students, subjects, examinations, marks, and faculty users with strict primary keys, cascading foreign keys, and unique constraints (`student_management_db`).
2. **Automated Grade & Result Processing**: Calculate totals, percentages, letter grades (`A+` through `F`), and subject-wise pass/fail overrides deterministically using Python **Lists**, **Tuples**, and **Dictionaries**.
3. **CSV Bulk File Processing**: Validate headers, missing fields, duplicate entries, and marks boundaries via Python's built-in `csv.DictReader` / `csv.DictWriter`, generating downloadable exports and CSV error reports.
4. **Role-Based Security**: Protect APIs and UI routes with `bcrypt` password hashing, signed JWT authentication, and distinct `ADMIN` vs `TEACHER` permissions.
5. **Visual & AI Analytics**: Deliver executive KPI cards, Recharts distributions, an interactive Three.js 3D Academic Observatory, and Gemini-powered multi-turn Q&A and evaluation summaries.

---

## 4. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 | Modular SPA interface, responsive institutional layout |
| **Routing & HTTP** | React Router DOM v7, Axios | Client-side protected routes & JWT interceptors |
| **Data Visualization** | Recharts, Three.js (`RoomEnvironment`, `OrbitControls`) | Subject/grade bar charts & interactive 3D Observatory |
| **Live App Server** | Express (`server.ts`), `node:sqlite`, `python3` bridge | Port 3000 full-stack runtime executing Python logic on live SQL records |
| **Python Backend** | FastAPI, SQLAlchemy, Pydantic, PyMySQL, Uvicorn | Modular REST API & ORM layer (`Student-Marks-Management/backend/`) |
| **Database** | MySQL (`student_management_db`) / SQLite mirror | Relational storage with unique & foreign key constraints |
| **File Processing** | Python `csv.DictReader` / `csv.DictWriter`, Multer | CSV validation, error report generation, bulk import/export |
| **Authentication** | JWT (`jsonwebtoken` / `python-jose`), `bcrypt` | Token signing, refresh, logout, and RBAC (`ADMIN` / `TEACHER`) |
| **AI Intelligence** | `@google/genai` (server-side proxy routes) | Multi-turn academic advisor chat & structured evaluations |
| **Testing** | Vitest, React Testing Library, `pytest`, Node integration runner | Automated frontend, backend, and full-stack validation |

---

## 5. System Architecture

```text
+-------------------------------------------------------------------+
|                  React 19 + Vite Frontend (Port 3000)             |
|  React Router · Axios JWT Interceptors · Recharts · Three.js 3D   |
+---------------------------------+---------------------------------+
                                  | REST JSON + Multipart CSV + Bearer JWT
                                  v
+-------------------------------------------------------------------+
|              Backend Runtime & Python Compute Layer               |
|  Option A (Live App): server.ts (Express + SQLite + Python3 CLI)  |
|  Option B (Standalone): FastAPI (Uvicorn + SQLAlchemy + MySQL)    |
+----------------+---------------------------------+----------------+
                 |                                 |
                 v                                 v
+--------------------------------+  +-------------------------------+
|  Python Services & Structures  |  |  Relational Database          |
|  - python_data_structures.py   |  |  student_management_db        |
|  - grade_calculator.py         |  |  Tables: users, students,     |
|  - result_processor.py         |  |  subjects, examinations, marks|
|  - file_processor.py (CSV)     |  +-------------------------------+
+--------------------------------+
```

---

## 6. Database Schema (`student_management_db`)

Defined in `Student-Marks-Management/database/schema.sql` and mirrored in `server.ts`:

1. **`users`**: `id (PK)`, `username`, `email (UNIQUE)`, `password_hash`, `role ('ADMIN' | 'TEACHER')`, `created_at`
2. **`students`**: `id (PK)`, `name`, `roll_no (UNIQUE)`, `email (UNIQUE)`, `course`, `branch`, `semester (1..12)`, `created_at`
3. **`subjects`**: `id (PK)`, `subject_name`, `subject_code (UNIQUE)`, `max_marks (>0)`, `passing_marks (>=0)`, `semester`
4. **`examinations`**: `id (PK)`, `exam_name`, `semester`, `exam_date`, `UNIQUE(exam_name, semester)`
5. **`marks`**: `id (PK)`, `student_id (FK -> students.id CASCADE)`, `subject_id (FK -> subjects.id CASCADE)`, `exam_id (FK -> examinations.id CASCADE)`, `obtained_marks (>=0)`, `UNIQUE(student_id, subject_id, exam_id)`

---

## 7. API Documentation

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate email/password, return JWT & user profile |
| `POST` | `/api/auth/register` | Public | Register Admin/Teacher account with `bcrypt` hashing |
| `GET` | `/api/auth/me` | Authenticated | Verify token and fetch active user profile |
| `POST` | `/api/auth/refresh` | Authenticated | Issue renewed 12h JWT session token |
| `POST` | `/api/auth/logout` | Authenticated | End active session |
| `GET` / `POST` / `DELETE` | `/api/users` | Admin | List, create, and remove faculty accounts |
| `GET` | `/api/students` | Authenticated | List students with `search`, `branch`, `semester` filters |
| `GET` | `/api/students/:id` | Authenticated | Fetch single student metadata |
| `POST` / `PUT` / `DELETE` | `/api/students` | Admin | Create, update, delete student records |
| `GET` | `/api/subjects` | Authenticated | List configured subjects |
| `POST` / `PUT` / `DELETE` | `/api/subjects` | Admin | Create, update, delete subjects with passing/max checks |
| `GET` | `/api/examinations` | Authenticated | List examination cycles |
| `POST` / `PUT` / `DELETE` | `/api/examinations` | Admin | Create, update, delete exams with duplicate prevention |
| `GET` | `/api/marks` | Authenticated | List marks filtered by `exam_id` and `student_id` |
| `POST` / `PUT` | `/api/marks` | Admin / Teacher | Upsert/update marks (`0 <= marks <= max_marks`) |
| `DELETE` | `/api/marks/:id` | Admin | Delete mark record |
| `GET` | `/api/results` | Authenticated | Cohort results & summary computed by Python |
| `GET` | `/api/results/:studentId` | Authenticated | Individual student result & subject breakdown |
| `GET` | `/api/dashboard` | Authenticated | KPIs, subject averages, top performers, at-risk alerts |
| `POST` | `/api/import/students` | Admin | Bulk CSV student import + downloadable error CSV |
| `POST` | `/api/import/marks` | Admin / Teacher | Bulk CSV marks import + downloadable error CSV |
| `GET` | `/api/export/:type` | Authenticated | Export `students`, `marks`, or `results` CSV |
| `GET` | `/api/export/results/:studentId` | Authenticated | Export individual student transcript CSV |
| `GET` | `/api/python-structures/inspect` | Authenticated | Live inspection of Python Lists, Tuples, and Dictionaries |
| `GET` | `/api/health/db` | Public | Live database connectivity, table counts, and constraints |
| `POST` | `/api/ai/chat` | Authenticated | Multi-turn Gemini AI Academic Advisor conversation |
| `POST` | `/api/ai/analyze-student` | Authenticated | Structured Gemini AI faculty evaluation |
| `POST` | `/api/ai/cohort-insights` | Authenticated | Structured Gemini AI cohort diagnostics |

---

## 8. Python Concepts Implementation

Located in `Student-Marks-Management/backend/app/`:

- **Lists (`utils/python_data_structures.py`, `services/grade_calculator.py`)**: Store subject-wise numeric scores (`marks_list`), compute totals, averages, `max()`/`min()` marks, sort cohort rankings, and aggregate cohort percentages.
- **Tuples (`utils/python_data_structures.py`)**: Store immutable academic configurations:
  - `GRADE_RANGES`: `((90.0, "A+", "Outstanding"), (80.0, "A", "Excellent"), (70.0, "B", "Very Good"), (60.0, "C", "Good"), (50.0, "D", "Pass"), (0.0, "F", "Needs Improvement"))`
  - `ACADEMIC_BRANCHES`: `("CSE", "AIML", "ECE", "IT", "ME")`
  - `RESULT_CATEGORIES`: `("PASS", "FAIL")`
- **Dictionaries (`services/result_processor.py`)**: Represent student records, nested subject-code-to-marks maps (`{"PY301": 92, ...}`), grade distribution counts, and JSON API responses.
- **File Processing (`services/file_processor.py`)**: Uses Python's `csv.DictReader` and `csv.DictWriter` with `newline=""` (Windows-safe) to validate headers, reject missing/negative/duplicate rows, persist uploads/exports, and generate downloadable error report CSVs.

---

## 9. Installation Instructions (Windows / macOS / Linux)

### Prerequisites
- **Node.js 20+** and **npm**
- **Python 3.10+** (`python` on Windows, `python3` on macOS/Linux)
- **MySQL 8.0+** (required only if running the standalone FastAPI + MySQL backend)

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```
Update `GEMINI_API_KEY`, `JWT_SECRET`, and (for standalone MySQL) `MYSQL_*` credentials.

### 2. Install Frontend & Full-Stack Server Dependencies
```bash
npm install
```

### 3. (Optional) Standalone Python FastAPI + MySQL Setup
```sql
mysql -u root -p < Student-Marks-Management/database/schema.sql
```

**Windows (PowerShell / CMD):**
```powershell
cd Student-Marks-Management\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python verify_db.py
```

**macOS / Linux:**
```bash
cd Student-Marks-Management/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 verify_db.py
```

---

## 10. Execution Instructions

### Run the Live Full-Stack Web App (Port 3000)
```bash
# Development server (Express + Vite + SQLite + Python bridge)
npm run dev

# Production build & start
npm run build
npm start
```
Open `http://localhost:3000`.
Demo credentials:
- **Admin:** `admin@acadledger.edu` / `Admin@2026`
- **Teacher:** `teacher@acadledger.edu` / `Teacher@2026`

### Run Standalone FastAPI Backend (Port 8000)
```bash
cd Student-Marks-Management/backend
uvicorn app.main:app --reload --port 8000
```
Swagger UI: `http://localhost:8000/docs`

### Run Automated Test Suites
```bash
# Frontend Vitest + React Testing Library suite
npm test

# TypeScript static check & production build
npm run lint
npm run build

# Live full-stack API integration suite (requires dev server running on port 3000)
node tests/api_integration_test.mjs

# Python FastAPI & Data Structures pytest suite
cd Student-Marks-Management/backend
pytest -v
```

---

## 11. Testing Report

### Bugs Discovered & Resolved During QA Verification
1. **JWT Refresh `exp` Claim Collision (`/api/auth/refresh`)**: Re-signing the decoded `req.user` object directly caused `jsonwebtoken.sign()` to throw `500` because `exp`/`iat` already existed on the decoded token. **Fixed** by extracting clean `{ id, username, email, role }` fields before signing.
2. **Marks Form Native Validation Bypassing Custom Range Errors (`MarksPage.tsx`)**: Browser native `max` constraint validation suppressed React's unified error toast on out-of-range inputs. **Fixed** by adding `noValidate` to `<form>` so custom validation and server checks behave consistently.
3. **Empty Marks String Coercion (`POST /api/marks` & `PUT /api/marks/:id`)**: `Number("")` silently coerced to `0` instead of rejecting missing marks. **Fixed** with explicit empty-string/null/undefined guards returning HTTP `400`.
4. **Missing Foreign-Key Pre-Checks & Examination Update Conflict (`server.ts` & `examinations.py`)**: Non-existent `student_id`/`exam_id` or duplicate `(exam_name, semester)` on `PUT` raised unhandled 500s. **Fixed** with explicit `404` FK checks and `409 Conflict` guards.
5. **DB Health Payload Alignment (`server.ts` & `SettingsPage.tsx`)**: Added `counts`, `engine`, and `unique_constraints` fields to `/api/health/db`.
6. **Non-CSV Upload Rejection Format (`server.ts`)**: Added Express JSON error middleware so rejected `.txt`/non-CSV uploads return structured `400` JSON.
7. **Windows Python Executable Resolution (`server.ts`)**: Added `resolvePythonCommand()` checking `python` and `python3` automatically for Windows compatibility.

### Executed Test Summary

| Test Suite | Scope Covered | Result |
| :--- | :--- | :--- |
| **Live API Integration (`tests/api_integration_test.mjs`)** | 401 unauthorized blocking, Admin/Teacher JWT login/refresh/logout, Teacher 403 RBAC, Student/Subject/Exam CRUD, duplicate 409 checks, missing fields 400, negative/over-max/empty marks 400, Python grade/fail calculation, CSV error report & non-CSV rejection, individual & cohort CSV export, DB health & Python inspector | **9 / 9 Suites Passed** |
| **Frontend Component & Routing (`src/__tests__/AcadLedgerFrontend.test.tsx`)** | LoginView toggle & demo sign-in, ProtectedRoute unauthenticated & Admin RBAC redirects, Sidebar role visibility, generic DataTable states, StudentsPage search/branch API filtering, MarksPage range validation & submission, ResultsPage status filter & marksheet modal, DashboardPage KPIs & Recharts | **8 / 8 Tests Passed** |
| **Python Unit & CSV Suite (`backend/tests/test_python_structures.py`)** | List totals/averages/min/max, tuple grade boundaries (`A+`..`F`), subject-fail override rule, pending student handling, cohort aggregation, empty/bad-header/duplicate/negative CSV parsing & CSV error report generation | **6 / 6 Tests Passed** |
| **Python Syntax & Static Typecheck** | `py_compile` across all Python modules + `tsc --noEmit` + `vite build` | **Passed (0 errors)** |

---

## 12. UI Modules & Pages (17 Interactive Routes)

- `/login`: Institutional authentication & registration screen with demo Admin/Teacher presets.
- `/dashboard`: Executive KPI cards, Recharts subject-average & grade distribution charts, top performers, at-risk alerts, and Gemini Cohort Diagnostics.
- `/observatory-3d`: Full-bleed interactive Three.js 3D Observatory with procedural student & subject monuments, Honor Astrolabe, raycast selection, and camera presets.
- `/students`, `/students/add`, `/students/:id/edit`, `/students/:id`: Searchable student directory, dedicated enrollment/edit forms, and individual transcript profile with CSV download & Gemini Faculty Evaluation.
- `/subjects` & `/examinations`: Curriculum max/passing mark configuration and examination cycle management.
- `/marks`: Interactive subject-wise marks entry sheet with live percentage/grade/status preview.
- `/results` & `/reports`: Cohort ledger with `PASS`/`FAIL` filtering, printable marksheets, individual & bulk CSV exports, and branch breakdowns.
- `/import-export`: Bulk CSV uploads with downloadable row-level CSV error reports and Python `DictWriter` exports.
- `/ai-advisor`: Full-page and slide-over multi-turn Gemini AI Academic Advisor grounded in live database scores.
- `/python-inspector`: Real-time inspection of live Python Lists, Tuples, and Dictionaries.
- `/users` & `/settings`: Admin faculty account CRUD, JWT refresh, grade tuple scale reference, and live database schema health.

---

## 13. Future Scope

1. Multi-semester CGPA/SGPA transcript aggregation and credit-weighted GPA calculation.
2. Parent/Student read-only portal login with downloadable PDF report cards.
3. Automated email notifications for published examination results and at-risk interventions.
4. Docker Compose orchestration pairing React, FastAPI, and MySQL 8 for one-command cloud deployment.
