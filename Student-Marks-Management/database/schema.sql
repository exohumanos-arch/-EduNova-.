-- Student Marks Management System — MySQL Relational Schema
-- Database: student_management_db

CREATE DATABASE IF NOT EXISTS student_management_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE student_management_db;

-- Table 1: Users (Admin & Teacher authentication + RBAC)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'TEACHER') NOT NULL DEFAULT 'TEACHER',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB;

-- Table 2: Students
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  roll_no VARCHAR(30) NOT NULL,
  email VARCHAR(100) NOT NULL,
  course VARCHAR(100) NOT NULL,
  branch VARCHAR(100) NOT NULL,
  semester INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_students_roll_no UNIQUE (roll_no),
  CONSTRAINT uq_students_email UNIQUE (email),
  CONSTRAINT chk_student_semester CHECK (semester BETWEEN 1 AND 12)
) ENGINE=InnoDB;

-- Table 3: Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_name VARCHAR(100) NOT NULL,
  subject_code VARCHAR(30) NOT NULL,
  max_marks INT NOT NULL DEFAULT 100,
  passing_marks INT NOT NULL DEFAULT 40,
  semester INT NOT NULL DEFAULT 3,
  CONSTRAINT uq_subjects_code UNIQUE (subject_code),
  CONSTRAINT chk_subject_max_marks CHECK (max_marks > 0),
  CONSTRAINT chk_subject_passing_non_neg CHECK (passing_marks >= 0),
  CONSTRAINT chk_passing_lte_max CHECK (passing_marks <= max_marks),
  CONSTRAINT chk_subject_semester CHECK (semester BETWEEN 1 AND 12)
) ENGINE=InnoDB;

-- Table 4: Examinations
CREATE TABLE IF NOT EXISTS examinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_name VARCHAR(100) NOT NULL,
  semester INT NOT NULL,
  exam_date DATE NOT NULL,
  CONSTRAINT uq_exam_name_sem UNIQUE (exam_name, semester),
  CONSTRAINT chk_exam_semester CHECK (semester BETWEEN 1 AND 12)
) ENGINE=InnoDB;

-- Table 5: Marks (Relational junction with foreign keys & composite unique constraint)
CREATE TABLE IF NOT EXISTS marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  exam_id INT NOT NULL,
  obtained_marks DECIMAL(6, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_marks_student FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_marks_subject FOREIGN KEY (subject_id)
    REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_marks_exam FOREIGN KEY (exam_id)
    REFERENCES examinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_student_subject_exam UNIQUE (student_id, subject_id, exam_id),
  CONSTRAINT chk_obtained_marks_non_neg CHECK (obtained_marks >= 0)
) ENGINE=InnoDB;

-- Performance Indexes
CREATE INDEX idx_students_name ON students(name);
CREATE INDEX idx_students_branch_sem ON students(branch, semester);
CREATE INDEX idx_marks_exam ON marks(exam_id);
CREATE INDEX idx_marks_student ON marks(student_id);

-- Initial Seed Data (Idempotent)
INSERT IGNORE INTO subjects (subject_name, subject_code, max_marks, passing_marks, semester) VALUES
  ('Python Programming', 'PY301', 100, 40, 3),
  ('Engineering Mathematics III', 'MA301', 100, 40, 3),
  ('Data Structures & Algorithms', 'CS302', 100, 40, 3),
  ('Database Management Systems', 'CS303', 100, 40, 3),
  ('Computer Architecture', 'CS304', 100, 40, 3);

INSERT IGNORE INTO examinations (exam_name, semester, exam_date) VALUES
  ('Mid-Semester Assessment 2026', 3, '2026-09-18'),
  ('End-Semester Finals 2026', 3, '2026-11-12');

INSERT IGNORE INTO students (name, roll_no, email, course, branch, semester) VALUES
  ('Rahul Sharma', '2026001', 'rahul.sharma@acadledger.edu', 'B.Tech', 'CSE', 3),
  ('Ananya Iyer', '2026002', 'ananya.iyer@acadledger.edu', 'B.Tech', 'CSE', 3),
  ('Aditya Deshmukh', '2026003', 'aditya.d@acadledger.edu', 'B.Tech', 'AIML', 3);

-- Verify created tables
SHOW TABLES;
