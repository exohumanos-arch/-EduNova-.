import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  BookOpen,
  CalendarDays,
  Award,
  Sparkles,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import type { AuthUser, CohortAIInsights, DashboardPayload, Examination } from '../types';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';
import { ChartCard } from '../components/ChartCard';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardPageProps {
  data: DashboardPayload | null;
  examinations: Examination[];
  selectedExamId: number;
  onSelectExam: (id: number) => void;
  user?: AuthUser;
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#39B980',
  A: '#7357E8',
  B: '#6366F1',
  C: '#F4A340',
  D: '#FB923C',
  F: '#EF6262',
};

function getTimeGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good Morning';
  if (hr < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  data,
  examinations,
  selectedExamId,
  onSelectExam,
  user,
}) => {
  const navigate = useNavigate();
  const [prevExamData, setPrevExamData] = useState<DashboardPayload | null>(null);
  const [insights, setInsights] = useState<CohortAIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const previousExam = useMemo(() => {
    const others = examinations.filter((e) => e.id !== selectedExamId);
    return others.length > 0 ? others[0] : null;
  }, [examinations, selectedExamId]);

  useEffect(() => {
    if (!previousExam) {
      setPrevExamData(null);
      return;
    }
    let active = true;
    api
      .getDashboard(previousExam.id)
      .then((res) => {
        if (active) setPrevExamData(res);
      })
      .catch(() => {
        if (active) setPrevExamData(null);
      });
    return () => {
      active = false;
    };
  }, [previousExam]);

  const classAvgDelta = useMemo(() => {
    if (!data || !prevExamData) return undefined;
    const diff = data.kpis.average_percentage - prevExamData.kpis.average_percentage;
    const sign = diff >= 0 ? '+' : '';
    return {
      text: `${sign}${diff.toFixed(1)}%`,
      dir: diff > 0.05 ? ('up' as const) : diff < -0.05 ? ('down' as const) : ('neutral' as const),
    };
  }, [data, prevExamData]);

  const performanceComparisonData = useMemo(() => {
    if (!data) return [];
    return data.subject_stats.map((sub) => {
      const prevSub = prevExamData?.subject_stats.find(
        (p) => p.subject_code === sub.subject_code
      );
      return {
        subject: sub.subject_code,
        subjectName: sub.subject_name,
        currentAvg: Number(sub.average_marks.toFixed(1)),
        previousAvg: prevSub ? Number(prevSub.average_marks.toFixed(1)) : null,
      };
    });
  }, [data, prevExamData]);

  const gradeDistributionData = useMemo(() => {
    if (!data) return [];
    const order = ['A+', 'A', 'B', 'C', 'D', 'F'];
    const dist = data.summary.grade_distribution_dict || {};
    return order
      .map((grade) => ({
        name: grade,
        value: dist[grade] ?? 0,
        color: GRADE_COLORS[grade] ?? '#7357E8',
      }))
      .filter((item) => item.value > 0);
  }, [data]);

  const horizontalSubjectData = useMemo(() => {
    if (!data) return [];
    return [...data.subject_stats]
      .sort((a, b) => b.average_marks - a.average_marks)
      .map((s) => ({
        code: s.subject_code,
        name: s.subject_name,
        average: Number(s.average_marks.toFixed(1)),
        passRate: Number(s.pass_rate.toFixed(1)),
      }));
  }, [data]);

  const handleRunDiagnostics = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await api.cohortInsightsAI(selectedExamId);
      setInsights(res);
    } catch (err: any) {
      setInsightsError(err?.message || 'Unable to generate cohort diagnostics');
    } finally {
      setInsightsLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="edunova-card h-28 p-5 text-xs text-[#85859B]">
              Loading metric...
            </div>
          ))}
        </div>
        <div className="edunova-card h-64 flex items-center justify-center text-sm text-[#85859B]">
          Synchronizing EduNova cohort analytics...
        </div>
      </div>
    );
  }

  const firstName = user?.username?.split(' ')[0] || 'Educator';
  const activeExam = examinations.find((e) => e.id === selectedExamId);
  const recentResults = [...data.results]
    .filter((r) => r.subject_count > 0)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Greeting & Exam Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            {getTimeGreeting()}, {firstName}!
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Academic Performance Overview · Let&apos;s manage academic performance today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select examination"
            value={selectedExamId}
            onChange={(e) => onSelectExam(Number(e.target.value))}
            className="rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-sm font-medium text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
          >
            {examinations.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.exam_name} (Sem {ex.semester})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => navigate('/observatory-3d')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#7357E8] to-[#4935A8] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 transition-opacity whitespace-nowrap shadow-[0_4px_14px_rgba(115,87,232,0.25)]"
          >
            Open 3D Observatory
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 KPI StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Students"
          value={data.kpis.total_students}
          subtitle={`${data.summary.evaluated_count} evaluated in cycle`}
          tone="purple"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Total Subjects"
          value={data.kpis.total_subjects}
          subtitle={`Overall pass rate ${data.kpis.pass_rate.toFixed(1)}%`}
          tone="blue"
          icon={<BookOpen className="w-5 h-5" />}
        />
        <StatCard
          label="Examinations Conducted"
          value={data.kpis.total_examinations}
          subtitle={activeExam ? activeExam.exam_name : 'Active cycle'}
          tone="orange"
          icon={<CalendarDays className="w-5 h-5" />}
        />
        <StatCard
          label="Class Average"
          value={`${data.kpis.average_percentage.toFixed(1)}%`}
          valueClassName="text-[#7357E8]"
          subtitle={`Pass rate ${data.kpis.pass_rate.toFixed(1)}% · Peak ${data.kpis.highest_percentage.toFixed(1)}%`}
          tone="green"
          delta={classAvgDelta?.text}
          deltaDirection={classAvgDelta?.dir}
          icon={<Award className="w-5 h-5" />}
        />
      </div>

      {/* Section A (Performance LineChart) & Section B (Grade Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <ChartCard
            title="Academic Performance Overview"
            subtitle={
              previousExam
                ? `Subject average comparison: ${activeExam?.exam_name ?? 'Current'} vs ${previousExam.exam_name}`
                : 'Subject average marks across active curriculum'
            }
            action={
              <Link
                to="/reports"
                className="text-xs font-semibold text-[#7357E8] hover:text-[#4935A8] whitespace-nowrap"
              >
                Full Analytics
              </Link>
            }
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={performanceComparisonData}
                  margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEBF3" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#85859B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#85859B' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '14px',
                      border: '1px solid #ECEBF3',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="currentAvg"
                    name={activeExam?.exam_name || 'Current Exam'}
                    stroke="#7357E8"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#7357E8', strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6 }}
                  />
                  {prevExamData && (
                    <Line
                      type="monotone"
                      dataKey="previousAvg"
                      name={previousExam?.exam_name || 'Previous Exam'}
                      stroke="#F4A340"
                      strokeWidth={2.5}
                      strokeDasharray="5 4"
                      dot={{ r: 3.5, fill: '#F4A340' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="lg:col-span-5">
          <ChartCard
            title="Grade Distribution"
            subtitle="Computed from Python GRADE_RANGES tuple"
            action={
              <Link
                to="/grades"
                className="text-xs font-semibold text-[#7357E8] hover:text-[#4935A8] whitespace-nowrap"
              >
                Grade Scale
              </Link>
            }
          >
            <div className="h-72 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-full sm:w-56 h-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={gradeDistributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={84}
                      paddingAngle={3}
                    >
                      {gradeDistributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #ECEBF3',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-medium text-[#85859B]">Evaluated</span>
                  <span className="font-display text-2xl font-bold text-[#24243A] tabular-nums">
                    {data.summary.evaluated_count}
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2">
                {gradeDistributionData.map((g) => (
                  <div key={g.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                      <span className="font-semibold text-[#24243A]">Grade {g.name}</span>
                    </div>
                    <span className="font-mono text-[#85859B] tabular-nums">
                      {g.value} students
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Section C (Horizontal Subject BarChart) & Section D (Top Performing Students) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <ChartCard
            title="Subject Performance"
            subtitle="Average marks scored per subject (out of 100)"
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={horizontalSubjectData}
                  margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEBF3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#85859B' }} />
                  <YAxis
                    type="category"
                    dataKey="code"
                    width={64}
                    tick={{ fontSize: 12, fill: '#24243A', fontWeight: 600 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #ECEBF3',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="average"
                    name="Average Marks"
                    fill="#7357E8"
                    radius={[0, 8, 8, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="lg:col-span-7">
          <div className="edunova-card overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECEBF3]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#39B980]" />
                <h2 className="font-display text-base font-bold text-[#24243A]">
                  Top Performing Students
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/results')}
                className="text-xs font-semibold text-[#7357E8] hover:underline"
              >
                View All Results
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F7FC] text-xs text-[#85859B] border-b border-[#ECEBF3]">
                  <tr>
                    <th className="text-left font-semibold px-6 py-3">Rank</th>
                    <th className="text-left font-semibold px-4 py-3">Student</th>
                    <th className="text-left font-semibold px-4 py-3">Roll No</th>
                    <th className="text-right font-semibold px-4 py-3">Percentage</th>
                    <th className="text-right font-semibold px-6 py-3">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEBF3]/70">
                  {data.summary.top_students.map((st, idx) => (
                    <tr key={st.student_id} className="hover:bg-[#F7F7FC] transition-colors">
                      <td className="px-6 py-3 font-mono text-xs font-bold text-[#7357E8] tabular-nums">
                        #{idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/students/${st.student_id}`}
                          className="flex items-center gap-2.5 group"
                        >
                          <StudentAvatar name={st.name} size="sm" />
                          <div>
                            <p className="font-semibold text-[#24243A] group-hover:text-[#7357E8]">
                              {st.name}
                            </p>
                            <p className="text-[11px] text-[#85859B]">{st.branch}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#85859B] tabular-nums">
                        {st.roll_no}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-[#24243A]">
                        {st.percentage.toFixed(2)}%
                      </td>
                      <td className="px-6 py-3 text-right">
                        <StatusBadge label={st.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Section E (Recent Examination Results) & Section F (Students Requiring Attention) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="edunova-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECEBF3]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#7357E8]" />
              <h2 className="font-display text-base font-bold text-[#24243A]">
                Recent Examination Results
              </h2>
            </div>
            <Link
              to="/examinations"
              className="text-xs font-semibold text-[#7357E8] hover:underline"
            >
              Exam Cycles
            </Link>
          </div>
          <div className="divide-y divide-[#ECEBF3]/70">
            {recentResults.map((r) => (
              <Link
                key={r.student_id}
                to={`/students/${r.student_id}`}
                className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F7F7FC] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar name={r.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#24243A] truncate">{r.name}</p>
                    <p className="text-xs text-[#85859B] truncate">
                      {activeExam?.exam_name ?? 'Examination'} · {r.subject_count} subjects
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-xs font-semibold text-[#24243A] tabular-nums">
                    {r.percentage.toFixed(1)}%
                  </span>
                  <StatusBadge label={r.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="edunova-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECEBF3]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F4A340]" />
              <h2 className="font-display text-base font-bold text-[#24243A]">
                Students Requiring Attention
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/marks')}
              className="text-xs font-semibold text-[#7357E8] hover:underline"
            >
              Update Marks
            </button>
          </div>

          {data.summary.low_performers.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#85859B]">
              All evaluated students cleared passing thresholds above 60%.
            </div>
          ) : (
            <div className="divide-y divide-[#ECEBF3]/70">
              {data.summary.low_performers.map((st) => (
                <Link
                  key={st.student_id}
                  to={`/students/${st.student_id}`}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F7F7FC] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar name={st.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#24243A] truncate">
                        {st.name}{' '}
                        <span className="font-mono text-xs font-normal text-[#85859B]">
                          ({st.roll_no})
                        </span>
                      </p>
                      <p className="text-xs text-[#C23E3E] truncate">
                        {st.failed_subjects.length > 0
                          ? `Failed: ${st.failed_subjects.join(', ')}`
                          : 'Below 60% benchmark'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs font-semibold text-[#24243A] tabular-nums">
                      {st.percentage.toFixed(1)}%
                    </span>
                    <StatusBadge label={st.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gemini Cohort Intelligence Card */}
      <ChartCard
        title="AI Cohort Diagnostic Summary"
        subtitle="Synthesize subject bottlenecks, at-risk student alerts, and intervention priorities with Gemini."
        action={
          <button
            type="button"
            onClick={handleRunDiagnostics}
            disabled={insightsLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {insightsLoading ? 'Analyzing Cohort...' : 'Generate Cohort Insights'}
          </button>
        }
      >
        {!insights && !insightsError && (
          <p className="text-xs text-[#85859B]">
            Click &ldquo;Generate Cohort Insights&rdquo; to run an AI evaluation across the active examination cohort.
          </p>
        )}

        {insightsError && (
          <div className="flex items-center gap-2 rounded-xl border border-[#EF6262]/30 bg-[#FDECEC] px-4 py-3 text-xs text-[#C23E3E]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{insightsError}</span>
          </div>
        )}

        {insights && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
            <div className="lg:col-span-3">
              <p className="text-[#24243A] leading-relaxed">{insights.executiveSummary}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#24243A] mb-2">Subject Bottlenecks</h3>
              <ul className="space-y-1.5 text-xs text-[#85859B] list-disc pl-4">
                {insights.subjectBottlenecks.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#C23E3E] mb-2">At-Risk Student Alerts</h3>
              <ul className="space-y-1.5 text-xs text-[#85859B] list-disc pl-4">
                {insights.atRiskAlerts.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#218758] mb-2">Recommended Actions</h3>
              <ul className="space-y-1.5 text-xs text-[#85859B] list-disc pl-4">
                {insights.actionItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
};
