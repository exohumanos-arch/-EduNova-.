import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
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
  const [refreshingSession, setRefreshingSession] = useState(false);

  const [teacherCode, setTeacherCode] = useState('');
  const [confirmTeacherCode, setConfirmTeacherCode] = useState('');
  const [showTeacherCode, setShowTeacherCode] = useState(false);
  const [savingTeacherCode, setSavingTeacherCode] = useState(false);

  const [currentAdminCode, setCurrentAdminCode] = useState('');
  const [newAdminCode, setNewAdminCode] = useState('');
  const [showAdminCodes, setShowAdminCodes] = useState(false);
  const [savingAdminCode, setSavingAdminCode] = useState(false);

  const loadSettingsData = () => {
    api
      .getAdminDbHealth()
      .then((res) => setDbHealth(res))
      .catch(() => setDbHealth(null));
    api
      .getAccessCodeStatus()
      .then((res) => setCodeStatus(res))
      .catch(() => setCodeStatus(null));
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleRenewSession = async () => {
    setRefreshingSession(true);
    try {
      await api.refresh();
      onNotify('Session extended successfully');
    } catch (err: any) {
      onNotify(err?.message || 'Failed to renew session', 'error');
    } finally {
      setRefreshingSession(false);
    }
  };

  const handleUpdateTeacherCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = teacherCode.trim();
    if (trimmed.length < 6) {
      onNotify('Teacher access code must be at least 6 characters', 'error');
      return;
    }
    if (trimmed !== confirmTeacherCode.trim()) {
      onNotify('Teacher access codes do not match', 'error');
      return;
    }
    setSavingTeacherCode(true);
    try {
      await api.updateAccessCode({ target_role: 'TEACHER', new_code: trimmed });
      setTeacherCode('');
      setConfirmTeacherCode('');
      onNotify('Teacher access code updated in backend configuration');
      loadSettingsData();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to update Teacher access code', 'error');
    } finally {
      setSavingTeacherCode(false);
    }
  };

  const handleUpdateAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cur = currentAdminCode.trim();
    const next = newAdminCode.trim();
    if (!cur) {
      onNotify('Current Admin access code is required', 'error');
      return;
    }
    if (next.length < 6) {
      onNotify('New Admin access code must be at least 6 characters', 'error');
      return;
    }
    setSavingAdminCode(true);
    try {
      await api.updateAccessCode({
        target_role: 'ADMIN',
        new_code: next,
        current_admin_code: cur,
      });
      setCurrentAdminCode('');
      setNewAdminCode('');
      onNotify('Admin access code rotated successfully');
      loadSettingsData();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to rotate Admin access code', 'error');
    } finally {
      setSavingAdminCode(false);
    }
  };

  const counts = (dbHealth?.counts as Record<string, number> | undefined) ?? undefined;
  const constraints = (dbHealth?.unique_constraints as string[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
          Admin Settings &amp; Access Control
        </h1>
        <p className="text-sm text-[#85859B] mt-0.5">
          Manage role access codes, active session policy, grading scale, and database integrity.
        </p>
      </div>

      {/* Access Code Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleUpdateTeacherCode} className="edunova-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EEE9FF] text-[#7357E8] flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#24243A]">
                  Teacher Access Code
                </h2>
                <p className="text-xs text-[#85859B]">
                  {codeStatus?.teacher_code_configured
                    ? `Configured · Updated ${codeStatus.teacher_code_updated_at ?? 'active'}`
                    : 'Managed securely on backend'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTeacherCode((s) => !s)}
              aria-label={showTeacherCode ? 'Hide teacher code inputs' : 'Show teacher code inputs'}
              className="inline-flex items-center gap-1 rounded-lg border border-[#ECEBF3] bg-[#F7F7FC] px-2.5 py-1 text-xs font-semibold text-[#85859B] hover:text-[#7357E8]"
            >
              {showTeacherCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showTeacherCode ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="new-teacher-code"
                className="block text-xs font-semibold text-[#24243A] mb-1.5"
              >
                New Teacher Code
              </label>
              <input
                id="new-teacher-code"
                type={showTeacherCode ? 'text' : 'password'}
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                minLength={6}
                autoComplete="off"
                placeholder="Min 6 characters"
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm font-mono text-[#24243A] placeholder:font-sans focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-teacher-code"
                className="block text-xs font-semibold text-[#24243A] mb-1.5"
              >
                Confirm Teacher Code
              </label>
              <input
                id="confirm-teacher-code"
                type={showTeacherCode ? 'text' : 'password'}
                value={confirmTeacherCode}
                onChange={(e) => setConfirmTeacherCode(e.target.value)}
                minLength={6}
                autoComplete="off"
                placeholder="Re-enter code"
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm font-mono text-[#24243A] placeholder:font-sans focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#218758] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Hashed with scrypt on server
            </span>
            <button
              type="submit"
              disabled={savingTeacherCode || !teacherCode.trim() || !confirmTeacherCode.trim()}
              className="rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] disabled:opacity-50 transition-colors"
            >
              {savingTeacherCode ? 'Updating...' : 'Update Teacher Code'}
            </button>
          </div>
        </form>

        <form onSubmit={handleUpdateAdminCode} className="edunova-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EEE9FF] text-[#7357E8] flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#24243A]">
                  Rotate Admin Access Code
                </h2>
                <p className="text-xs text-[#85859B]">
                  {codeStatus?.admin_code_configured
                    ? `Configured · Updated ${codeStatus.admin_code_updated_at ?? 'active'}`
                    : 'Requires current Admin verification'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdminCodes((s) => !s)}
              aria-label={showAdminCodes ? 'Hide admin code inputs' : 'Show admin code inputs'}
              className="inline-flex items-center gap-1 rounded-lg border border-[#ECEBF3] bg-[#F7F7FC] px-2.5 py-1 text-xs font-semibold text-[#85859B] hover:text-[#7357E8]"
            >
              {showAdminCodes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showAdminCodes ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="current-admin-code"
                className="block text-xs font-semibold text-[#24243A] mb-1.5"
              >
                Current Admin Code
              </label>
              <input
                id="current-admin-code"
                type={showAdminCodes ? 'text' : 'password'}
                value={currentAdminCode}
                onChange={(e) => setCurrentAdminCode(e.target.value)}
                autoComplete="off"
                placeholder="Verify current code"
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm font-mono text-[#24243A] placeholder:font-sans focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
              />
            </div>

            <div>
              <label
                htmlFor="new-admin-code"
                className="block text-xs font-semibold text-[#24243A] mb-1.5"
              >
                New Admin Code
              </label>
              <input
                id="new-admin-code"
                type={showAdminCodes ? 'text' : 'password'}
                value={newAdminCode}
                onChange={(e) => setNewAdminCode(e.target.value)}
                minLength={6}
                autoComplete="off"
                placeholder="Min 6 characters"
                className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2 text-sm font-mono text-[#24243A] placeholder:font-sans focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[#85859B]">
              {codeStatus
                ? `Lockout: ${codeStatus.rate_limit_max_attempts} attempts / ${codeStatus.rate_limit_window_seconds}s`
                : 'Rate-limited verification'}
            </span>
            <button
              type="submit"
              disabled={savingAdminCode || !currentAdminCode.trim() || !newAdminCode.trim()}
              className="rounded-xl border border-[#7357E8] bg-white px-4 py-2 text-xs font-semibold text-[#7357E8] hover:bg-[#EEE9FF] disabled:opacity-50 transition-colors"
            >
              {savingAdminCode ? 'Rotating...' : 'Rotate Admin Code'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <div className="edunova-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#24243A]">
                <ShieldCheck className="w-5 h-5 text-[#7357E8]" />
                <h2 className="font-display text-base font-bold">Active Session Profile</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRenewSession}
                  disabled={refreshingSession}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3 py-1.5 text-xs font-semibold text-[#24243A] hover:bg-[#EEE9FF] hover:text-[#7357E8] disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {refreshingSession ? 'Renewing...' : 'Renew Session'}
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#ECEBF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#C23E3E] hover:bg-[#FDECEC]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3.5 pt-1 pb-2">
              <StudentAvatar name={currentUser.username} size="lg" />
              <div>
                <p className="font-display text-base font-bold text-[#24243A]">
                  {currentUser.username}
                </p>
                <p className="text-xs text-[#85859B]">
                  Signed Session · {codeStatus ? `${codeStatus.session_ttl_hours}h TTL` : 'Active'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-2 border-t border-[#ECEBF3]">
                <span className="text-[#85859B]">Access Role</span>
                <StatusBadge label={currentUser.role} />
              </div>
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

        <div className="lg:col-span-7 edunova-card p-6 space-y-4">
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
  );
};
