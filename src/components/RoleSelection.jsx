import React from 'react';
import { Check, GraduationCap, ShieldCheck } from 'lucide-react';

const ROLE_OPTIONS = [
  {
    id: /** @type {'admin'} */ ('admin'),
    title: 'Admin',
    subtitle: 'Complete system access.',
    icon: ShieldCheck,
  },
  {
    id: /** @type {'teacher'} */ ('teacher'),
    title: 'Teacher',
    subtitle: 'Academic management access.',
    icon: GraduationCap,
  },
];

/**
 * @param {{
 *   selectedRole: 'admin' | 'teacher' | null,
 *   onSelectRole: (role: 'admin' | 'teacher') => void,
 *   disabled?: boolean,
 * }} props
 */
export const RoleSelection = ({ selectedRole, onSelectRole, disabled = false }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" role="group" aria-label="Select your role">
      {ROLE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedRole === option.id;

        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onSelectRole(option.id)}
            className={`relative rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7357E8]/40 disabled:opacity-60 ${
              isSelected
                ? 'border-[#7357E8] bg-[#EEE9FF]/45 shadow-[0_6px_18px_rgba(115,87,232,0.12)]'
                : 'border-[#ECEBF3] bg-[#F7F7FC] hover:border-[#7357E8]/50 hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#7357E8] to-[#4935A8] text-white'
                    : 'bg-white border border-[#ECEBF3] text-[#7357E8]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {isSelected && (
                <span className="w-5 h-5 rounded-full bg-[#7357E8] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>

            <div className="mt-3.5">
              <p className="font-display text-base font-bold text-[#24243A]">{option.title}</p>
              <p className="text-xs text-[#85859B] mt-0.5 leading-snug">{option.subtitle}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
