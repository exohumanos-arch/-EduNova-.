import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft,
  Download,
  Pencil,
  Printer,
  Sparkles,
  AlertCircle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser, Examination, StudentAIAnalysis, StudentResult } from '../types';
import { StatCard } from '../components/StatCard';
import { ChartCard } from '../components/ChartCard';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';

interface StudentProfilePageProps {
  currentUser: AuthUser;
  examinations: Examination[];
  selectedExamId: number;
  onSelectExam: (id: number) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

interface ExamHistoryRow {
  exam: Examination;
  result: StudentResult;
}

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({
  currentUser,
  examinations,
  selectedExamId,
  onSelectExam,
  onNotify,
}) => {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const isAdmin = currentUser.role === 'ADMIN';

  const [result, setResult] = useState<StudentResult | null>(null);
  const [examHistory, setExamHistory] = useState<ExamHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<StudentAIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    setLoading(true);
    setAiAnalysis(null);
    setAiError(null);

    api
      .getStudentResult(studentId, selectedExamId)
      .then((res) => {
        if (active) setResult(res);
      })
      .catch((err: any) => {
        if (active) onNotify(err?.message || 'Could not load student profile', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studentId, selectedExamId]);

  useEffect(() => {
    if (!studentId || examinations.length === 0) return;
    let active = true;
    Promise.all(
      examinations.map(async (exam) => {
        try {
          const r = await api.getStudentResult(studentId, exam.id);
          return { exam, result: r };
        } catch {
          return null;
        }
      })
    ).then((rows) => {
      if (active) {
        setExamHistory(rows.filter((x): x is ExamHistoryRow => x !== null));
      }
    });
    return () => {
      active = false;
    };
  }, [studentId, examinations]);

  const handleAnalyze = async () => {
    if (!result) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const analysis = await api.analyzeStudentAI(result.student_id, selectedExamId);
      setAiAnalysis(analysis);
    } catch (err: any) {
      setAiError(err?.message || 'AI evaluation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!result) return;
    try {
      await api.downloadStudentResultCSV(result.student_id, result.roll_no, selectedExamId);
      onNotify(`Downloaded transcript CSV for ${result.name}`);
    } catch (err: any) {
      onNotify(err?.message || 'CSV export failed', 'error');
    }
  };

  const passedSubjectsCount = useMemo(
    () => (result ? result.subject_breakdown.filter((b) => b.passed).length : 0),
    [result]
  );

  if (loading) {
    return (
      <div className="edunova-card p-10 text-center text-sm text-[#85859B]">
        Loading academic profile...
      </div>
    );
  }

  if (!result) {
    return (
      <div className="edunova-card p-10 text-center space-y-3">
        <p className="text-sm text-[#85859B]">Student record was not found.</p>
        <Link
          to="/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7357E8] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to Student Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="edunova-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <StudentAvatar name={result.name} size="lg" />
          <div>
            <Link
              to="/students"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#85859B] hover:text-[#7357E8] mb-1 no-print"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Student Directory
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
                {result.name}
              </h1>
              <StatusBadge label={result.status} />
            </div>
            <p className="text-xs text-[#85859B] mt-1 font-mono">
              Roll {result.roll_no} · {result.course} {result.branch} · Semester {result.semester} ·{' '}
              {result.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <select
            aria-label="Select examination"
            value={selectedExamId}
            onChange={(e) => onSelectExam(Number(e.target.value))}
            className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
          >
            {examinations.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.exam_name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-white px-3 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-white px-3 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>

          {isAdmin && (
            <Link
              to={`/students/${result.student_id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7357E8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] whitespace-nowrap"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Student
            </Link>
          )}
        </div>
      </div>

      {/* 4 Summary StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Overall Percentage"
          value={`${result.percentage.toFixed(2)}%`}
          valueClassName="text-[#7357E8]"
          subtitle={`${result.total_obtained} / ${result.total_maximum} marks`}
          tone="purple"
          icon={<Award className="w-5 h-5" />}
        />
        <StatCard
          label="Total Examinations"
          value={examHistory.filter((h) => h.result.subject_count > 0).length}
          subtitle={`${examinations.length} scheduled cycles`}
          tone="blue"
          icon={<CalendarDays className="w-5 h-5" />}
        />
        <StatCard
          label="Current Grade"
          value={result.grade}
          subtitle={result.grade_label}
          tone="orange"
          icon={<BookOpen className="w-5 h-5" />}
        />
        <StatCard
          label="Subjects Passed"
          value={`${passedSubjectsCount} / ${result.subject_count}`}
          valueClassName="text-[#218758]"
          subtitle={result.status === 'PASS' ? 'All criteria met' : 'Needs remediation'}
          tone="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
      </div>

      {/* Subject Breakdown Table & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 edunova-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ECEBF3] flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#24243A]">
              Subject-Wise Marks Breakdown
            </h2>
            <Link to="/marks" className="text-xs font-semibold text-[#7357E8] hover:underline">
              Update Marks
            </Link>
          </div>
          {result.subject_breakdown.length === 0 ? (
            <div className="p-8 text-sm text-[#85859B]">
              No marks have been recorded for this examination cycle yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F7FC] border-b border-[#ECEBF3] text-xs text-[#85859B]">
                  <tr>
                    <th className="text-left font-semibold px-6 py-3">Code</th>
                    <th className="text-left font-semibold px-4 py-3">Subject</th>
                    <th className="text-right font-semibold px-4 py-3">Obtained</th>
                    <th className="text-right font-semibold px-4 py-3">Max / Pass</th>
                    <th className="text-right font-semibold px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEBF3]/70">
                  {result.subject_breakdown.map((b) => (
                    <tr key={b.subject_code} className="hover:bg-[#F7F7FC]">
                      <td className="px-6 py-3 font-mono text-xs font-semibold text-[#7357E8]">
                        {b.subject_code}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#24243A]">{b.subject_name}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#24243A]">
                        {b.obtained_marks}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-[#85859B]">
                        {b.max_marks} ({b.passing_marks} pass)
                      </td>
                      <td className="px-6 py-3 text-right">
                        <StatusBadge label={b.passed ? 'PASS' : 'FAIL'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <ChartCard
            title="Subject Score Distribution"
            subtitle="Marks obtained per subject in active exam"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={result.subject_breakdown}
                  margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEBF3" vertical={false} />
                  <XAxis dataKey="subject_code" tick={{ fontSize: 12, fill: '#85859B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#85859B' }} />
                  <Tooltip />
                  <Bar
                    dataKey="obtained_marks"
                    name="Obtained Marks"
                    fill="#7357E8"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Examination & Grade History */}
      <ChartCard
        title="Examination & Grade History"
        subtitle="Multi-cycle comparison across all recorded academic examinations"
      >
        {examHistory.length === 0 ? (
          <p className="text-xs text-[#85859B]">No examination history recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {examHistory.map(({ exam, result: hist }) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => onSelectExam(exam.id)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  exam.id === selectedExamId
                    ? 'border-[#7357E8] bg-[#EEE9FF]/50'
                    : 'border-[#ECEBF3] bg-[#F7F7FC] hover:border-[#7357E8]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#24243A] truncate">
                    {exam.exam_name}
                  </span>
                  <StatusBadge label={hist.grade} />
                </div>
                <p className="text-[11px] font-mono text-[#85859B] mt-1">
                  {exam.exam_date} · Semester {exam.semester}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#7357E8] tabular-nums">
                    {hist.percentage.toFixed(1)}%
                  </span>
                  <StatusBadge label={hist.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Gemini AI Faculty Evaluation */}
      <ChartCard
        title="AI Faculty Evaluation"
        subtitle="Personalized subject strengths, focus areas, and intervention plan powered by Gemini."
        action={
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={aiLoading || result.subject_count === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] disabled:opacity-50 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? 'Evaluating...' : 'Generate Evaluation'}
          </button>
        }
      >
        {!aiAnalysis && !aiError && (
          <p className="text-xs text-[#85859B]">
            Click &ldquo;Generate Evaluation&rdquo; to build an individualized coaching plan for{' '}
            {result.name}.
          </p>
        )}

        {aiError && (
          <div className="flex items-center gap-2 rounded-xl border border-[#EF6262]/30 bg-[#FDECEC] p-3 text-xs text-[#C23E3E]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {aiAnalysis && (
          <div className="space-y-4 text-xs text-[#24243A]">
            <p className="text-sm leading-relaxed">{aiAnalysis.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="font-bold text-[#218758] mb-1.5">Key Strengths</p>
                <ul className="list-disc pl-4 space-y-1 text-[#85859B]">
                  {aiAnalysis.strengths.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-bold text-[#B56E10] mb-1.5">Focus Areas</p>
                <ul className="list-disc pl-4 space-y-1 text-[#85859B]">
                  {aiAnalysis.focusAreas.map((f, idx) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="pt-3 border-t border-[#ECEBF3]">
              <span className="font-bold text-[#24243A]">Action Plan: </span>
              {aiAnalysis.recommendedPlan}
            </p>
          </div>
        )}
      </ChartCard>
    </div>
  );
};
