import React, { useMemo, useState } from 'react';
import { Download, FileText, Sparkles, Printer, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { Examination, StudentAIAnalysis, StudentResult } from '../types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { SearchBar } from '../components/SearchBar';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { EduNovaLogo } from '../components/EduNovaLogo';

interface ResultsPageProps {
  results: StudentResult[];
  examinations: Examination[];
  selectedExamId: number;
  onSelectExam: (id: number) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  results,
  examinations,
  selectedExamId,
  onSelectExam,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL');
  const [sortKey, setSortKey] = useState<string>('percentage');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<StudentAIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'percentage' || key === 'total_obtained' ? 'desc' : 'asc');
    }
  };

  const filtered = useMemo(() => {
    const list = results.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.roll_no.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q)
        );
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'percentage') cmp = a.percentage - b.percentage;
      else if (sortKey === 'total_obtained') cmp = a.total_obtained - b.total_obtained;
      else if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = a.roll_no.localeCompare(b.roll_no);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [results, search, statusFilter, sortKey, sortDir]);

  const handleExport = async () => {
    try {
      await api.downloadExportCSV('results', selectedExamId);
      onNotify('Exported results CSV via Python DictWriter');
    } catch (err: any) {
      onNotify(err?.message || 'Export failed', 'error');
    }
  };

  const openReport = (r: StudentResult) => {
    setSelectedStudent(r);
    setAiAnalysis(null);
    setAiError(null);
  };

  const runEvaluation = async () => {
    if (!selectedStudent) return;
    setAiLoading(true);
    setAiError(null);
    try {
      setAiAnalysis(await api.analyzeStudentAI(selectedStudent.student_id, selectedExamId));
    } catch (err: any) {
      setAiError(err?.message || 'AI evaluation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const activeExam = examinations.find((e) => e.id === selectedExamId);

  const columns: DataTableColumn<StudentResult>[] = [
    {
      key: 'roll_no',
      header: 'Roll No',
      sortable: true,
      className: 'font-mono text-xs font-semibold text-[#24243A] tabular-nums',
      render: (r) => r.roll_no,
    },
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <StudentAvatar name={r.name} size="sm" />
          <div>
            <p className="font-semibold text-[#24243A]">{r.name}</p>
            <p className="text-xs text-[#85859B]">
              {r.branch} · Sem {r.semester}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'total_obtained',
      header: 'Total Marks',
      align: 'right',
      sortable: true,
      className: 'font-mono tabular-nums text-[#24243A]',
      render: (r) => `${r.total_obtained} / ${r.total_maximum}`,
    },
    {
      key: 'percentage',
      header: 'Percentage',
      align: 'right',
      sortable: true,
      className: 'font-mono tabular-nums font-bold text-[#7357E8]',
      render: (r) => `${r.percentage.toFixed(2)}%`,
    },
    {
      key: 'grade',
      header: 'Grade',
      align: 'right',
      render: (r) => <StatusBadge label={r.grade} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <div>
          <StatusBadge label={r.status} />
          {r.failed_subjects.length > 0 && (
            <div className="text-[11px] text-[#C23E3E] mt-1">
              Failed: {r.failed_subjects.join(', ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'marksheet',
      header: 'Marksheet',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => openReport(r)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3 py-1.5 text-xs font-semibold text-[#24243A] hover:bg-[#EEE9FF] hover:text-[#7357E8] whitespace-nowrap transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Marksheet
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            Examination Results Ledger
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Automated totals, percentages, grades, and official EduNova report cards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select examination"
            value={selectedExamId}
            onChange={(e) => onSelectExam(Number(e.target.value))}
            className="rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
          >
            {examinations.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.exam_name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export Results CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="edunova-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Filter by student name, roll number, or branch..."
            ariaLabel="Filter results"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F7F7FC] border border-[#ECEBF3] rounded-xl">
          {(['ALL', 'PASS', 'FAIL'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === st
                  ? 'bg-white text-[#7357E8] shadow-sm'
                  : 'text-[#85859B] hover:text-[#24243A]'
              }`}
            >
              {st === 'ALL' ? 'All Results' : st}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(r) => r.student_id}
        sortKey={sortKey}
        sortDirection={sortDir}
        onSort={handleSort}
        emptyState={<span>No results match the current filter.</span>}
      />

      {/* EduNova Report Card Modal */}
      <Modal
        open={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent?.name || 'Marksheet'}
        subtitle={
          selectedStudent
            ? `Roll ${selectedStudent.roll_no} · ${selectedStudent.course} ${selectedStudent.branch} · Semester ${selectedStudent.semester}`
            : undefined
        }
        maxWidthClass="max-w-2xl"
        headerActions={
          selectedStudent && (
            <>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.downloadStudentResultCSV(
                      selectedStudent.student_id,
                      selectedStudent.roll_no,
                      selectedExamId
                    );
                    onNotify(`Exported individual CSV marksheet for ${selectedStudent.name}`);
                  } catch (err: any) {
                    onNotify(err?.message || 'Export failed', 'error');
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] px-3 py-1.5 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] px-3 py-1.5 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC]"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </>
          )
        }
      >
        {selectedStudent && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F7F7FC] border border-[#ECEBF3] p-4">
              <EduNovaLogo size="sm" />
              <div className="text-right">
                <p className="text-xs font-bold text-[#7357E8]">Official Academic Marksheet</p>
                <p className="text-[11px] text-[#85859B]">
                  {activeExam?.exam_name ?? 'Examination'} ({activeExam?.exam_date ?? ''})
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#ECEBF3] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F7FC] text-xs text-[#85859B] border-b border-[#ECEBF3]">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Code</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Subject</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Obtained</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Max</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEBF3]/70">
                  {selectedStudent.subject_breakdown.map((b) => (
                    <tr key={b.subject_code}>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#7357E8] font-semibold">
                        {b.subject_code}
                      </td>
                      <td className="px-4 py-2.5 text-[#24243A] font-medium">{b.subject_name}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                        {b.obtained_marks}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#85859B]">
                        {b.max_marks}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <StatusBadge label={b.passed ? 'PASS' : 'FAIL'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-[#F7F7FC] border border-[#ECEBF3] p-4 text-center">
              <div>
                <p className="text-[11px] text-[#85859B]">Grand Total</p>
                <p className="font-mono text-base font-bold text-[#24243A] tabular-nums mt-0.5">
                  {selectedStudent.total_obtained} / {selectedStudent.total_maximum}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#85859B]">Percentage</p>
                <p className="font-mono text-base font-bold text-[#7357E8] tabular-nums mt-0.5">
                  {selectedStudent.percentage.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#85859B]">Final Grade</p>
                <p className="font-mono text-base font-bold text-[#24243A] mt-0.5">
                  {selectedStudent.grade}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#85859B]">Overall Result</p>
                <div className="mt-1">
                  <StatusBadge label={selectedStudent.status} />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#ECEBF3]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#24243A]">AI Performance Evaluation</p>
                <button
                  type="button"
                  onClick={runEvaluation}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#7357E8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4935A8] disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading ? 'Generating...' : 'Generate AI Remarks'}
                </button>
              </div>
              {aiError && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#EF6262]/30 bg-[#FDECEC] p-3 text-xs text-[#C23E3E]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}
              {aiAnalysis && (
                <div className="mt-3 rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] p-4 text-xs text-[#24243A] space-y-2">
                  <p className="text-sm leading-relaxed">{aiAnalysis.summary}</p>
                  <p>
                    <span className="font-bold text-[#218758]">Strengths: </span>
                    {aiAnalysis.strengths.join('; ')}
                  </p>
                  <p>
                    <span className="font-bold text-[#B56E10]">Focus Areas: </span>
                    {aiAnalysis.focusAreas.join('; ')}
                  </p>
                  <p>
                    <span className="font-bold text-[#24243A]">Recommendation: </span>
                    {aiAnalysis.recommendedPlan}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
