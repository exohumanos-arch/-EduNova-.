import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, SlidersHorizontal, Users } from 'lucide-react';
import type { DashboardPayload, Examination } from '../types';
import { StatCard } from '../components/StatCard';
import { ChartCard } from '../components/ChartCard';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';
import type { StudentResult } from '../types';

interface GradesPageProps {
  dashboard: DashboardPayload | null;
  examinations: Examination[];
  selectedExamId: number;
  onSelectExam: (id: number) => void;
}

const DEFAULT_GRADE_TIERS = [
  { min_percentage: 90, grade: 'A+', label: 'Outstanding', range: '90% – 100%' },
  { min_percentage: 80, grade: 'A', label: 'Excellent', range: '80% – 89.9%' },
  { min_percentage: 70, grade: 'B', label: 'Very Good', range: '70% – 79.9%' },
  { min_percentage: 60, grade: 'C', label: 'Good', range: '60% – 69.9%' },
  { min_percentage: 50, grade: 'D', label: 'Pass', range: '50% – 59.9%' },
  { min_percentage: 0, grade: 'F', label: 'Needs Improvement', range: 'Below 50% or Subject Fail' },
];

function simulateGrade(pct: number, failedAnySubject: boolean) {
  if (failedAnySubject || pct < 50) {
    return { grade: 'F', label: 'Needs Improvement', status: 'FAIL' };
  }
  if (pct >= 90) return { grade: 'A+', label: 'Outstanding', status: 'PASS' };
  if (pct >= 80) return { grade: 'A', label: 'Excellent', status: 'PASS' };
  if (pct >= 70) return { grade: 'B', label: 'Very Good', status: 'PASS' };
  if (pct >= 60) return { grade: 'C', label: 'Good', status: 'PASS' };
  return { grade: 'D', label: 'Pass', status: 'PASS' };
}

