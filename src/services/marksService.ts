import { api } from './api';

export const marksService = {
  list: (examId?: number, studentId?: number) => api.getMarks(examId, studentId),
  save: (payload: { student_id: number; subject_id: number; exam_id: number; obtained_marks: number }) =>
    api.saveMark(payload),
  remove: (id: number) => api.deleteMark(id),
  importCSV: (file: File) => api.importMarksCSV(file),
  exportCSV: (examId?: number) => api.downloadExportCSV('marks', examId),
};
