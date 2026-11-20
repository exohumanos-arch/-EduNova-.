import '@testing-library/jest-dom/vitest';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginView } from '../components/LoginView';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { Pagination } from '../components/Pagination';
import { DataTable } from '../components/DataTable';
import { StudentsPage } from '../pages/StudentsPage';
import { MarksPage } from '../pages/MarksPage';
import { ResultsPage } from '../pages/ResultsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { GradesPage } from '../pages/GradesPage';
import { api } from '../services/api';
import type {
  AuthUser,
  DashboardPayload,
  Examination,
  Student,
  StudentResult,
  Subject,
} from '../types';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      login: vi.fn(),
      register: vi.fn(),
      getStudents: vi.fn(),
      getSubjects: vi.fn(),
      getMarks: vi.fn(),
      saveMark: vi.fn(),
      getDashboard: vi.fn(),
      downloadExportCSV: vi.fn(),
      downloadStudentResultCSV: vi.fn(),
      cohortInsightsAI: vi.fn(),
    },
  };
});

const ADMIN_USER: AuthUser = {
  id: 1,
  username: 'Dr. Arvind Mehta',
  email: 'admin@acadledger.edu',
  role: 'ADMIN',
};

const TEACHER_USER: AuthUser = {
  id: 2,
  username: 'Prof. Neha Kapoor',
  email: 'teacher@acadledger.edu',
  role: 'TEACHER',
};

const SAMPLE_STUDENTS: Student[] = [
  {
    id: 1,
    name: 'Rahul Sharma',
    roll_no: '2026001',
    email: 'rahul.sharma@acadledger.edu',
    course: 'B.Tech',
    branch: 'CSE',
    semester: 3,
  },
  {
    id: 2,
    name: 'Aditya Deshmukh',
    roll_no: '2026003',
    email: 'aditya.d@acadledger.edu',
    course: 'B.Tech',
    branch: 'AIML',
    semester: 3,
  },
];

const SAMPLE_SUBJECTS: Subject[] = [
  {
    id: 1,
    subject_name: 'Python Programming',
    subject_code: 'PY301',
    max_marks: 100,
    passing_marks: 40,
    semester: 3,
  },
];

const SAMPLE_EXAMS: Examination[] = [
  { id: 2, exam_name: 'End-Semester Finals 2026', semester: 3, exam_date: '2026-11-12' },
];

const SAMPLE_RESULTS: StudentResult[] = [
  {
    student_id: 1,
    roll_no: '2026001',
    name: 'Rahul Sharma',
    email: 'rahul@acadledger.edu',
    course: 'B.Tech',
    branch: 'CSE',
    semester: 3,
    subject_count: 1,
    marks: { PY301: 92 },
    marks_list: [92],
    subject_breakdown: [
      {
        subject_id: 1,
        subject_code: 'PY301',
        subject_name: 'Python Programming',
        obtained_marks: 92,
        max_marks: 100,
        passing_marks: 40,
        passed: true,
      },
    ],
    total_obtained: 92,
    total_maximum: 100,
    average_marks: 92,
    highest_mark: 92,
    lowest_mark: 92,
    percentage: 92,
    grade: 'A+',
    grade_label: 'Outstanding',
    failed_subjects: [],
    status: 'PASS',
  },
  {
    student_id: 2,
    roll_no: '2026005',
    name: 'Rohan Kulkarni',
    email: 'rohan@acadledger.edu',
    course: 'B.Tech',
    branch: 'AIML',
    semester: 3,
    subject_count: 1,
    marks: { PY301: 34 },
    marks_list: [34],
    subject_breakdown: [
      {
        subject_id: 1,
        subject_code: 'PY301',
        subject_name: 'Python Programming',
        obtained_marks: 34,
        max_marks: 100,
        passing_marks: 40,
        passed: false,
      },
    ],
    total_obtained: 34,
    total_maximum: 100,
    average_marks: 34,
    highest_mark: 34,
    lowest_mark: 34,
    percentage: 34,
    grade: 'F',
    grade_label: 'Needs Improvement',
    failed_subjects: ['Python Programming'],
    status: 'FAIL',
  },
];

