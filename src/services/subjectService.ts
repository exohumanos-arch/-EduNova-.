import { api } from './api';
import type { Subject } from '../types';

export const subjectService = {
  list: () => api.getSubjects(),
  create: (payload: Omit<Subject, 'id'>) => api.createSubject(payload),
  update: (id: number, payload: Partial<Omit<Subject, 'id'>>) => api.updateSubject(id, payload),
  remove: (id: number) => api.deleteSubject(id),
};
