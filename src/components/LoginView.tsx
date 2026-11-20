import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  AlertCircle,
  BarChart3,
  Award,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api, setStoredToken } from '../services/api';
import type { AuthUser } from '../types';
import { EduNovaLogo } from './EduNovaLogo';

interface LoginViewProps {
  onSuccess: (user: AuthUser) => void;
}

const REMEMBER_EMAIL_KEY = 'edunova_remembered_email';

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
    title: 'Role-Based Access Control',
    desc: 'Signed JWT authentication for Administrators and Teachers.',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const savedEmail =
    typeof window !== 'undefined' ? localStorage.getItem(REMEMBER_EMAIL_KEY) : null;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(savedEmail || 'admin@acadledger.edu');
  const [password, setPassword] = useState('Admin@2026');
  const [rememberMe, setRememberMe] = useState(Boolean(savedEmail ?? true));
  const [role, setRole] = useState<'ADMIN' | 'TEACHER'>('TEACHER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(username, email, password, role);
      if (rememberMe && typeof window !== 'undefined') {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      setStoredToken(res.access_token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (presetEmail: string, presetPassword: string) => {
    setError(null);
    setEmail(presetEmail);
    setPassword(presetPassword);
    setLoading(true);
    try {
      const res = await api.login(presetEmail, presetPassword);
      if (rememberMe && typeof window !== 'undefined') {
        localStorage.setItem(REMEMBER_EMAIL_KEY, presetEmail);
      }
      setStoredToken(res.access_token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

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

          {/* Mini Workspace Preview Strip */}
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

      {/* Right Auth Card Column */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md edunova-card p-8">
          <div className="pb-5 mb-6 border-b border-[#ECEBF3]">
            <h2 className="font-display text-xl font-bold text-[#24243A]">
              {mode === 'login' ? 'Sign in to workspace' : 'Create faculty account'}
            </h2>
            <p className="text-xs text-[#85859B] mt-1">
              {mode === 'login'
                ? 'Access your EduNova marks ledger, grades, and reports.'
                : 'Register an administrator or teacher profile.'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 bg-[#F7F7FC] border border-[#ECEBF3] rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'login'
                  ? 'bg-white text-[#7357E8] shadow-sm'
                  : 'text-[#85859B] hover:text-[#24243A]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'register'
                  ? 'bg-white text-[#7357E8] shadow-sm'
                  : 'text-[#85859B] hover:text-[#24243A]'
              }`}
            >
              Register Account
            </button>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-[#EF6262]/30 bg-[#FDECEC] p-3 text-xs text-[#C23E3E]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#85859B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Prof. Rajesh Kulkarni"
                    className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] pl-10 pr-3.5 py-2.5 text-sm text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#85859B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@acadledger.edu"
                  className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] pl-10 pr-3.5 py-2.5 text-sm text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#85859B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] pl-10 pr-3.5 py-2.5 text-sm text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                />
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="inline-flex items-center gap-2 text-[#85859B] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[#ECEBF3] text-[#7357E8] focus:ring-[#7357E8]"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="font-semibold text-[#7357E8] hover:text-[#4935A8]"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#24243A] mb-1.5">
                  Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'TEACHER')}
                  className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3.5 py-2.5 text-sm text-[#24243A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8]"
                >
                  <option value="TEACHER">Teacher (Marks Entry &amp; Results)</option>
                  <option value="ADMIN">Administrator (Full CRUD &amp; Users)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#7357E8] to-[#4935A8] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition-opacity disabled:opacity-60 shadow-[0_6px_18px_rgba(115,87,232,0.28)]"
            >
              {loading
                ? 'Authenticating...'
                : mode === 'login'
                ? 'Sign In'
                : 'Create Account & Sign In'}
            </button>
          </form>

          {/* Instant Demo Credentials */}
          <div className="mt-7 pt-6 border-t border-[#ECEBF3]">
            <p className="text-xs font-semibold text-[#85859B] mb-3">Quick Demo Access</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => quickLogin('admin@acadledger.edu', 'Admin@2026')}
                className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3 py-2.5 text-left hover:border-[#7357E8] hover:bg-[#EEE9FF]/50 transition-colors"
              >
                <div className="text-xs font-semibold text-[#24243A]">Admin Account</div>
                <div className="text-[11px] text-[#85859B] font-mono truncate">
                  admin@acadledger.edu
                </div>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => quickLogin('teacher@acadledger.edu', 'Teacher@2026')}
                className="rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3 py-2.5 text-left hover:border-[#7357E8] hover:bg-[#EEE9FF]/50 transition-colors"
              >
                <div className="text-xs font-semibold text-[#24243A]">Teacher Account</div>
                <div className="text-[11px] text-[#85859B] font-mono truncate">
                  teacher@acadledger.edu
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Helper Modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#24243A]/40 p-4"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="w-full max-w-sm edunova-card p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#ECEBF3] pb-3">
              <h3 className="font-display text-base font-bold text-[#24243A]">
                Password Reset Help
              </h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="p-1 rounded-lg text-[#85859B] hover:text-[#24243A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#85859B] leading-relaxed">
              Faculty passwords are managed by your institution&apos;s EduNova Administrator under{' '}
              <span className="font-semibold text-[#24243A]">User Management</span>. For demo access,
              use either quick-login preset below:
            </p>
            <div className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-3 text-xs font-mono space-y-1">
              <p>Admin: admin@acadledger.edu / Admin@2026</p>
              <p>Teacher: teacher@acadledger.edu / Teacher@2026</p>
            </div>
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="w-full rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
