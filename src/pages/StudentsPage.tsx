import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Users,
  UserCheck,
  Building2,
  Layers,
  Upload,
  Download,
} from 'lucide-react';
import { api } from '../services/api';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { StatCard } from '../components/StatCard';
import { SearchBar } from '../components/SearchBar';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import type { AuthUser, Student } from '../types';

interface StudentsPageProps {
  currentUser: AuthUser;
  onDataChanged: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const PAGE_SIZE = 8;

export const StudentsPage: React.FC<StudentsPageProps> = ({
  currentUser,
  onDataChanged,
  onNotify,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState<string>('roll_no');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params: { search?: string; branch?: string; semester?: string } = {
        search,
        branch: branchFilter,
      };
      if (semesterFilter !== 'ALL') {
        params.semester = semesterFilter;
      }
      const list = await api.getStudents(params);
      setStudents(list);
      setPage(1);
    } catch (err: any) {
      onNotify(err?.message || 'Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, branchFilter, semesterFilter]);

  const handleDelete = async (s: Student) => {
    try {
      await api.deleteStudent(s.id);
      onNotify(`Deleted student ${s.name}`);
      await fetchStudents();
      onDataChanged();
    } catch (err: any) {
      onNotify(err?.message || 'Delete failed', 'error');
    }
  };

  const handleExport = async () => {
    try {
      await api.downloadExportCSV('students');
      onNotify('Exported Student Directory CSV');
    } catch (err: any) {
      onNotify(err?.message || 'CSV export failed', 'error');
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedStudents = useMemo(() => {
    const copy = [...students];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'semester') cmp = a.semester - b.semester;
      else if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'course') cmp = a.branch.localeCompare(b.branch);
      else cmp = a.roll_no.localeCompare(b.roll_no);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [students, sortKey, sortDir]);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedStudents.slice(start, start + PAGE_SIZE);
  }, [sortedStudents, page]);

  const uniqueBranches = useMemo(
    () => new Set(students.map((s) => s.branch)).size,
    [students]
  );
  const uniqueSemesters = useMemo(
    () => new Set(students.map((s) => s.semester)).size,
    [students]
  );
  const semesterOptions = useMemo(() => {
    const set = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8]);
    students.forEach((s) => set.add(s.semester));
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  const columns: DataTableColumn<Student>[] = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      render: (s) => (
        <Link to={`/students/${s.id}`} className="flex items-center gap-3 group">
          <StudentAvatar name={s.name} size="sm" />
          <div>
            <p className="font-semibold text-[#24243A] group-hover:text-[#7357E8] transition-colors">
              {s.name}
            </p>
            <p className="text-xs text-[#85859B]">{s.email}</p>
          </div>
        </Link>
      ),
    },
    {
      key: 'roll_no',
      header: 'Roll Number',
      sortable: true,
      className: 'font-mono text-xs font-semibold text-[#24243A] tabular-nums',
      render: (s) => s.roll_no,
    },
    {
      key: 'course',
      header: 'Course / Branch',
      sortable: true,
      className: 'text-xs text-[#24243A]',
      render: (s) => `${s.course} · ${s.branch}`,
    },
    {
      key: 'semester',
      header: 'Semester',
      align: 'right',
      sortable: true,
      className: 'font-mono tabular-nums text-[#24243A]',
      render: (s) => `Sem ${s.semester}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: () => <StatusBadge label="Active" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <div className="inline-flex items-center gap-1.5">
          <Link
            to={`/students/${s.id}`}
            title="View academic profile"
            className="inline-flex items-center gap-1 rounded-lg border border-[#ECEBF3] bg-[#F7F7FC] px-2.5 py-1 text-xs font-semibold text-[#24243A] hover:bg-[#EEE9FF] hover:text-[#7357E8] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Profile
          </Link>
          {isAdmin && (
            <>
              <Link
                to={`/students/${s.id}/edit`}
                title="Edit student"
                className="p-1.5 rounded-lg text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC]"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(s)}
                title="Delete student"
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
            Student Directory
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Manage enrolled students, inspect academic profiles, and filter cohorts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <Link
            to="/import-export"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC] whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </Link>

          {isAdmin && (
            <Link
              to="/students/add"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] transition-colors whitespace-nowrap shadow-[0_4px_12px_rgba(115,87,232,0.22)]"
            >
              <Plus className="w-4 h-4" />
              Add Student
            </Link>
          )}
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Students"
          value={students.length}
          subtitle="Matching current filters"
          tone="purple"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Active Students"
          value={students.length}
          subtitle="Enrolled & active"
          tone="green"
          icon={<UserCheck className="w-5 h-5" />}
        />
        <StatCard
          label="Branches Represented"
          value={uniqueBranches}
          subtitle="Academic departments"
          tone="blue"
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          label="Semesters Covered"
          value={uniqueSemesters}
          subtitle="Active semester cohorts"
          tone="orange"
          icon={<Layers className="w-5 h-5" />}
        />
      </div>

      {/* Filter Bar */}
      <div className="edunova-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name, roll number, or email..."
            ariaLabel="Search students"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F7F7FC] border border-[#ECEBF3] rounded-xl">
            {['ALL', 'CSE', 'AIML', 'ECE'].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBranchFilter(b)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  branchFilter === b
                    ? 'bg-white text-[#7357E8] shadow-sm'
                    : 'text-[#85859B] hover:text-[#24243A]'
                }`}
              >
                {b === 'ALL' ? 'All Branches' : b}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by semester"
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3 py-2 text-xs font-semibold text-[#24243A] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
          >
            <option value="ALL">All Semesters</option>
            {semesterOptions.map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        data={paginatedStudents}
        columns={columns}
        rowKey={(s) => s.id}
        loading={loading}
        loadingText="Loading student records..."
        sortKey={sortKey}
        sortDirection={sortDir}
        onSort={handleSort}
        footer={
          <Pagination
            currentPage={page}
            totalItems={sortedStudents.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        }
        emptyState={
          <div className="space-y-3">
            <p className="text-sm text-[#85859B]">No students match the current filter.</p>
            {isAdmin && (
              <Link
                to="/students/add"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Student
              </Link>
            )}
          </div>
        }
      />
    </div>
  );
};
