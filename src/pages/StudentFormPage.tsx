import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '../services/api';

interface StudentFormPageProps {
  onDataChanged: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const EMPTY_FORM = {
  name: '',
  roll_no: '',
  email: '',
  course: 'B.Tech',
  branch: 'CSE',
  semester: 3,
};

export const StudentFormPage: React.FC<StudentFormPageProps> = ({
  onDataChanged,
  onNotify,
}) => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) {
      setForm(EMPTY_FORM);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .getStudent(Number(id))
      .then((s) => {
        if (!active) return;
        setForm({
          name: s.name,
          roll_no: s.roll_no,
          email: s.email,
          course: s.course,
          branch: s.branch,
          semester: s.semester,
        });
      })
      .catch((err: any) => {
        onNotify(err?.message || 'Unable to load student record', 'error');
        navigate('/students');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && id) {
        await api.updateStudent(Number(id), form);
        onNotify(`Updated student ${form.name}`);
      } else {
        await api.createStudent(form);
        onNotify(`Added student ${form.name}`);
      }
      onDataChanged();
      navigate('/students');
    } catch (err: any) {
      onNotify(err?.message || 'Failed to save student record', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          to="/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#85859B] hover:text-[#7357E8] mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Student Directory
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
          {isEdit ? 'Edit Student Record' : 'Enroll New Student'}
        </h1>
        <p className="text-sm text-[#85859B] mt-0.5">
          {isEdit
            ? 'Modify academic details while preserving unique roll number constraints.'
            : 'Register a new student in the EduNova SQL directory.'}
        </p>
      </div>

      <div className="edunova-card p-6">
        {loading ? (
          <div className="py-10 text-center text-sm text-[#85859B]">
            Loading student details...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2.5 text-sm text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                  Roll Number
                </label>
                <input
                  type="text"
                  required
                  value={form.roll_no}
                  onChange={(e) => setForm({ ...form, roll_no: e.target.value })}
                  placeholder="e.g. 2026015"
                  className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2.5 text-sm font-mono text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                Institutional Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="student@edunova.edu"
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2.5 text-sm text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                  Course
                </label>
                <input
                  type="text"
                  required
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                  className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2.5 text-sm text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                  Branch
                </label>
                <select
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2.5 text-sm text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                >
                  <option value="CSE">CSE</option>
                  <option value="AIML">AIML</option>
                  <option value="ECE">ECE</option>
                  <option value="IT">IT</option>
                  <option value="ME">ME</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                  Semester
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
                  className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2.5 text-sm font-mono text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#ECEBF3] flex items-center justify-end gap-3">
              <Link
                to="/students"
                className="rounded-xl border border-[#ECEBF3] px-4 py-2 text-sm font-semibold text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4935A8] disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Student'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
