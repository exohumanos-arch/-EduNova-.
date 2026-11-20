import axios from 'axios';
import type {
  AccessCodeStatus,
  AuthUser,
  CohortAIInsights,
  DashboardPayload,
  Examination,
  MarkRecord,
  Student,
  StudentAIAnalysis,
  StudentResult,
  Subject,
} from '../types';
import { getErrorMessage } from '../utils/errorMessage';

export { getErrorMessage };

const SESSION_TOKEN_KEY = 'edunova_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null) {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage restriction errors in sandboxed contexts
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export const http = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const token = getStoredSessionToken();
  if (token) {
    config.headers = config.headers ?? {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    if (
      status === 401 &&
      !url.includes('/api/auth/code-login') &&
      !url.includes('/api/auth/me') &&
      !url.includes('/api/auth/logout')
    ) {
      setStoredSessionToken(null);
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }
    const msg = getErrorMessage(error, 'Network request failed');
    return Promise.reject(new Error(msg));
  }
);

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // Role-Based Access Code Auth (HttpOnly Cookie + Server-Tracked Session Token)
  codeLogin: async (
    role: 'admin' | 'teacher',
    access_code: string
  ): Promise<{
    success: boolean;
    message: string;
    authenticated: boolean;
    role: 'ADMIN' | 'TEACHER';
    user: AuthUser;
    session_token?: string;
    expires_at?: string;
  }> => {
    const res = await http.post<{
      success?: boolean;
      message?: string;
      authenticated?: boolean;
      role?: string;
      user?: Partial<AuthUser>;
      session_token?: string;
      expires_at?: string;
      detail?: unknown;
      error?: unknown;
    }>('/api/auth/code-login', { role, access_code });

    const data = res?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Received an invalid response from the authentication server.');
    }

    if (data.success === false) {
      throw new Error(getErrorMessage(data, 'Invalid access code. Please try again.'));
    }

    const rawRole = String(data.user?.role ?? data.role ?? '').trim().toUpperCase();
    if (rawRole !== 'ADMIN' && rawRole !== 'TEACHER') {
      throw new Error('Received an invalid authentication response from the server.');
    }

    if (data.authenticated === false) {
      throw new Error(getErrorMessage(data, 'Authentication was not completed. Please try again.'));
    }

    const normalizedRole: 'ADMIN' | 'TEACHER' = rawRole;
    const user: AuthUser = {
      id: typeof data.user?.id === 'number' ? data.user.id : normalizedRole === 'ADMIN' ? 1 : 2,
      username:
        typeof data.user?.username === 'string' && data.user.username.trim()
          ? data.user.username.trim()
          : normalizedRole === 'ADMIN'
          ? 'Administrator'
          : 'Teacher',
      role: normalizedRole,
    };

    if (data.session_token) {
      setStoredSessionToken(data.session_token);
    }

    return {
      success: true,
      message:
        typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : 'Login successful',
      authenticated: true,
      role: normalizedRole,
      user,
      session_token: data.session_token,
      expires_at: data.expires_at,
    };
  },
  logout: async () => {
    try {
      return (await http.post<{ logged_out: boolean }>('/api/auth/logout')).data;
    } finally {
      setStoredSessionToken(null);
    }
  },
  refresh: async () => {
    const data = (
      await http.post<{
        refreshed: boolean;
        role: 'ADMIN' | 'TEACHER';
        user: AuthUser;
        session_token?: string;
        expires_at?: string;
      }>('/api/auth/refresh')
    ).data;
    if (data.session_token) {
      setStoredSessionToken(data.session_token);
    }
    return data;
  },
  me: async () =>
    (
      await http.get<{
        authenticated: boolean;
        role: 'ADMIN' | 'TEACHER';
        user: AuthUser;
        expires_at?: string;
      }>('/api/auth/me')
    ).data,

  // Admin Access Code Configuration
  getAccessCodeStatus: async () =>
    (await http.get<AccessCodeStatus>('/api/admin/access-codes')).data,
  updateAccessCode: async (payload: {
    target_role: 'TEACHER' | 'ADMIN';
    new_code: string;
    current_admin_code?: string;
  }) =>
    (
      await http.put<{ updated: boolean; target_role: 'TEACHER' | 'ADMIN'; updated_at: string }>(
        '/api/admin/access-codes',
        payload
      )
    ).data,
  getAdminDbHealth: async () =>
    (await http.get<Record<string, unknown>>('/api/admin/db-health')).data,

  // Dashboard & Results
  getDashboard: async (examId?: number) =>
    (
      await http.get<DashboardPayload>('/api/dashboard', {
        params: examId ? { exam_id: examId } : undefined,
      })
    ).data,
  getResults: async (examId?: number) =>
    (
      await http.get<{ results: StudentResult[]; summary: DashboardPayload['summary'] }>(
        '/api/results',
        {
          params: examId ? { exam_id: examId } : undefined,
        }
      )
    ).data,
  getStudentResult: async (studentId: number, examId?: number) =>
    (
      await http.get<StudentResult>(`/api/results/${studentId}`, {
        params: examId ? { exam_id: examId } : undefined,
      })
    ).data,

  // Students
  getStudents: async (params?: { search?: string; branch?: string; semester?: number | string }) => {
    const query: Record<string, string> = {};
    if (params?.search) query.search = params.search;
    if (params?.branch && params.branch !== 'ALL') query.branch = params.branch;
    if (params?.semester && params.semester !== 'ALL') query.semester = String(params.semester);
    return (await http.get<Student[]>('/api/students', { params: query })).data;
  },
  getStudent: async (id: number) => (await http.get<Student>(`/api/students/${id}`)).data,
  createStudent: async (payload: Omit<Student, 'id' | 'created_at'>) =>
    (await http.post<Student>('/api/students', payload)).data,
  updateStudent: async (id: number, payload: Partial<Omit<Student, 'id'>>) =>
    (await http.put<Student>(`/api/students/${id}`, payload)).data,
  deleteStudent: async (id: number) =>
    (await http.delete<{ deleted: boolean }>(`/api/students/${id}`)).data,

  // Subjects
  getSubjects: async () => (await http.get<Subject[]>('/api/subjects')).data,
  createSubject: async (payload: Omit<Subject, 'id'>) =>
    (await http.post<Subject>('/api/subjects', payload)).data,
  updateSubject: async (id: number, payload: Partial<Omit<Subject, 'id'>>) =>
    (await http.put<Subject>(`/api/subjects/${id}`, payload)).data,
  deleteSubject: async (id: number) =>
    (await http.delete<{ deleted: boolean }>(`/api/subjects/${id}`)).data,

  // Examinations
  getExaminations: async () => (await http.get<Examination[]>('/api/examinations')).data,
  createExamination: async (payload: Omit<Examination, 'id'>) =>
    (await http.post<Examination>('/api/examinations', payload)).data,
  updateExamination: async (id: number, payload: Partial<Omit<Examination, 'id'>>) =>
    (await http.put<Examination>(`/api/examinations/${id}`, payload)).data,
  deleteExamination: async (id: number) =>
    (await http.delete<{ deleted: boolean }>(`/api/examinations/${id}`)).data,

  // Marks
  getMarks: async (examId?: number, studentId?: number) => {
    const params: Record<string, number> = {};
    if (examId) params.exam_id = examId;
    if (studentId) params.student_id = studentId;
    return (await http.get<MarkRecord[]>('/api/marks', { params })).data;
  },
  saveMark: async (payload: {
    student_id: number;
    subject_id: number;
    exam_id: number;
    obtained_marks: number;
  }) => (await http.post<{ id: number; updated?: boolean }>('/api/marks', payload)).data,
  deleteMark: async (id: number) =>
    (await http.delete<{ deleted: boolean }>(`/api/marks/${id}`)).data,

  // CSV Import / Export
  importStudentsCSV: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return (
      await http.post<{
        inserted: number;
        total_valid: number;
        errors: string[];
        error_report_csv?: string;
      }>('/api/import/students', fd)
    ).data;
  },
  importMarksCSV: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return (
      await http.post<{
        upserted: number;
        total_valid: number;
        errors: string[];
        error_report_csv?: string;
      }>('/api/import/marks', fd)
    ).data;
  },
  downloadExportCSV: async (type: 'students' | 'marks' | 'results', examId?: number) => {
    const res = await http.get(`/api/export/${type}`, {
      params: examId ? { exam_id: examId } : undefined,
      responseType: 'blob',
    });
    triggerBlobDownload(res.data, `${type}_export.csv`);
  },
  downloadStudentResultCSV: async (studentId: number, rollNo: string, examId?: number) => {
    const res = await http.get(`/api/export/results/${studentId}`, {
      params: examId ? { exam_id: examId } : undefined,
      responseType: 'blob',
    });
    triggerBlobDownload(res.data, `result_${rollNo}.csv`);
  },

  // Python Data Structures & DB Health
  inspectPythonStructures: async () =>
    (await http.get<Record<string, unknown>>('/api/python-structures/inspect')).data,
  getDbHealth: async () => (await http.get<Record<string, unknown>>('/api/health/db')).data,

  // Gemini AI Endpoints
  aiChat: async (payload: {
    history: { role: 'user' | 'model'; text: string }[];
    message: string;
    model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
    examId?: number;
  }) => (await http.post<{ reply: string; model: string }>('/api/ai/chat', payload)).data,
  analyzeStudentAI: async (studentId: number, examId?: number) =>
    (await http.post<StudentAIAnalysis>('/api/ai/analyze-student', { studentId, examId })).data,
  cohortInsightsAI: async (examId?: number) =>
    (await http.post<CohortAIInsights>('/api/ai/cohort-insights', { examId })).data,
};
