import { api } from './api';
import type { Student } from '../types';

export const studentService = {
  list: (params?: { search?: string; branch?: string; semester?: number | string }) =>
    api.getStudents(params),
  getById: (id: number) => api.getStudent(id),
  create: (payload: Omit<Student, 'id' | 'created_at'>) => api.createStudent(payload),
  update: (id: number, payload: Partial<Omit<Student, 'id'>>) => api.updateStudent(id, payload),
  remove: (id: number) => api.deleteStudent(id),
  importCSV: (file: File) => api.importStudentsCSV(file),
  exportCSV: () => api.downloadExportCSV('students'),
};
