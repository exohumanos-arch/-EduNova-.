import { api } from './api';

export const resultService = {
  getDashboard: (examId?: number) => api.getDashboard(examId),
  getAll: (examId?: number) => api.getResults(examId),
  getByStudent: (studentId: number, examId?: number) => api.getStudentResult(studentId, examId),
  exportCohortCSV: (examId?: number) => api.downloadExportCSV('results', examId),
  exportStudentCSV: (studentId: number, rollNo: string, examId?: number) =>
    api.downloadStudentResultCSV(studentId, rollNo, examId),
};
