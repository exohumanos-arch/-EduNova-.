import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { Download, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { DashboardPayload, Examination } from '../types';
import { ChartCard } from '../components/ChartCard';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';

interface ReportsPageProps {
  dashboard: DashboardPayload | null;
  examinations: Examination[];
  selectedExamId: number;
  onSelectExam: (id: number) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#39B980',
  A: '#7357E8',
  B: '#6366F1',
  C: '#F4A340',
  D: '#FB923C',
  F: '#EF6262',
};

interface BranchRow {
  branch: string;
  students: number;
  avgPercentage: number;
  highest: number;
  lowest: number;
  passRate: number;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  dashboard,
  examinations,
  selectedExamId,
  onSelectExam,
  onNotify,
}) => {
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  const [examTrend, setExamTrend] = useState<
    { exam: string; avgPercentage: number; passRate: number }[]
  >([]);

  useEffect(() => {
    let active = true;
    if (examinations.length === 0) return;

    Promise.all(
      examinations.map(async (ex) => {
        try {
          const res = await api.getDashboard(ex.id);
          return {
            exam: ex.exam_name.replace(/\s+\d{4}$/, ''),
            avgPercentage: Number(res.kpis.average_percentage.toFixed(1)),
            passRate: Number(res.kpis.pass_rate.toFixed(1)),
          };
        } catch {
          return { exam: ex.exam_name, avgPercentage: 0, passRate: 0 };
        }
      })
    ).then((rows) => {
      if (active) setExamTrend(rows);
    });

    return () => {
      active = false;
    };
  }, [examinations]);

  const branches = useMemo(() => {
    const set = new Set<string>();
    for (const r of dashboard?.results ?? []) set.add(r.branch);
    return ['ALL', ...Array.from(set)];
  }, [dashboard]);

  const semesters = useMemo(() => {
    const set = new Set<number>();
    for (const r of dashboard?.results ?? []) set.add(r.semester);
    return ['ALL', ...Array.from(set).sort((a, b) => a - b).map(String)];
  }, [dashboard]);

  const filteredResults = useMemo(() => {
    return (dashboard?.results ?? []).filter((r) => {
      if (branchFilter !== 'ALL' && r.branch !== branchFilter) return false;
      if (semesterFilter !== 'ALL' && String(r.semester) !== semesterFilter) return false;
      return true;
    });
  }, [dashboard, branchFilter, semesterFilter]);

  const branchStats: BranchRow[] = useMemo(() => {
    const groups: Record<string, { branch: string; scores: number[]; passes: number }> = {};
    for (const r of filteredResults) {
      if (r.subject_count === 0) continue;
      if (!groups[r.branch]) {
        groups[r.branch] = { branch: r.branch, scores: [], passes: 0 };
      }
      groups[r.branch].scores.push(r.percentage);
      if (r.status === 'PASS') groups[r.branch].passes++;
    }
    return Object.values(groups).map((g) => ({
      branch: g.branch,
      students: g.scores.length,
      avgPercentage: Number(
        (g.scores.reduce((a, b) => a + b, 0) / g.scores.length).toFixed(2)
      ),
      highest: Number(Math.max(...g.scores).toFixed(2)),
      lowest: Number(Math.min(...g.scores).toFixed(2)),
      passRate: Number(((g.passes / g.scores.length) * 100).toFixed(1)),
    }));
  }, [filteredResults]);

  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = { 'A+': 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const r of filteredResults) {
      if (r.subject_count === 0) continue;
      counts[r.grade] = (counts[r.grade] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        color: GRADE_COLORS[name] ?? '#7357E8',
      }))
      .filter((x) => x.value > 0);
  }, [filteredResults]);

  const passFailData = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let pending = 0;
    for (const r of filteredResults) {
      if (r.status === 'PASS') passed++;
      else if (r.status === 'FAIL') failed++;
      else pending++;
    }
    return [
      { name: 'Passed', value: passed, color: '#39B980' },
      { name: 'Failed', value: failed, color: '#EF6262' },
      ...(pending > 0 ? [{ name: 'Pending', value: pending, color: '#F4A340' }] : []),
    ].filter((d) => d.value > 0);
  }, [filteredResults]);

  const topTen = useMemo(
    () =>
      [...filteredResults]
        .filter((r) => r.subject_count > 0)
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 10),
    [filteredResults]
  );

  const handleExport = async (type: 'results' | 'marks' | 'students') => {
    try {
      await api.downloadExportCSV(type, selectedExamId);
      onNotify(`Downloaded ${type} CSV report`);
    } catch (err: any) {
      onNotify(err?.message || 'Export failed', 'error');
    }
  };

  if (!dashboard) return null;

  const branchColumns: DataTableColumn<BranchRow>[] = [
    {
      key: 'branch',
      header: 'Branch',
      className: 'font-semibold text-[#24243A]',
      render: (b) => b.branch,
    },
    {
      key: 'students',
      header: 'Evaluated',
      align: 'right',
      className: 'font-mono tabular-nums',
      render: (b) => b.students,
    },
    {
      key: 'avgPercentage',
      header: 'Average %',
      align: 'right',
      className: 'font-mono tabular-nums font-semibold text-[#7357E8]',
      render: (b) => `${b.avgPercentage.toFixed(2)}%`,
    },
    {
      key: 'highest',
      header: 'Highest %',
      align: 'right',
      className: 'font-mono tabular-nums text-[#218758]',
      render: (b) => `${b.highest.toFixed(2)}%`,
    },
    {
      key: 'lowest',
      header: 'Lowest %',
      align: 'right',
      className: 'font-mono tabular-nums text-[#B56E10]',
      render: (b) => `${b.lowest.toFixed(2)}%`,
    },
    {
      key: 'passRate',
      header: 'Pass Rate',
      align: 'right',
      className: 'font-mono tabular-nums font-semibold text-[#24243A]',
      render: (b) => `${b.passRate.toFixed(1)}%`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Exports */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            Reports &amp; Academic Analytics
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Multi-exam cohort trends, subject performance, pass ratios, and downloadable reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>

          <button
            type="button"
            onClick={() => handleExport('results')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Full Report CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="edunova-card p-4 flex flex-wrap items-center gap-3 no-print">
        <select
          aria-label="Select examination"
          value={selectedExamId}
          onChange={(e) => onSelectExam(Number(e.target.value))}
          className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
        >
          {examinations.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.exam_name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by branch"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
        >
          {branches.map((b) => (
            <option key={b} value={b}>
              {b === 'ALL' ? 'All Branches' : `Branch: ${b}`}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by semester"
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
        >
          {semesters.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All Semesters' : `Semester ${s}`}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('marks')}
            className="rounded-xl border border-[#ECEBF3] bg-white px-3 py-1.5 text-xs font-medium text-[#24243A] hover:bg-[#F7F7FC]"
          >
            Marks CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('students')}
            className="rounded-xl border border-[#ECEBF3] bg-white px-3 py-1.5 text-xs font-medium text-[#24243A] hover:bg-[#F7F7FC]"
          >
            Students CSV
          </button>
        </div>
      </div>

      {/* Row 1: Class Performance Trend & Subject Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="1. Overall Class Performance Across Examinations"
          subtitle="Mean class percentage & overall pass rate by examination cycle"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={examTrend} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                <defs>
                  <linearGradient id="edunovaTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7357E8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#7357E8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEBF3" vertical={false} />
                <XAxis dataKey="exam" tick={{ fontSize: 11, fill: '#85859B' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#85859B' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="avgPercentage"
                  name="Average %"
                  stroke="#7357E8"
                  strokeWidth={2.5}
                  fill="url(#edunovaTrend)"
                />
                <Area
                  type="monotone"
                  dataKey="passRate"
                  name="Pass Rate %"
                  stroke="#39B980"
                  strokeWidth={2}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="2. Subject-Wise Average Marks & Pass Rate"
          subtitle="Active exam subject performance metrics"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboard.subject_stats}
                margin={{ top: 8, right: 16, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEBF3" vertical={false} />
                <XAxis dataKey="subject_code" tick={{ fontSize: 12, fill: '#85859B' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#85859B' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="average_marks" name="Average Marks" fill="#7357E8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pass_rate" name="Pass Rate %" fill="#39B980" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 2: Grade Distribution, Pass vs Fail, Branch Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <ChartCard title="3. Grade Distribution" subtitle="Filtered student cohort breakdown">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradeDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={3}
                  >
                    {gradeDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="lg:col-span-4">
          <ChartCard title="4. Pass vs Fail Ratio" subtitle="Status outcomes across filtered cohort">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={passFailData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={4}
                  >
                    {passFailData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="lg:col-span-4">
          <ChartCard title="5. Branch Comparison" subtitle="Average percentage per department">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchStats} margin={{ top: 8, right: 12, left: -14, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEBF3" vertical={false} />
                  <XAxis dataKey="branch" tick={{ fontSize: 12, fill: '#85859B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#85859B' }} />
                  <Tooltip />
                  <Bar
                    dataKey="avgPercentage"
                    name="Average %"
                    fill="#4935A8"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Row 3: Top 10 Leaderboard & Departmental Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 edunova-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ECEBF3]">
            <h2 className="font-display text-base font-bold text-[#24243A]">
              6. Top 10 Students Leaderboard
            </h2>
            <p className="text-xs text-[#85859B]">Ranked by overall percentage</p>
          </div>
          <div className="divide-y divide-[#ECEBF3]/70">
            {topTen.map((st, idx) => (
              <Link
                key={st.student_id}
                to={`/students/${st.student_id}`}
                className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-[#F7F7FC] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 font-mono text-xs font-bold text-[#7357E8] tabular-nums">
                    #{idx + 1}
                  </span>
                  <StudentAvatar name={st.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#24243A] truncate">{st.name}</p>
                    <p className="text-[11px] font-mono text-[#85859B]">
                      {st.roll_no} · {st.branch}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-mono text-xs font-bold text-[#24243A] tabular-nums">
                    {st.percentage.toFixed(1)}%
                  </span>
                  <StatusBadge label={st.grade} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <DataTable
            data={branchStats}
            columns={branchColumns}
            rowKey={(b) => b.branch}
            emptyState={<span>No departmental data matches current filters.</span>}
          />
        </div>
      </div>
    </div>
  );
};
