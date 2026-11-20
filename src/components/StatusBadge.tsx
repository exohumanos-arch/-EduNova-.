import React from 'react';

type BadgeTone = 'success' | 'warning' | 'danger' | 'purple' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'text-[#218758] bg-[#E9F9F1]',
  warning: 'text-[#B56E10] bg-[#FFF4E4]',
  danger: 'text-[#C23E3E] bg-[#FDECEC]',
  purple: 'text-[#4935A8] bg-[#EEE9FF]',
  neutral: 'text-[#85859B] bg-[#F1F1F7]',
};

function inferTone(label: string): BadgeTone {
  const upper = label.toUpperCase();
  if (['PASS', 'ACTIVE', 'COMPLETED', 'A+', 'A'].includes(upper)) return 'success';
  if (['PENDING', 'SCHEDULED', 'B', 'C', 'D', 'WARNING'].includes(upper)) return 'warning';
  if (['FAIL', 'F', 'INACTIVE', 'AT RISK'].includes(upper)) return 'danger';
  if (['ADMIN', 'TEACHER'].includes(upper)) return 'purple';
  return 'neutral';
}

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone }) => {
  const resolved = tone ?? inferTone(label);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap ${TONE_CLASSES[resolved]}`}
    >
      {label}
    </span>
  );
};
