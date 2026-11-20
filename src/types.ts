export type UserRole = 'ADMIN' | 'TEACHER';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export interface Student {
  id: number;
  name: string;
  roll_no: string;
  email: string;
  course: string;
  branch: string;
  semester: number;
  created_at?: string;
}

export interface Subject {
  id: number;
  subject_name: string;
  subject_code: string;
  max_marks: number;
  passing_marks: number;
  semester: number;
}

export interface Examination {
  id: number;
  exam_name: string;
  semester: number;
  exam_date: string;
}

export interface MarkRecord {
  mark_id: number;
  student_id: number;
  subject_id: number;
  exam_id: number;
  obtained_marks: number;
  student_name: string;
  roll_no: string;
  branch: string;
  semester: number;
  subject_name: string;
  subject_code: string;
  max_marks: number;
  passing_marks: number;
  exam_name: string;
  exam_date: string;
}

export interface SubjectBreakdownItem {
  mark_id?: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  obtained_marks: number;
  max_marks: number;
  passing_marks: number;
  passed: boolean;
}

export interface StudentResult {
  student_id: number;
  roll_no: string;
  name: string;
  email: string;
  course: string;
  branch: string;
  semester: number;
  subject_count: number;
  marks: Record<string, number>;
  marks_list: number[];
  subject_breakdown: SubjectBreakdownItem[];
  total_obtained: number;
  total_maximum: number;
  average_marks: number;
  highest_mark: number;
  lowest_mark: number;
  percentage: number;
  grade: string;
  grade_label: string;
  failed_subjects: string[];
  status: 'PASS' | 'FAIL' | 'PENDING';
}

export interface CohortSummary {
  grade_ranges_tuple: { min_percentage: number; grade: string; label: string }[];
  academic_branches_tuple: string[];
  percentages_list: number[];
  grade_distribution_dict: Record<string, number>;
  average_percentage: number;
  highest_percentage: number;
  lowest_percentage: number;
  pass_count: number;
  evaluated_count: number;
  pass_rate: number;
  top_students: StudentResult[];
  low_performers: StudentResult[];
}

export interface SubjectStat {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  max_marks: number;
  passing_marks: number;
  average_marks: number;
  pass_rate: number;
  entries: number;
}

export interface DashboardPayload {
  exam_id: number;
  kpis: {
    total_students: number;
    total_subjects: number;
    total_examinations: number;
    average_percentage: number;
    pass_rate: number;
    highest_percentage: number;
    lowest_percentage: number;
  };
  summary: CohortSummary;
  results: StudentResult[];
  subject_stats: SubjectStat[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  model?: string;
  timestamp: string;
}

export interface StudentAIAnalysis {
  summary: string;
  strengths: string[];
  focusAreas: string[];
  recommendedPlan: string;
}

export interface CohortAIInsights {
  executiveSummary: string;
  subjectBottlenecks: string[];
  atRiskAlerts: string[];
  actionItems: string[];
}
