import React from 'react';
import { GraduationCap, ShieldCheck } from 'lucide-react';

type LoginRole = 'admin' | 'teacher';

interface RoleSelectionProps {
  selectedRole: LoginRole | null;
  onSelectRole: (role: LoginRole) => void;
  disabled?: boolean;
}

const ROLE_OPTIONS: Array<{
  role: LoginRole;
  label: string;
  desc: string;
  icon: typeof ShieldCheck;
}> = [
  {
    role: 'admin',
    label: 'Admin',
    desc: 'Complete system access.',
    icon: ShieldCheck,
  },
  {
    role: 'teacher',
    label: 'Teacher',
    desc: 'Academic management access.',
    icon: GraduationCap,
  },
];

export const RoleSelection: React.FC<RoleSelectionProps> = ({
  selectedRole,
  onSelectRole,
  disabled = false,
}) => {
  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Select your role">
      {ROLE_OPTIONS.map(({ role, label, desc, icon: Icon }) => {
        const active = selectedRole === role;
        return (
          <button
            key={role}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onSelectRole(role)}
            className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-60 ${
              active
                ? 'border-[#7357E8] bg-[#EEE9FF] ring-2 ring-[#7357E8]/20'
                : 'border-[#ECEBF3] bg-white hover:border-[#7357E8]/50 hover:bg-[#F7F7FC]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${
                active ? 'bg-[#7357E8] text-white' : 'bg-[#F7F7FC] text-[#7357E8]'
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-sm font-bold text-[#24243A]">{label}</p>
            <p className="text-[11px] text-[#85859B] mt-0.5 leading-snug">{desc}</p>
          </button>
        );
      })}
    </div>
  );
};

export default RoleSelection;
