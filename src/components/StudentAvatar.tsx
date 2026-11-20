import React from 'react';

const AVATAR_TONES = [
  'bg-[#EEE9FF] text-[#4935A8]',
  'bg-[#E8F8F1] text-[#1D7F53]',
  'bg-[#FFF4E5] text-[#B36B11]',
  'bg-[#EAF2FF] text-[#2C5FB8]',
  'bg-[#FDECEC] text-[#B83B3B]',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getToneIndex(seed: string): number {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) {
    sum += seed.charCodeAt(i);
  }
  return sum % AVATAR_TONES.length;
}

interface StudentAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({ name, size = 'md' }) => {
  const tone = AVATAR_TONES[getToneIndex(name || 'Student')];
  const sizeClass =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-14 h-14 text-lg'
      : 'w-9 h-9 text-xs';

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} ${tone} rounded-full font-display font-semibold flex items-center justify-center shrink-0 ring-2 ring-white`}
    >
      {getInitials(name)}
    </div>
  );
};
