import axios from 'axios';
import type {
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

const TOKEN_KEY = 'acadledger_jwt_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export const http = axios.create({
  baseURL: '',
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      setStoredToken(null);
    }
    const msg =
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      'Network request failed';
    return Promise.reject(new Error(String(msg)));
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
  // Auth
  login: async (email: string, password: string) =>
    (await http.post<{ access_token: string; user: AuthUser }>('/api/auth/login', { email, password })).data,
  register: async (username: string, email: string, password: string, role: 'ADMIN' | 'TEACHER') =>
    (await http.post<{ access_token: string; user: AuthUser }>('/api/auth/register', { username, email, password, role })).data,
  logout: async () => (await http.post<{ logged_out: boolean }>('/api/auth/logout')).data,
  refresh: async () => (await http.post<{ access_token: string }>('/api/auth/refresh')).data,
  me: async () => (await http.get<{ user: AuthUser }>('/api/auth/me')).data,

  // Users
  getUsers: async () => (await http.get<AuthUser[]>('/api/users')).data,
  createUser: async (payload: { username: string; email: string; password: string; role: 'ADMIN' | 'TEACHER' }) =>
    (await http.post<AuthUser>('/api/users', payload)).data,
  deleteUser: async (id: number) => (await http.delete<{ deleted: boolean }>(`/api/users/${id}`)).data,

  // Dashboard & Results
  getDashboard: async (examId?: number) =>
    (await http.get<DashboardPayload>('/api/dashboard', { params: examId ? { exam_id: examId } : undefined })).data,
  getResults: async (examId?: number) =>
    (
      await http.get<{ results: StudentResult[]; summary: DashboardPayload['summary'] }>('/api/results', {
        params: examId ? { exam_id: examId } : undefined,
      })
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
  deleteStudent: async (id: number) => (await http.delete<{ deleted: boolean }>(`/api/students/${id}`)).data,

  // Subjects
  getSubjects: async () => (await http.get<Subject[]>('/api/subjects')).data,
  createSubject: async (payload: Omit<Subject, 'id'>) => (await http.post<Subject>('/api/subjects', payload)).data,
  updateSubject: async (id: number, payload: Partial<Omit<Subject, 'id'>>) =>
    (await http.put<Subject>(`/api/subjects/${id}`, payload)).data,
  deleteSubject: async (id: number) => (await http.delete<{ deleted: boolean }>(`/api/subjects/${id}`)).data,

  // Examinations
  getExaminations: async () => (await http.get<Examination[]>('/api/examinations')).data,
  createExamination: async (payload: Omit<Examination, 'id'>) =>
    (await http.post<Examination>('/api/examinations', payload)).data,
  updateExamination: async (id: number, payload: Partial<Omit<Examination, 'id'>>) =>
    (await http.put<Examination>(`/api/examinations/${id}`, payload)).data,
  deleteExamination: async (id: number) => (await http.delete<{ deleted: boolean }>(`/api/examinations/${id}`)).data,

  // Marks
  getMarks: async (examId?: number, studentId?: number) => {
    const params: Record<string, number> = {};
    if (examId) params.exam_id = examId;
    if (studentId) params.student_id = studentId;
    return (await http.get<MarkRecord[]>('/api/marks', { params })).data;
  },
  saveMark: async (payload: { student_id: number; subject_id: number; exam_id: number; obtained_marks: number }) =>
    (await http.post<{ id: number; updated?: boolean }>('/api/marks', payload)).data,
  deleteMark: async (id: number) => (await http.delete<{ deleted: boolean }>(`/api/marks/${id}`)).data,

  // CSV Import / Export
  importStudentsCSV: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return (
      await http.post<{ inserted: number; total_valid: number; errors: string[]; error_report_csv?: string }>(
        '/api/import/students',
        fd
      )
    ).data;
  },
  importMarksCSV: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return (
      await http.post<{ upserted: number; total_valid: number; errors: string[]; error_report_csv?: string }>(
        '/api/import/marks',
        fd
      )
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
  inspectPythonStructures: async () => (await http.get<Record<string, unknown>>('/api/python-structures/inspect')).data,
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
