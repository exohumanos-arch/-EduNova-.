import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Award, BookOpen, X } from 'lucide-react';
import type { DashboardPayload } from '../types';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  dashboard: DashboardPayload | null;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  open,
  onClose,
  dashboard,
}) => {
  if (!open) return null;

  const lowPerformers = dashboard?.summary.low_performers ?? [];
  const topStudent = dashboard?.summary.top_students?.[0];

  return (
    <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-[20px] bg-white border border-[#ECEBF3] shadow-[0_12px_36px_rgba(36,36,58,0.12)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#ECEBF3] flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-[#24243A]">
            Academic Alerts
          </h3>
          <p className="text-[11px] text-[#85859B]">
            Live examination &amp; performance notices
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications"
          className="p-1 rounded-lg text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-[#ECEBF3]/70">
        {lowPerformers.map((st) => (
          <Link
            key={st.student_id}
            to={`/students/${st.student_id}`}
            onClick={onClose}
            className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#F7F7FC] transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-[#FDECEC] text-[#EF6262] flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#24243A] truncate">
                {st.name} ({st.roll_no})
              </p>
              <p className="text-xs text-[#85859B] mt-0.5">
                {st.failed_subjects.length > 0
                  ? `Failed in ${st.failed_subjects.join(', ')} · ${st.percentage.toFixed(1)}%`
                  : `Below threshold at ${st.percentage.toFixed(1)}%`}
              </p>
            </div>
          </Link>
        ))}

        {topStudent && (
          <Link
            to={`/students/${topStudent.student_id}`}
            onClick={onClose}
            className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#F7F7FC] transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-[#E9F9F1] text-[#39B980] flex items-center justify-center shrink-0 mt-0.5">
              <Award className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#24243A] truncate">
                Cohort Leader: {topStudent.name}
              </p>
              <p className="text-xs text-[#85859B] mt-0.5">
                Scored {topStudent.percentage.toFixed(2)}% ({topStudent.grade}) in active exam
              </p>
            </div>
          </Link>
        )}

        {dashboard && (
          <Link
            to="/marks"
            onClick={onClose}
            className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#F7F7FC] transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-[#EEE9FF] text-[#7357E8] flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#24243A]">
                Exam Cycle Summary Ready
              </p>
              <p className="text-xs text-[#85859B] mt-0.5 tabular-nums">
                {dashboard.summary.evaluated_count} students evaluated ·{' '}
                {dashboard.kpis.pass_rate.toFixed(1)}% pass rate
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
};
