import React from 'react';
import { GraduationCap } from 'lucide-react';

interface EduNovaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const EduNovaLogo: React.FC<EduNovaLogoProps> = ({
  size = 'md',
  showTagline = false,
}) => {
  const iconBoxClass =
    size === 'sm'
      ? 'w-8 h-8 rounded-xl'
      : size === 'lg'
      ? 'w-11 h-11 rounded-2xl'
      : 'w-9 h-9 rounded-xl';
  const iconClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  const titleClass =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <div
        className={`${iconBoxClass} bg-gradient-to-br from-[#7357E8] to-[#4935A8] flex items-center justify-center shadow-[0_6px_16px_rgba(115,87,232,0.28)] shrink-0`}
      >
        <GraduationCap className={`${iconClass} text-white`} />
      </div>
      <div className="leading-none">
        <span
          className={`font-display ${titleClass} font-bold tracking-tight text-[#24243A] whitespace-nowrap`}
        >
          Edu<span className="text-[#7357E8]">Nova</span>
        </span>
        {showTagline && (
          <p className="text-[11px] text-[#85859B] mt-0.5 whitespace-nowrap">
            Academic Management
          </p>
        )}
      </div>
    </div>
  );
};
