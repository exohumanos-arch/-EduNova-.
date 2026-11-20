import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

type StatTone = 'purple' | 'green' | 'orange' | 'blue' | 'red';

const TONE_ICON_STYLES: Record<StatTone, string> = {
  purple: 'bg-[#EEE9FF] text-[#7357E8]',
  green: 'bg-[#E9F9F1] text-[#39B980]',
  orange: 'bg-[#FFF4E4] text-[#F4A340]',
  blue: 'bg-[#EAF2FF] text-[#3B82F6]',
  red: 'bg-[#FDECEC] text-[#EF6262]',
};

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  delta?: string;
  deltaDirection?: 'up' | 'down' | 'neutral';
  valueClassName?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  tone = 'purple',
  delta,
  deltaDirection = 'up',
  valueClassName = 'text-[#24243A]',
}) => {
  return (
    <div className="edunova-card p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#85859B] truncate">{label}</p>
          <p
            className={`mt-2 font-display text-3xl font-bold tabular-nums tracking-tight ${valueClassName}`}
          >
            {value}
          </p>
        </div>

        {icon && (
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${TONE_ICON_STYLES[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtitle || delta) && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="text-[#85859B] truncate tabular-nums">{subtitle}</span>
          {delta && (
            <span
              className={`inline-flex items-center gap-1 font-semibold tabular-nums shrink-0 ${
                deltaDirection === 'down'
                  ? 'text-[#EF6262]'
                  : deltaDirection === 'up'
                  ? 'text-[#39B980]'
                  : 'text-[#85859B]'
              }`}
            >
              {deltaDirection === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {deltaDirection === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
