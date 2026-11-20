import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Calendar, Eye } from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser, DashboardPayload, Examination, Subject } from '../types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';

interface ExaminationsPageProps {
  currentUser: AuthUser;
  examinations: Examination[];
  selectedExamId: number;
  onSelectExam: (id: number) => void;
  onDataChanged: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

function inferExamType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('mid')) return 'Mid-Semester';
  if (lower.includes('final') || lower.includes('end')) return 'End-Semester';
  if (lower.includes('practical') || lower.includes('lab')) return 'Practical';
  return 'Unit Assessment';
}

function inferExamStatus(ex: Examination, selectedExamId: number): string {
  if (ex.id === selectedExamId) return 'Active';
  const today = new Date().toISOString().slice(0, 10);
  return ex.exam_date > today ? 'Scheduled' : 'Completed';
}

export const ExaminationsPage: React.FC<ExaminationsPageProps> = ({
  currentUser,
  examinations,
  selectedExamId,
  onSelectExam,
  onDataChanged,
  onNotify,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Examination | null>(null);
  const [form, setForm] = useState({ exam_name: '', semester: 3, exam_date: '2026-11-20' });
  const [saving, setSaving] = useState(false);

  const [detailExam, setDetailExam] = useState<Examination | null>(null);
  const [detailData, setDetailData] = useState<DashboardPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api
      .getSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ exam_name: '', semester: 3, exam_date: '2026-11-20' });
    setModalOpen(true);
  };

  const openEdit = (ex: Examination) => {
    setEditing(ex);
    setForm({ exam_name: ex.exam_name, semester: ex.semester, exam_date: ex.exam_date });
    setModalOpen(true);
  };

  const openDetails = async (ex: Examination) => {
    setDetailExam(ex);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const data = await api.getDashboard(ex.id);
      setDetailData(data);
    } catch (err: any) {
      onNotify(err?.message || 'Unable to load examination statistics', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.updateExamination(editing.id, form);
        onNotify(`Updated ${form.exam_name}`);
      } else {
        await api.createExamination(form);
        onNotify(`Created ${form.exam_name}`);
      }
      setModalOpen(false);
      onDataChanged();
    } catch (err: any) {
      onNotify(err?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ex: Examination) => {
    try {
      await api.deleteExamination(ex.id);
      onNotify(`Deleted examination ${ex.exam_name}`);
      onDataChanged();
    } catch (err: any) {
      onNotify(err?.message || 'Delete failed', 'error');
    }
  };

  const columns: DataTableColumn<Examination>[] = [
    {
      key: 'exam_name',
      header: 'Examination Title',
      className: 'font-semibold text-[#24243A]',
      render: (ex) => ex.exam_name,
    },
    {
      key: 'type',
      header: 'Type',
      render: (ex) => <StatusBadge label={inferExamType(ex.exam_name)} tone="purple" />,
    },
    {
      key: 'semester',
      header: 'Semester',
      align: 'right',
      className: 'font-mono tabular-nums text-[#24243A]',
      render: (ex) => `Sem ${ex.semester}`,
    },
    {
      key: 'subjects',
      header: 'Total Subjects',
      align: 'right',
      className: 'font-mono tabular-nums text-[#85859B]',
      render: (ex) =>
        subjects.filter((s) => s.semester === ex.semester).length || subjects.length,
    },
    {
      key: 'exam_date',
      header: 'Exam Date',
      className: 'font-mono text-xs text-[#85859B] tabular-nums',
      render: (ex) => (
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#7357E8]" />
          {ex.exam_date}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ex) => {
        const status = inferExamStatus(ex, selectedExamId);
        return (
          <div className="flex items-center gap-2">
            <StatusBadge label={status} />
            {ex.id !== selectedExamId && (
              <button
                type="button"
                onClick={() => onSelectExam(ex.id)}
                className="text-xs font-medium text-[#7357E8] hover:underline whitespace-nowrap"
              >
                Set Active
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (ex) => (
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openDetails(ex)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#ECEBF3] bg-[#F7F7FC] px-2.5 py-1 text-xs font-semibold text-[#24243A] hover:bg-[#EEE9FF] hover:text-[#7357E8] whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            Details
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => openEdit(ex)}
                title="Edit examination"
                className="p-1.5 rounded-lg text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC]"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(ex)}
                title="Delete examination"
                className="p-1.5 rounded-lg text-[#85859B] hover:text-[#EF6262] hover:bg-[#FDECEC]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            Examination Cycles
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Schedule academic assessments, inspect exam analytics, and toggle active cycles.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Examination
          </button>
        )}
      </div>

      <DataTable
        data={examinations}
        columns={columns}
        rowKey={(ex) => ex.id}
        emptyState={<span>No examinations scheduled yet.</span>}
      />

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Examination' : 'Create Examination'}
        subtitle="Configure assessment cycle title, semester, and examination date"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#24243A] mb-1">
              Examination Name
            </label>
            <input
              type="text"
              required
              value={form.exam_name}
              onChange={(e) => setForm({ ...form, exam_name: e.target.value })}
              placeholder="Unit Test II 2026"
              className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#24243A] mb-1">Semester</label>
              <input
                type="number"
                min={1}
                max={12}
                required
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#24243A] mb-1">Date</label>
              <input
                type="date"
                required
                value={form.exam_date}
                onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-[#ECEBF3]">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-[#ECEBF3] px-4 py-2 text-xs font-semibold text-[#85859B] hover:text-[#24243A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Examination'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Examination Details Modal */}
      <Modal
        open={Boolean(detailExam)}
        onClose={() => setDetailExam(null)}
        title={detailExam?.exam_name || 'Examination Details'}
        subtitle={
          detailExam
            ? `${inferExamType(detailExam.exam_name)} · Semester ${detailExam.semester} · ${detailExam.exam_date}`
            : undefined
        }
        maxWidthClass="max-w-xl"
      >
        {detailLoading ? (
          <div className="py-8 text-center text-xs text-[#85859B]">
            Loading examination cohort metrics...
          </div>
        ) : detailData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-3">
                <p className="text-[11px] text-[#85859B]">Evaluated</p>
                <p className="font-mono text-lg font-bold text-[#24243A] tabular-nums mt-0.5">
                  {detailData.summary.evaluated_count}
                </p>
              </div>
              <div className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-3">
                <p className="text-[11px] text-[#85859B]">Class Average</p>
                <p className="font-mono text-lg font-bold text-[#7357E8] tabular-nums mt-0.5">
                  {detailData.kpis.average_percentage.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-3">
                <p className="text-[11px] text-[#85859B]">Pass Rate</p>
                <p className="font-mono text-lg font-bold text-[#218758] tabular-nums mt-0.5">
                  {detailData.kpis.pass_rate.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#ECEBF3] overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#F7F7FC] border-b border-[#ECEBF3] text-[#85859B]">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Subject</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Avg Marks</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Pass Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEBF3]/70">
                  {detailData.subject_stats.map((s) => (
                    <tr key={s.subject_id}>
                      <td className="px-4 py-2.5 font-medium text-[#24243A]">
                        <span className="font-mono text-[#7357E8] mr-2">{s.subject_code}</span>
                        {s.subject_name}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {s.average_marks.toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-[#218758]">
                        {s.pass_rate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#85859B]">No metrics recorded for this examination yet.</p>
        )}
      </Modal>
    </div>
  );
};
