import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser, Student, Subject } from '../types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { SearchBar } from '../components/SearchBar';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';

interface SubjectsPageProps {
  currentUser: AuthUser;
  onDataChanged: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const EMPTY_SUBJ = {
  subject_name: '',
  subject_code: '',
  max_marks: 100,
  passing_marks: 40,
  semester: 3,
};

export const SubjectsPage: React.FC<SubjectsPageProps> = ({
  currentUser,
  onDataChanged,
  onNotify,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState(EMPTY_SUBJ);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [subList, stList] = await Promise.all([api.getSubjects(), api.getStudents()]);
      setSubjects(subList);
      setStudents(stList);
    } catch (err: any) {
      onNotify(err?.message || 'Failed to load subjects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const semesterCounts = useMemo(() => {
    const map: Record<number, number> = {};
    for (const st of students) {
      map[st.semester] = (map[st.semester] ?? 0) + 1;
    }
    return map;
  }, [students]);

  const semesterOptions = useMemo(() => {
    const set = new Set<number>();
    subjects.forEach((s) => set.add(s.semester));
    return Array.from(set).sort((a, b) => a - b);
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
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
  }, [subjects, search, semesterFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_SUBJ);
    setModalOpen(true);
  };

  const openEdit = (sub: Subject) => {
    setEditing(sub);
    setForm({
      subject_name: sub.subject_name,
      subject_code: sub.subject_code,
      max_marks: sub.max_marks,
      passing_marks: sub.passing_marks,
      semester: sub.semester,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.updateSubject(editing.id, form);
        onNotify(`Updated subject ${form.subject_code}`);
      } else {
        await api.createSubject(form);
        onNotify(`Added subject ${form.subject_code}`);
      }
      setModalOpen(false);
      await load();
      onDataChanged();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to save subject', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sub: Subject) => {
    try {
      await api.deleteSubject(sub.id);
      onNotify(`Deleted subject ${sub.subject_code}`);
      await load();
      onDataChanged();
    } catch (err: any) {
      onNotify(err?.message || 'Delete failed', 'error');
    }
  };

  const columns: DataTableColumn<Subject>[] = [
    {
      key: 'subject_code',
      header: 'Subject Code',
      render: (sub) => <StatusBadge label={sub.subject_code} tone="purple" />,
    },
    {
      key: 'subject_name',
      header: 'Subject Name',
      className: 'font-semibold text-[#24243A]',
      render: (sub) => sub.subject_name,
    },
    {
      key: 'semester',
      header: 'Semester',
      align: 'right',
      className: 'font-mono tabular-nums text-[#24243A]',
      render: (sub) => `Sem ${sub.semester}`,
    },
    {
      key: 'max_marks',
      header: 'Maximum Marks',
      align: 'right',
      className: 'font-mono tabular-nums text-[#24243A]',
      render: (sub) => sub.max_marks,
    },
    {
      key: 'passing_marks',
      header: 'Passing Marks',
      align: 'right',
      className: 'font-mono tabular-nums text-[#85859B]',
      render: (sub) => sub.passing_marks,
    },
    {
      key: 'assigned_students',
      header: 'Assigned Students',
      align: 'right',
      className: 'font-mono tabular-nums text-[#24243A]',
      render: (sub) => `${semesterCounts[sub.semester] ?? 0}`,
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            render: (sub: Subject) => (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(sub)}
                  title="Edit subject"
                  className="p-1.5 rounded-lg text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(sub)}
                  title="Delete subject"
                  className="p-1.5 rounded-lg text-[#85859B] hover:text-[#EF6262] hover:bg-[#FDECEC]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            Subject Curriculum
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Configure course subjects, semester assignments, maximum marks, and passing rules.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>
        )}
      </div>

      {/* Search & Semester Filter */}
      <div className="edunova-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by subject name or code..."
            ariaLabel="Search subjects"
          />
        </div>

        <select
          aria-label="Filter subjects by semester"
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
        >
          <option value="ALL">All Semesters</option>
          {semesterOptions.map((sem) => (
            <option key={sem} value={String(sem)}>
              Semester {sem}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        data={filteredSubjects}
        columns={columns}
        rowKey={(sub) => sub.id}
        loading={loading}
        loadingText="Loading subjects..."
        emptyState={<span>No subjects match the current filter.</span>}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Update Subject' : 'Add Subject'}
        subtitle="Define subject code, semester, and mark boundaries"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#24243A] mb-1">
              Subject Name
            </label>
            <input
              type="text"
              required
              value={form.subject_name}
              onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
              className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#24243A] mb-1">
                Subject Code
              </label>
              <input
                type="text"
                required
                value={form.subject_code}
                onChange={(e) => setForm({ ...form, subject_code: e.target.value.toUpperCase() })}
                placeholder="CS305"
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#24243A] mb-1">Max Marks</label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={form.max_marks}
                onChange={(e) => setForm({ ...form, max_marks: Number(e.target.value) })}
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#24243A] mb-1">
                Passing Marks
              </label>
              <input
                type="number"
                min={0}
                max={form.max_marks}
                required
                value={form.passing_marks}
                onChange={(e) => setForm({ ...form, passing_marks: Number(e.target.value) })}
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
              {saving ? 'Saving...' : 'Save Subject'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
