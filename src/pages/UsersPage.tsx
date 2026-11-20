import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser } from '../types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';

interface UsersPageProps {
  currentUser: AuthUser;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({ currentUser, onNotify }) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'TEACHER' as 'ADMIN' | 'TEACHER',
  });
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await api.getUsers());
    } catch (err: any) {
      onNotify(err?.message || 'Failed to load user accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createUser(form);
      onNotify(`Created ${form.role.toLowerCase()} account for ${form.username}`);
      setModalOpen(false);
      setForm({ username: '', email: '', password: '', role: 'TEACHER' });
      loadUsers();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to create user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: AuthUser) => {
    try {
      await api.deleteUser(u.id);
      onNotify(`Removed user ${u.username}`);
      loadUsers();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to remove user', 'error');
    }
  };

  const columns: DataTableColumn<AuthUser>[] = [
    {
      key: 'username',
      header: 'Faculty Member',
      render: (u) => (
        <div className="flex items-center gap-3">
          <StudentAvatar name={u.username} size="sm" />
          <div>
            <p className="font-semibold text-[#24243A]">
              {u.username}
              {u.id === currentUser.id && (
                <span className="ml-2 text-xs font-normal text-[#7357E8]">(Active Session)</span>
              )}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      className: 'font-mono text-xs text-[#85859B]',
      render: (u) => u.email,
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <StatusBadge label={u.role} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (u) =>
        u.id !== currentUser.id ? (
          <button
            type="button"
            onClick={() => handleDelete(u)}
            title="Delete account"
            className="p-1.5 rounded-lg text-[#85859B] hover:text-[#EF6262] hover:bg-[#FDECEC]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            User &amp; Role Management
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Create or remove Admin and Teacher credentials with bcrypt hashing and RBAC enforcement.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Faculty Account
        </button>
      </div>

      <DataTable
        data={users}
        columns={columns}
        rowKey={(u) => u.id}
        loading={loading}
        loadingText="Loading user accounts..."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Faculty Account"
        subtitle="Provision an EduNova Administrator or Teacher login"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#24243A] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#24243A] mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#24243A] mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#24243A] mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'TEACHER' })}
              className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
            >
              <option value="TEACHER">TEACHER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-[#ECEBF3]">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-[#ECEBF3] px-4 py-2 text-xs font-semibold text-[#85859B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8]"
            >
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