export const GradesPage: React.FC<GradesPageProps> = ({
  dashboard,
  examinations,
  selectedExamId,
  onSelectExam,
}) => {
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [simPct, setSimPct] = useState<number>(84);
  const [simFailedSubject, setSimFailedSubject] = useState<boolean>(false);

  const simResult = useMemo(
    () => simulateGrade(simPct, simFailedSubject),
    [simPct, simFailedSubject]
  );

  const gradeCounts = dashboard?.summary.grade_distribution_dict ?? {};
  const evaluatedCount = dashboard?.summary.evaluated_count ?? 0;

  const tiers = useMemo(() => {
    const backendTuple = dashboard?.summary.grade_ranges_tuple;
    if (!backendTuple || backendTuple.length === 0) return DEFAULT_GRADE_TIERS;
    return DEFAULT_GRADE_TIERS.map((d) => {
      const matched = backendTuple.find((t) => t.grade === d.grade);
      return matched ? { ...d, label: matched.label, min_percentage: matched.min_percentage } : d;
    });
  }, [dashboard]);

  const filteredStudents = useMemo(() => {
    const list = (dashboard?.results ?? []).filter((r) => r.subject_count > 0);
    if (gradeFilter === 'ALL') return list;
    return list.filter((r) => r.grade === gradeFilter);
  }, [dashboard, gradeFilter]);

  const honorCount = (gradeCounts['A+'] ?? 0) + (gradeCounts['A'] ?? 0);

  const columns: DataTableColumn<StudentResult>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (r) => (
        <Link to={`/students/${r.student_id}`} className="flex items-center gap-2.5 group">
          <StudentAvatar name={r.name} size="sm" />
          <div>
            <p className="font-semibold text-[#24243A] group-hover:text-[#7357E8]">{r.name}</p>
            <p className="text-xs font-mono text-[#85859B]">{r.roll_no}</p>
          </div>
        </Link>
      ),
    },
    {
      key: 'branch',
      header: 'Branch',
      className: 'text-xs text-[#85859B]',
      render: (r) => `${r.branch} · Sem ${r.semester}`,
    },
    {
      key: 'total',
      header: 'Total Marks',
      align: 'right',
      className: 'font-mono tabular-nums text-[#24243A]',
      render: (r) => `${r.total_obtained} / ${r.total_maximum}`,
    },
    {
      key: 'percentage',
      header: 'Percentage',
      align: 'right',
      className: 'font-mono tabular-nums font-semibold text-[#24243A]',
      render: (r) => `${r.percentage.toFixed(2)}%`,
    },
    {
      key: 'grade',
      header: 'Assigned Grade',
      align: 'right',
      render: (r) => <StatusBadge label={r.grade} />,
    },
    {
      key: 'status',
      header: 'Result',
      align: 'right',
      render: (r) => <StatusBadge label={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            Grade Management &amp; Scale Rules
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Inspect institutional Python grade boundaries, simulate scores, and browse cohort tiers.
          </p>
        </div>

        <select
          aria-label="Select examination"
          value={selectedExamId}
          onChange={(e) => onSelectExam(Number(e.target.value))}
          className="rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-sm font-medium text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
        >
          {examinations.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.exam_name}
            </option>
          ))}
        </select>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Honors Standing (A+ & A)"
          value={honorCount}
          subtitle={`${evaluatedCount} total evaluated students`}
          tone="purple"
          icon={<Award className="w-5 h-5" />}
        />
        <StatCard
          label="Passing Threshold"
          value="50.0%"
          subtitle="Plus all individual subject minimums"
          tone="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          label="Cohort Pass Count"
          value={dashboard?.summary.pass_count ?? 0}
          subtitle={`${(dashboard?.kpis.pass_rate ?? 0).toFixed(1)}% overall pass rate`}
          tone="blue"
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Grade Scale + Live Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <ChartCard
            title="Institutional Grading Boundaries"
            subtitle="Read from Python GRADE_RANGES tuple in grade_calculator.py"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tiers.map((tier) => {
                const count = gradeCounts[tier.grade] ?? 0;
                const share = evaluatedCount > 0 ? Math.round((count / evaluatedCount) * 100) : 0;
                return (
                  <button
                    key={tier.grade}
                    type="button"
                    onClick={() =>
                      setGradeFilter((prev) => (prev === tier.grade ? 'ALL' : tier.grade))
                    }
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      gradeFilter === tier.grade
                        ? 'border-[#7357E8] bg-[#EEE9FF]/50'
                        : 'border-[#ECEBF3] bg-[#F7F7FC] hover:border-[#7357E8]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <StatusBadge label={tier.grade} />
                      <span className="font-mono text-xs text-[#85859B] tabular-nums">
                        {count} students ({share}%)
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm font-bold text-[#24243A]">{tier.label}</p>
                    <p className="text-xs font-mono text-[#85859B] mt-0.5 tabular-nums">
                      {tier.range}
                    </p>
                  </button>
                );
              })}
            </div>
          </ChartCard>
        </div>

        <div className="lg:col-span-5">
          <ChartCard
            title="Grade Calculator Simulator"
            subtitle="Preview grade and pass rules before entering marks"
            action={<SlidersHorizontal className="w-4 h-4 text-[#7357E8]" />}
          >
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-[#24243A]">Overall Percentage</span>
                  <span className="font-mono font-bold text-[#7357E8] tabular-nums">
                    {simPct.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={simPct}
                  onChange={(e) => setSimPct(Number(e.target.value))}
                  aria-label="Simulate overall percentage"
                  className="w-full accent-[#7357E8]"
                />
              </div>

              <label className="flex items-center justify-between rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-4 py-3 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-[#24243A]">Failed Any Subject</p>
                  <p className="text-[11px] text-[#85859B]">
                    Enforces automatic F grade if any single subject is below passing marks
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={simFailedSubject}
                  onChange={(e) => setSimFailedSubject(e.target.checked)}
                  className="rounded border-[#ECEBF3] text-[#7357E8] focus:ring-[#7357E8]"
                />
              </label>

              <div className="rounded-2xl bg-[#F7F7FC] border border-[#ECEBF3] p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#85859B]">Calculated Outcome</p>
                  <p className="font-display text-xl font-bold text-[#24243A] mt-0.5">
                    {simResult.grade} · {simResult.label}
                  </p>
                </div>
                <StatusBadge label={simResult.status} />
              </div>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Cohort Students by Grade */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-[#24243A]">
            Students by Assigned Grade
          </h2>
          <div className="flex flex-wrap gap-1 p-1 bg-white border border-[#ECEBF3] rounded-xl">
            {['ALL', 'A+', 'A', 'B', 'C', 'D', 'F'].map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setGradeFilter(tier)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  gradeFilter === tier
                    ? 'bg-[#7357E8] text-white'
                    : 'text-[#85859B] hover:text-[#24243A]'
                }`}
              >
                {tier === 'ALL' ? 'All Grades' : tier}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          data={filteredStudents}
          columns={columns}
          rowKey={(r) => r.student_id}
          emptyState={<span>No evaluated students hold grade {gradeFilter} in this exam.</span>}
        />
      </div>
    </div>
  );
};
