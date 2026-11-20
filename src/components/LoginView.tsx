import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser } from '../types';
import { getErrorMessage } from '../utils/errorMessage';
import { CodeLogin } from './CodeLogin';
import { EduNovaLogo } from './EduNovaLogo';
import { RoleSelection } from './RoleSelection';

interface LoginViewProps {
  onSuccess?: (user: AuthUser) => void;
  onLogin?: (role: 'admin' | 'teacher', accessCode: string) => Promise<AuthUser>;
  sessionExpiredMessage?: string | null;
}

const HIGHLIGHTS = [
  {
    icon: BarChart3,
    tone: 'bg-[#EEE9FF] text-[#7357E8]',
    title: 'Academic Performance Analytics',
    desc: 'Track cohort averages, subject benchmarks, and exam trends.',
  },
  {
    icon: Award,
    tone: 'bg-[#E9F9F1] text-[#39B980]',
    title: 'Automated Grades & Marksheets',
    desc: 'Python-computed totals, percentages, and instant transcripts.',
  },
  {
    icon: FileSpreadsheet,
    tone: 'bg-[#FFF4E4] text-[#F4A340]',
    title: 'Bulk CSV Import & Export',
    desc: 'Process student directories and exam marks with row validation.',
  },
  {
    icon: ShieldCheck,
    tone: 'bg-[#EAF2FF] text-[#3B82F6]',
    title: 'Role-Based Session Security',
    desc: 'Signed session authentication for Admin and Teacher portals.',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({
  onSuccess,
  onLogin,
  sessionExpiredMessage = null,
}) => {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'teacher' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const submitGuardRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const clearFeedback = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleSelectRole = (role: 'admin' | 'teacher') => {
    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    setSelectedRole(role);
    clearFeedback();
  };

  const handleCodeSubmit = async (accessCode: string) => {
    if (!selectedRole || submitGuardRef.current) return;
    const trimmed = accessCode.trim();
    const roleLabel = selectedRole === 'admin' ? 'Admin' : 'Teacher';

    if (!trimmed) {
      setSuccessMessage(null);
      setError(`Please enter your ${roleLabel} access code.`);
      return;
    }

    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    submitGuardRef.current = true;
    clearFeedback();
    setLoading(true);

    try {
      const authenticatedUser = onLogin
        ? await onLogin(selectedRole, trimmed)
        : (await api.codeLogin(selectedRole, trimmed)).user;

      setSuccessMessage('Login successful');
      setLoading(false);
      redirectTimerRef.current = window.setTimeout(() => {
        redirectTimerRef.current = null;
        submitGuardRef.current = false;
        onSuccess?.(authenticatedUser);
      }, 180);
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Invalid ${roleLabel} Access Code`));
      setLoading(false);
      submitGuardRef.current = false;
    }
  };

  const safeExpiredMessage = sessionExpiredMessage
    ? getErrorMessage(sessionExpiredMessage, 'Your session has expired. Please select your role to continue.')
    : null;

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#F7F7FC] text-[#24243A]">
      {/* Left EduNova Brand Showcase Column */}
      <div className="lg:col-span-6 bg-gradient-to-br from-white via-[#F7F7FC] to-[#EEE9FF] border-r border-[#ECEBF3] p-8 lg:p-14 flex flex-col justify-between">
        <EduNovaLogo size="lg" showTagline />

        <div className="my-10 max-w-lg space-y-6">
          <div className="space-y-3">
            <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-[#24243A]">
              Your Academic Journey,{' '}
              <span className="bg-gradient-to-r from-[#7357E8] to-[#4935A8] bg-clip-text text-transparent">
                Simplified.
              </span>
            </h1>
            <p className="text-sm text-[#85859B] leading-relaxed">
              Manage students, examinations, subject marks, automated grades, and cohort performance analytics inside one unified faculty workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="edunova-card p-4 flex items-start gap-3"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.tone}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#24243A]">{item.title}</p>
                    <p className="text-[11px] text-[#85859B] mt-0.5 leading-snug">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="edunova-card p-4 flex items-center justify-between gap-4 bg-white/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7357E8] to-[#4935A8] text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#24243A]">Real-Time Academic Engine</p>
                <p className="text-[11px] text-[#85859B]">
                  SQL relational storage · Python grade processor · Instant CSV reports
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center rounded-lg bg-[#E9F9F1] px-2.5 py-1 text-[11px] font-semibold text-[#218758] whitespace-nowrap">
              Ready
            </span>
          </div>
        </div>

        <p className="text-xs text-[#85859B]">
          EduNova · Student Marks &amp; Academic Performance Management
        </p>
      </div>

      {/* Right Access-Code Auth Card Column */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md edunova-card p-8">
          <div className="pb-5 mb-6 border-b border-[#ECEBF3]">
            <h2 className="font-display text-2xl font-bold text-[#24243A]">
              Welcome to EduNova
            </h2>
            <p className="text-xs text-[#85859B] mt-1">
              Select your role and enter your access code.
            </p>
          </div>

          {safeExpiredMessage && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2 rounded-xl border border-[#F4A340]/40 bg-[#FFF4E4] p-3 text-xs text-[#B56E10]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{safeExpiredMessage}</span>
            </div>
          )}

          <RoleSelection
            selectedRole={selectedRole}
            onSelectRole={handleSelectRole}
            disabled={loading}
          />

          {selectedRole ? (
            <CodeLogin
              role={selectedRole}
              onSubmit={handleCodeSubmit}
              loading={loading}
              error={error}
              successMessage={successMessage}
              onClearFeedback={clearFeedback}
            />
          ) : (
            <div className="mt-6 pt-5 border-t border-[#ECEBF3] text-center">
              <p className="text-xs text-[#85859B]">
                Choose <span className="font-semibold text-[#24243A]">Admin</span> or{' '}
                <span className="font-semibold text-[#24243A]">Teacher</span> above to enter your access code.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
