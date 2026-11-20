import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Save, Upload } from 'lucide-react';
import { api } from '../services/api';
import type { Examination, MarkRecord, Student, Subject } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { SearchBar } from '../components/SearchBar';

interface MarksPageProps {
  examinations: Examination[];
  selectedExamId: number;
  onSelectExam: (id: number) => void;
  onDataChanged: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

function previewGrade(pct: number, hasFailedSubject: boolean): string {
  if (hasFailedSubject || pct < 50) return 'F';
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  return 'D';
}

export const MarksPage: React.FC<MarksPageProps> = ({
  examinations,
  selectedExamId,
  onSelectExam,
  onDataChanged,
  onNotify,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number>(0);
  const [draftScores, setDraftScores] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    try {
      const [stList, subList, mkList] = await Promise.all([
        api.getStudents(),
        api.getSubjects(),
        api.getMarks(selectedExamId),
      ]);
      setStudents(stList);
      setSubjects(subList);
      setMarks(mkList);
      if (stList.length > 0 && (!selectedStudentId || !stList.some((s) => s.id === selectedStudentId))) {
        setSelectedStudentId(stList[0].id);
      }
    } catch (err: any) {
      onNotify(err?.message || 'Failed to load marks workspace', 'error');
    }
  };

  useEffect(() => {
    loadAll();
  }, [selectedExamId]);

  useEffect(() => {
    const map: Record<number, string> = {};
    for (const sub of subjects) {
      const found = marks.find(
        (m) => m.student_id === selectedStudentId && m.subject_id === sub.id
      );
      map[sub.id] = found ? String(found.obtained_marks) : '';
    }
    setDraftScores(map);
  }, [selectedStudentId, marks, subjects]);

  const filteredStudents = useMemo(() => {
    if (semesterFilter === 'ALL') return students;
    return students.filter((s) => String(s.semester) === semesterFilter);
  }, [students, semesterFilter]);

  useEffect(() => {
    if (
      filteredStudents.length > 0 &&
      !filteredStudents.some((s) => s.id === selectedStudentId)
    ) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedStudentId]);

  const visibleSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    return subjects.filter((sub) => {
      if (semesterFilter !== 'ALL' && String(sub.semester) !== semesterFilter) return false;
      if (q) {
        return (
          sub.subject_name.toLowerCase().includes(q) ||
          sub.subject_code.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [subjects, semesterFilter, subjectSearch]);

  const liveSummary = useMemo(() => {
    let obtained = 0;
    let maximum = 0;
    let failedCount = 0;
    let entered = 0;

    for (const sub of subjects) {
      const valStr = draftScores[sub.id];
      if (valStr !== undefined && valStr.trim() !== '') {
        const val = Number(valStr);
        if (!Number.isNaN(val)) {
          entered++;
          obtained += val;
          maximum += sub.max_marks;
          if (val < sub.passing_marks) failedCount++;
        }
      }
    }

    const pct = maximum > 0 ? (obtained / maximum) * 100 : 0;
    const grade = entered === 0 ? '—' : previewGrade(pct, failedCount > 0);
    const status = entered === 0 ? 'PENDING' : failedCount > 0 || pct < 50 ? 'FAIL' : 'PASS';
    return { obtained, maximum, pct, grade, status, failedCount, entered };
  }, [draftScores, subjects]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    // Validate before sending
    for (const sub of subjects) {
      const raw = draftScores[sub.id];
      if (raw !== undefined && raw.trim() !== '') {
        const num = Number(raw);
        if (Number.isNaN(num) || num < 0 || num > sub.max_marks) {
          onNotify(
            `Invalid marks for ${sub.subject_name}: must be between 0 and ${sub.max_marks}`,
            'error'
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      for (const sub of subjects) {
        const raw = draftScores[sub.id];
        if (raw !== undefined && raw.trim() !== '') {
          await api.saveMark({
            student_id: selectedStudentId,
            subject_id: sub.id,
            exam_id: selectedExamId,
            obtained_marks: Number(raw),
          });
        }
      }
      onNotify('Student marks saved and results recalculated');
      await loadAll();
      onDataChanged();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to save marks', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportMarks = async () => {
    try {
      await api.downloadExportCSV('marks', selectedExamId);
      onNotify('Exported Examination Marks CSV');
    } catch (err: any) {
      onNotify(err?.message || 'Marks export failed', 'error');
    }
  };

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const semesters = useMemo(() => {
    const set = new Set<number>();
    students.forEach((s) => set.add(s.semester));
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            Marks Management &amp; Entry
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Enter or update subject-wise examination scores with real-time grade and passing verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportMarks}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Marks CSV
          </button>

          <Link
            to="/import-export"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Bulk CSV Import
          </Link>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="edunova-card p-4 flex flex-wrap items-center gap-3">
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
          aria-label="Filter by semester"
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
        >
          <option value="ALL">All Semesters</option>
          {semesters.map((s) => (
            <option key={s} value={String(s)}>
              Semester {s}
            </option>
          ))}
        </select>

        <select
          aria-label="Select student"
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(Number(e.target.value))}
          className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
        >
          {filteredStudents.map((st) => (
            <option key={st.id} value={st.id}>
              {st.roll_no} — {st.name}
            </option>
          ))}
        </select>

        <div className="flex-1 min-w-[200px] max-w-xs ml-auto">
          <SearchBar
            value={subjectSearch}
            onChange={setSubjectSearch}
            placeholder="Filter subjects..."
            ariaLabel="Filter subjects"
          />
        </div>
      </div>

      {/* Live Preview Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="edunova-card p-5">
          <p className="text-xs font-medium text-[#85859B]">Selected Student</p>
          <p className="mt-1.5 font-display font-bold text-[#24243A] truncate">
            {selectedStudent?.name || '—'}
          </p>
          <p className="text-xs font-mono text-[#85859B] mt-0.5">
            {selectedStudent ? `${selectedStudent.roll_no} · ${selectedStudent.branch}` : ''}
          </p>
        </div>
        <div className="edunova-card p-5">
          <p className="text-xs font-medium text-[#85859B]">Calculated Total</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-[#24243A] tabular-nums">
            {liveSummary.obtained.toFixed(1)} / {liveSummary.maximum}
          </p>
        </div>
        <div className="edunova-card p-5">
          <p className="text-xs font-medium text-[#85859B]">Projected Percentage</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-[#7357E8] tabular-nums">
            {liveSummary.pct.toFixed(2)}%
          </p>
        </div>
        <div className="edunova-card p-5">
          <p className="text-xs font-medium text-[#85859B]">Projected Grade &amp; Status</p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="font-display text-2xl font-bold text-[#24243A]">
              {liveSummary.grade}
            </span>
            <StatusBadge label={liveSummary.status} />
          </div>
        </div>
      </div>

      {/* Marks Form Table */}
      <form noValidate onSubmit={handleSaveAll} className="edunova-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F7FC] border-b border-[#ECEBF3] text-xs text-[#85859B]">
              <tr>
                <th className="text-left font-semibold px-6 py-3.5">Subject Code</th>
                <th className="text-left font-semibold px-4 py-3.5">Subject Name</th>
                <th className="text-right font-semibold px-4 py-3.5">Passing / Max</th>
                <th className="text-right font-semibold px-4 py-3.5">Obtained Marks</th>
                <th className="text-right font-semibold px-6 py-3.5">Subject Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEBF3]/70">
              {visibleSubjects.map((sub) => {
                const rawVal = draftScores[sub.id] ?? '';
                const numVal = rawVal.trim() === '' ? null : Number(rawVal);
                const isValid =
                  numVal !== null &&
                  !Number.isNaN(numVal) &&
                  numVal >= 0 &&
                  numVal <= sub.max_marks;
                const isPassed = isValid && numVal! >= sub.passing_marks;
                return (
                  <tr key={sub.id} className="hover:bg-[#F7F7FC]">
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold text-[#7357E8]">
                      {sub.subject_code}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#24243A]">{sub.subject_name}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#85859B]">
                      {sub.passing_marks} / {sub.max_marks}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={sub.max_marks}
                        value={rawVal}
                        onChange={(e) =>
                          setDraftScores((prev) => ({ ...prev, [sub.id]: e.target.value }))
                        }
                        placeholder="0–100"
                        className="w-28 text-right rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3 py-1.5 font-mono text-sm tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                      />
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs font-semibold">
                      {numVal === null ? (
                        <StatusBadge label="Not Entered" tone="neutral" />
                      ) : !isValid ? (
                        <StatusBadge label="Out of Range" tone="danger" />
                      ) : isPassed ? (
                        <StatusBadge label="PASS" tone="success" />
                      ) : (
                        <StatusBadge label={`FAIL (Below ${sub.passing_marks})`} tone="danger" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-[#ECEBF3] bg-[#F7F7FC] flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-[#85859B]">
            Strict validation: overall PASS requires passing every entered subject and achieving at least 50%.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#4935A8] transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Marks...' : 'Save Student Marks'}
          </button>
        </div>
      </form>
    </div>
  );
};