const SAMPLE_DASHBOARD: DashboardPayload = {
  exam_id: 2,
  kpis: {
    total_students: 10,
    total_subjects: 5,
    total_examinations: 2,
    average_percentage: 78.4,
    pass_rate: 80.0,
    highest_percentage: 93.8,
    lowest_percentage: 56.2,
  },
  summary: {
    grade_ranges_tuple: [],
    academic_branches_tuple: ['CSE', 'AIML', 'ECE'],
    percentages_list: [93.8, 56.2],
    grade_distribution_dict: { 'A+': 2, A: 3, B: 2, F: 2 },
    average_percentage: 78.4,
    highest_percentage: 93.8,
    lowest_percentage: 56.2,
    pass_count: 8,
    evaluated_count: 10,
    pass_rate: 80.0,
    top_students: [SAMPLE_RESULTS[0]],
    low_performers: [SAMPLE_RESULTS[1]],
  },
  results: SAMPLE_RESULTS,
  subject_stats: [
    {
      subject_id: 1,
      subject_code: 'PY301',
      subject_name: 'Python Programming',
      max_marks: 100,
      passing_marks: 40,
      average_marks: 79,
      pass_rate: 90,
      entries: 10,
    },
  ],
};

describe('EduNova Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders EduNova LoginView, Forgot Password modal, and authenticates via demo preset', async () => {
    const onSuccess = vi.fn();
    vi.mocked(api.login).mockResolvedValueOnce({ access_token: 'tok-123', user: ADMIN_USER });

    render(<LoginView onSuccess={onSuccess} />);
    expect(screen.getByText((_, node) => node?.tagName === 'SPAN' && node.textContent === 'EduNova')).toBeInTheDocument();
    expect(screen.getByText('Sign in to workspace')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Forgot Password?'));
    expect(screen.getByText('Password Reset Help')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Got it'));

    fireEvent.click(screen.getByText('Register Account'));
    expect(screen.getByText('Create faculty account')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Admin Account'));
    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('admin@acadledger.edu', 'Admin@2026');
      expect(onSuccess).toHaveBeenCalledWith(ADMIN_USER);
    });
  });

  it('enforces ProtectedRoute authentication and Admin RBAC redirects', () => {
    render(
      <MemoryRouter initialEntries={['/users']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard Redirect</div>} />
          <Route
            path="/users"
            element={
              <ProtectedRoute user={TEACHER_USER} requireAdmin>
                <div>Admin Users</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard Redirect')).toBeInTheDocument();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Redirect</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={null}>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Login Redirect')).toBeInTheDocument();
  });

  it('renders Sidebar navigation links based on user role', () => {
    const { rerender } = render(
      <MemoryRouter>
        <Sidebar user={ADMIN_USER} mobileMenuOpen={false} onCloseMobile={vi.fn()} onLogout={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Grade Management')).toBeInTheDocument();
    expect(screen.getByText('3D Observatory')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <Sidebar user={TEACHER_USER} mobileMenuOpen={false} onCloseMobile={vi.fn()} onLogout={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    expect(screen.getByText('Marks Management')).toBeInTheDocument();
  });

  it('renders Navbar global search and NotificationPanel academic alerts', () => {
    render(
      <MemoryRouter>
        <Navbar
          pageTitle="Dashboard"
          user={ADMIN_USER}
          dashboard={SAMPLE_DASHBOARD}
          onOpenMobileMenu={vi.fn()}
          onOpenAiDrawer={vi.fn()}
        />
      </MemoryRouter>
    );

    const searchInput = screen.getByLabelText('Global search');
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Rahul' } });
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Toggle academic alerts'));
    expect(screen.getByText('Academic Alerts')).toBeInTheDocument();
    expect(screen.getByText(/Cohort Leader: Rahul Sharma/i)).toBeInTheDocument();
  });

  it('renders generic DataTable, Pagination, and MobileBottomNav', () => {
    const onPageChange = vi.fn();
    render(
      <MemoryRouter>
        <DataTable
          data={SAMPLE_STUDENTS}
          rowKey={(s) => s.id}
          columns={[
            { key: 'roll', header: 'Roll', render: (s) => s.roll_no },
            { key: 'name', header: 'Name', render: (s) => s.name },
          ]}
          footer={
            <Pagination
              currentPage={1}
              totalItems={16}
              pageSize={8}
              onPageChange={onPageChange}
            />
          }
        />
        <MobileBottomNav />
      </MemoryRouter>
    );
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByText('2026003')).toBeInTheDocument();
    fireEvent.click(screen.getByText('2'));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByLabelText('Mobile navigation')).toBeInTheDocument();
  });

  it('StudentsPage fetches records and passes search/branch filters to API', async () => {
    vi.mocked(api.getStudents).mockResolvedValue(SAMPLE_STUDENTS);
    render(
      <MemoryRouter>
        <StudentsPage currentUser={ADMIN_USER} onDataChanged={vi.fn()} onNotify={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Rahul Sharma')).toBeInTheDocument());
    expect(screen.getByText('Add Student')).toBeInTheDocument();

    fireEvent.click(screen.getByText('AIML'));
    await waitFor(() => {
      expect(api.getStudents).toHaveBeenCalledWith({ search: '', branch: 'AIML' });
    });

    fireEvent.change(screen.getByPlaceholderText(/Search by name/i), {
      target: { value: 'Rahul' },
    });
    await waitFor(() => {
      expect(api.getStudents).toHaveBeenCalledWith({ search: 'Rahul', branch: 'AIML' });
    });
  });

  it('MarksPage validates negative/over-max marks and submits valid scores', async () => {
    vi.mocked(api.getStudents).mockResolvedValue(SAMPLE_STUDENTS);
    vi.mocked(api.getSubjects).mockResolvedValue(SAMPLE_SUBJECTS);
    vi.mocked(api.getMarks).mockResolvedValue([]);
    vi.mocked(api.saveMark).mockResolvedValue({ id: 10 });
    const onNotify = vi.fn();
    const onDataChanged = vi.fn();

    render(
      <MemoryRouter>
        <MarksPage
          examinations={SAMPLE_EXAMS}
          selectedExamId={2}
          onSelectExam={vi.fn()}
          onDataChanged={onDataChanged}
          onNotify={onNotify}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Python Programming')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('0–100');
    fireEvent.change(input, { target: { value: '125' } });
    expect(screen.getByText('Out of Range')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save Student Marks'));
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.stringContaining('Invalid marks'), 'error');
      expect(api.saveMark).not.toHaveBeenCalled();
    });

    fireEvent.change(input, { target: { value: '88' } });
    fireEvent.click(screen.getByText('Save Student Marks'));
    await waitFor(() => {
      expect(api.saveMark).toHaveBeenCalledWith({
        student_id: 1,
        subject_id: 1,
        exam_id: 2,
        obtained_marks: 88,
      });
      expect(onDataChanged).toHaveBeenCalled();
    });
  });

  it('ResultsPage filters PASS/FAIL students and opens EduNova marksheet modal', async () => {
    render(
      <ResultsPage
        results={SAMPLE_RESULTS}
        examinations={SAMPLE_EXAMS}
        selectedExamId={2}
        onSelectExam={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByText('Rohan Kulkarni')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'FAIL' }));
    expect(screen.queryByText('Rahul Sharma')).not.toBeInTheDocument();
    expect(screen.getByText('Rohan Kulkarni')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Marksheet' }));
    expect(screen.getByText('Official Academic Marksheet')).toBeInTheDocument();
  });

  it('GradesPage filters by grade tier and runs interactive grade simulator', () => {
    render(
      <MemoryRouter>
        <GradesPage
          dashboard={SAMPLE_DASHBOARD}
          examinations={SAMPLE_EXAMS}
          selectedExamId={2}
          onSelectExam={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Grade Management & Scale Rules')).toBeInTheDocument();
    expect(screen.getByText('A · Excellent')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Failed Any Subject/i));
    expect(screen.getByText('F · Needs Improvement')).toBeInTheDocument();
  });

  it('DashboardPage renders EduNova greeting, KPI cards, and cohort metrics', () => {
    render(
      <MemoryRouter>
        <DashboardPage
          data={SAMPLE_DASHBOARD}
          examinations={SAMPLE_EXAMS}
          selectedExamId={2}
          onSelectExam={vi.fn()}
          user={ADMIN_USER}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Dr\./i)).toBeInTheDocument();
    expect(screen.getByText('Academic Performance Overview')).toBeInTheDocument();
    expect(screen.getByText('78.4%')).toBeInTheDocument();
  });
});
