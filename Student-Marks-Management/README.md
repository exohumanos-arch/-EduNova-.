# Student Marks Management System (AcadLedger)

**Smart, Simple, and Efficient Academic Performance Management.**

A full-stack academic management web application built with **React**, **Tailwind CSS**, **Three.js**, **Python (FastAPI + Data Structures + CSV Processing)**, and **SQL**.

## Features

- **JWT Authentication & Role-Based Access Control**: Separate `ADMIN` and `TEACHER` roles with `bcrypt` password hashing.
- **Academic Dashboard & Analytics**: Live KPIs, Recharts subject-wise performance & grade distribution charts, top performers, and at-risk student alerts.
- **3D Academic Observatory (Three.js)**: Interactive WebGL 3D showcase of student/subject monuments with PBR materials, studio environment reflections, raycast inspection, and camera presets.
- **Student, Subject & Examination CRUD**: Full management with search, filtering, duplicate prevention, and relational foreign-key integrity.
- **Marks & Automated Result Processing**: Computes total marks, percentages, tuple-based letter grades (`A+` through `F`), and enforces strict subject-wise pass/fail validation.
- **Python Concepts Implemented in Backend**:
  - **Lists**: Storing subject marks, cohort percentages, sorting rankings, and computing averages/min/max.
  - **Tuples**: Immutable grade scale boundaries (`GRADE_RANGES`), branches, and result categories.
  - **Dictionaries**: Structured student profiles, nested subject-wise mark maps, and API payloads.
  - **File Processing**: `csv.DictReader` & `csv.DictWriter` with header checks, numeric validation, duplicate detection, and downloadable exports.
- **Gemini Academic Intelligence**: Multi-turn AI Academic Advisor chat and structured student/cohort diagnostic reports.

## Local Setup (Windows / Linux / macOS)

### 1. MySQL Database Setup
```sql
SOURCE database/schema.sql;
```

### 2. Python FastAPI Backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Interactive Swagger API docs will be available at `http://localhost:8000/docs`.

### 3. Run Python Unit Tests
```bash
cd backend
pytest -v
```
