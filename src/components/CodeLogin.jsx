import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../utils/errorMessage';

/**
 * @param {{
 *   role: 'admin' | 'teacher',
 *   onSubmit: (accessCode: string) => void | Promise<void>,
 *   loading?: boolean,
 *   error?: unknown,
 *   successMessage?: string | null,
 *   onClearFeedback?: () => void,
 * }} props
 */
export const CodeLogin = ({
  role,
  onSubmit,
  loading = false,
  error = null,
  successMessage = null,
  onClearFeedback,
}) => {
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [localError, setLocalError] = useState(/** @type {string | null} */ (null));
  /** @type {import('react').RefObject<HTMLInputElement | null>} */
  const inputRef = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    setAccessCode('');
    setShowCode(false);
    setLocalError(null);
    submittingRef.current = false;
    inputRef.current?.focus();
  }, [role]);

  useEffect(() => {
    if (!loading) {
      submittingRef.current = false;
    }
  }, [loading]);

  const roleLabel = role === 'admin' ? 'Admin' : 'Teacher';

  const resolvedError = localError
    ? localError
    : error
    ? getErrorMessage(error, 'Login failed. Please try again.')
    : null;

  const resolvedSuccess =
    typeof successMessage === 'string' && successMessage.trim() ? successMessage.trim() : null;

  /** @param {import('react').ChangeEvent<HTMLInputElement>} e */
  const handleCodeChange = (e) => {
    setAccessCode(e.target.value);
    if (localError) setLocalError(null);
    if (error || successMessage) onClearFeedback?.();
  };

  /** @param {import('react').FormEvent} e */
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (loading || submittingRef.current) return;

    const trimmed = accessCode.trim();
    if (!trimmed) {
      onClearFeedback?.();
      setLocalError(`Please enter your ${roleLabel} access code.`);
      inputRef.current?.focus();
      return;
    }

    setLocalError(null);
    onClearFeedback?.();
    submittingRef.current = true;
    try {
      await onSubmit(trimmed);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <form onSubmit={handleFormSubmit} noValidate className="mt-6 pt-6 border-t border-[#ECEBF3] space-y-4">
      {resolvedError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#EF6262]/30 bg-[#FDECEC] p-3 text-xs font-medium text-[#C23E3E]"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{resolvedError}</span>
        </div>
      )}

      {!resolvedError && resolvedSuccess && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-[#39B980]/35 bg-[#E9F9F1] p-3 text-xs font-medium text-[#218758]"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{resolvedSuccess}</span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="edunova-access-code"
            className="block text-xs font-semibold text-[#24243A]"
          >
            {roleLabel} Access Code
          </label>
          <span className="text-[11px] font-medium text-[#7357E8]">
            {roleLabel} Portal
          </span>
        </div>

        <div className="relative">
          <KeyRound className="w-4 h-4 text-[#85859B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            id="edunova-access-code"
            type={showCode ? 'text' : 'password'}
            autoComplete="off"
            disabled={loading}
            value={accessCode}
            onChange={handleCodeChange}
            placeholder={`Enter ${roleLabel.toLowerCase()} access code`}
            className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] pl-10 pr-20 py-2.5 text-sm font-mono text-[#24243A] placeholder:font-sans placeholder:text-[#85859B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7357E8]/30 focus:border-[#7357E8] disabled:opacity-60"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => setShowCode((prev) => !prev)}
            aria-label={showCode ? 'Hide access code' : 'Show access code'}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#85859B] hover:text-[#7357E8] hover:bg-[#EEE9FF]/60 transition-colors disabled:opacity-50"
          >
            {showCode ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Show</span>
              </>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7357E8] to-[#4935A8] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_6px_18px_rgba(115,87,232,0.28)]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying Code...</span>
          </>
        ) : (
          <>
            <span>Login</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
};
