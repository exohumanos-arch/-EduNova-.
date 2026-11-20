# MySQL Database Setup & Verification Guide (`student_management_db`)

## 1. Prerequisites
- MySQL Server 8.0+ (or MariaDB 10.6+)
- Python 3.10+

## 2. Create Database & Tables
Run the schema script in MySQL CLI or MySQL Workbench:

```bash
mysql -u root -p < Student-Marks-Management/database/schema.sql
```

This creates `student_management_db` with the 5 relational tables:
1. `users` — Primary Key `id`, Unique `email`, Role ENUM (`ADMIN`, `TEACHER`)
2. `students` — Primary Key `id`, Unique `roll_no` (prevents duplicates), Unique `email`, Semester check
3. `subjects` — Primary Key `id`, Unique `subject_code`, Max/Passing marks checks
4. `examinations` — Primary Key `id`, Composite Unique `(exam_name, semester)`
5. `marks` — Primary Key `id`, Foreign Keys to `students(id)`, `subjects(id)`, `examinations(id)` (`ON DELETE CASCADE ON UPDATE CASCADE`), Composite Unique `(student_id, subject_id, exam_id)` preventing duplicate marks entries

## 3. Configure Environment Variables
Copy `.env.example` to `.env` and set your local MySQL credentials:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=student_management_db
```

## 4. Verify SQLAlchemy Connection & Tables
```bash
cd Student-Marks-Management/backend
pip install -r requirements.txt
python verify_db.py
```

## 5. Run FastAPI Connected to MySQL
```bash
uvicorn app.main:app --reload --port 8000
```
Check `GET http://localhost:8000/api/health/db` to confirm live MySQL table status.
