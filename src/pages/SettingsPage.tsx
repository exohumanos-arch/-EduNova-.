import React, { useEffect, useState } from 'react';
import { Database, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import type { AccessCodeStatus, AuthUser } from '../types';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';

interface SettingsPageProps {
  currentUser: AuthUser;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onLogout?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  currentUser,
  onNotify,
  onLogout,
}) => {
  const [dbHealth, setDbHealth] = useState<Record<string, unknown> | null>(null);
  const [codeStatus, setCodeStatus] = useState<AccessCodeStatus | null>(null);
  const [teacherCode, setTeacherCode] = useState('');
  const [adminNewCode, setAdminNewCode] = useState('');
  const [currentAdminCode, setCurrentAdminCode] = useState('');
  const [savingRole, setSavingRole] = useState<'TEACHER' | 'ADMIN' | null>(null);

  const loadSettingsMeta = async () => {
    const [healthRes, statusRes] = await Promise.allSettled([
      api.getAdminDbHealth(),
      api.getAccessCodeStatus(),
    ]);
    if (healthRes.status === 'fulfilled') setDbHealth(healthRes.value);
    if (statusRes.status === 'fulfilled') setCodeStatus(statusRes.value);
  };

  useEffect(() => {
    loadSettingsMeta();
  }, []);

  const handleUpdateTeacherCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = teacherCode.trim();
    if (trimmed.length < 6) {
      onNotify('Teacher access code must be at least 6 characters', 'error');
      return;
    }
    setSavingRole('TEACHER');
    try {
      await api.updateAccessCode({ target_role: 'TEACHER', new_code: trimmed });
      setTeacherCode('');
      onNotify('Teacher access code updated successfully');
      await loadSettingsMeta();
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Failed to update Teacher access code'), 'error');
    } finally {
      setSavingRole(null);
    }
  };

  const handleUpdateAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNew = adminNewCode.trim();
    const trimmedCurrent = currentAdminCode.trim();
    if (!trimmedCurrent) {
      onNotify('Enter your current Admin access code to verify', 'error');
      return;
    }
    if (trimmedNew.length < 6) {
      onNotify('New Admin access code must be at least 6 characters', 'error');
      return;
    }
    setSavingRole('ADMIN');
    try {
      await api.updateAccessCode({
        target_role: 'ADMIN',
        new_code: trimmedNew,
        current_admin_code: trimmedCurrent,
      });
      setAdminNewCode('');
      setCurrentAdminCode('');
      onNotify('Admin access code updated successfully');
      await loadSettingsMeta();
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Failed to update Admin access code'), 'error');
    } finally {
      setSavingRole(null);
    }
  };

  const counts = (dbHealth?.counts as Record<string, number> | undefined) ?? undefined;
  const constraints = (dbHealth?.unique_constraints as string[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            System Settings &amp; Access Security
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Manage role access codes, inspect institutional grading rules, and verify relational schema health.
          </p>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-white px-3.5 py-2 text-xs font-semibold text-[#C23E3E] hover:bg-[#FDECEC] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout Session
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <div className="edunova-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#24243A]">
              <ShieldCheck className="w-5 h-5 text-[#7357E8]" />
              <h2 className="font-display text-base font-bold">Authenticated Session</h2>
            </div>

            <div className="flex items-center gap-3.5 pt-1 pb-2">
              <StudentAvatar name={currentUser.username} size="lg" />
              <div>
                <p className="font-display text-base font-bold text-[#24243A]">
                  {currentUser.username}
                </p>
                <p className="text-xs text-[#85859B]">
                  Signed HttpOnly session · Role: {currentUser.role}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-2 border-t border-[#ECEBF3]">
                <span className="text-[#85859B]">Admin Access Code</span>
                <StatusBadge
                  label={codeStatus?.admin_code_configured ? 'Configured' : 'Active'}
                  tone="success"
                />
              </div>
              <div className="flex justify-between items-center py-2 border-t border-[#ECEBF3]">
                <span className="text-[#85859B]">Teacher Access Code</span>
                <StatusBadge
                  label={codeStatus?.teacher_code_configured ? 'Configured' : 'Active'}
                  tone="success"
                />
              </div>
              {codeStatus && (
                <div className="flex justify-between items-center py-2 border-t border-[#ECEBF3]">
                  <span className="text-[#85859B]">Session TTL / Rate Limit</span>
                  <span className="font-mono font-semibold text-[#24243A]">
                    {codeStatus.session_ttl_hours}h · {codeStatus.rate_limit_max_attempts} attempts
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="edunova-card p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#24243A]">
              <Database className="w-5 h-5 text-[#7357E8]" />
              <h2 className="font-display text-base font-bold">Relational Database Health</h2>
            </div>
            {!dbHealth ? (
              <p className="text-xs text-[#85859B]">Inspecting live SQL schema...</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[#ECEBF3]">
                  <span className="text-[#85859B]">Engine</span>
                  <span className="font-mono text-[#24243A] font-semibold">
                    {String(dbHealth.engine || 'SQL')}
                  </span>
                </div>
                {counts && (
                  <div className="grid grid-cols-5 gap-2 pt-1 text-center">
                    {Object.entries(counts).map(([tbl, cnt]) => (
                      <div
                        key={tbl}
                        className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-2"
                      >
                        <p className="text-[11px] text-[#85859B] capitalize">{tbl}</p>
                        <p className="font-mono font-bold text-[#24243A] tabular-nums mt-0.5">
                          {cnt}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {constraints.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[#85859B] mb-1">Active Constraints:</p>
                    <p className="font-mono text-[11px] text-[#24243A]">
                      {constraints.join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="edunova-card p-6 space-y-5">
            <div className="flex items-center gap-2 text-[#24243A]">
              <KeyRound className="w-5 h-5 text-[#7357E8]" />
              <div>
                <h2 className="font-display text-base font-bold">
                  Manage Access Codes
                </h2>
                <p className="text-xs text-[#85859B]">
                  Codes are hashed server-side and never returned in plaintext to the browser.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateTeacherCode} className="space-y-3 pt-2 border-t border-[#ECEBF3]">
              <label className="block text-xs font-semibold text-[#24243A]">
                Update Teacher Access Code
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="password"
                  value={teacherCode}
                  onChange={(e) => setTeacherCode(e.target.value)}
                  placeholder="Enter new Teacher access code (min 6 chars)"
                  className="flex-1 rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-mono text-[#24243A] placeholder:font-sans focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
                />
                <button
                  type="submit"
                  disabled={savingRole === 'TEACHER'}
                  className="rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {savingRole === 'TEACHER' ? 'Updating...' : 'Save Teacher Code'}
                </button>
              </div>
            </form>

            <form onSubmit={handleUpdateAdminCode} className="space-y-3 pt-4 border-t border-[#ECEBF3]">
              <label className="block text-xs font-semibold text-[#24243A]">
                Rotate Admin Access Code
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="password"
                  value={currentAdminCode}
                  onChange={(e) => setCurrentAdminCode(e.target.value)}
                  placeholder="Current Admin code"
                  className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-mono text-[#24243A] placeholder:font-sans focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
                />
                <input
                  type="password"
                  value={adminNewCode}
                  onChange={(e) => setAdminNewCode(e.target.value)}
                  placeholder="New Admin code (min 6 chars)"
                  className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-xs font-mono text-[#24243A] placeholder:font-sans focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30"
                />
              </div>
              <button
                type="submit"
                disabled={savingRole === 'ADMIN'}
                className="rounded-xl border border-[#7357E8]/30 bg-[#EEE9FF] px-4 py-2 text-xs font-semibold text-[#4935A8] hover:bg-[#E2DAFF] transition-colors disabled:opacity-60"
              >
                {savingRole === 'ADMIN' ? 'Updating...' : 'Update Admin Code'}
              </button>
            </form>
          </div>

          <div className="edunova-card p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#24243A]">
                Configured Grade Scale (Python Tuple)
              </h2>
              <p className="text-xs text-[#85859B] mt-0.5">
                Immutable <code className="font-mono">GRADE_RANGES</code> tuple applied by{' '}
                <code className="font-mono">grade_calculator.py</code> across all examinations.
              </p>
            </div>
            <div className="rounded-xl border border-[#ECEBF3] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F7FC] border-b border-[#ECEBF3] text-xs text-[#85859B]">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Percentage Range</th>
                    <th className="text-left px-4 py-3 font-semibold">Grade</th>
                    <th className="text-left px-4 py-3 font-semibold">Descriptor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEBF3]/70 font-mono text-xs tabular-nums">
                  <tr>
                    <td className="px-4 py-3">90% – 100%</td>
                    <td className="px-4 py-3">
                      <StatusBadge label="A+" />
                    </td>
                    <td className="px-4 py-3 font-sans text-[#85859B]">Outstanding</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">80% – 89.9%</td>
                    <td className="px-4 py-3">
                      <StatusBadge label="A" />
                    </td>
                    <td className="px-4 py-3 font-sans text-[#85859B]">Excellent</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">70% – 79.9%</td>
                    <td className="px-4 py-3">
                      <StatusBadge label="B" />
                    </td>
                    <td className="px-4 py-3 font-sans text-[#85859B]">Very Good</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">60% – 69.9%</td>
                    <td className="px-4 py-3">
                      <StatusBadge label="C" />
                    </td>
                    <td className="px-4 py-3 font-sans text-[#85859B]">Good</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">50% – 59.9%</td>
                    <td className="px-4 py-3">
                      <StatusBadge label="D" />
                    </td>
                    <td className="px-4 py-3 font-sans text-[#85859B]">Pass</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Below 50% or Any Subject Fail</td>
                    <td className="px-4 py-3">
                      <StatusBadge label="F" />
                    </td>
                    <td className="px-4 py-3 font-sans text-[#C23E3E]">Needs Improvement</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
