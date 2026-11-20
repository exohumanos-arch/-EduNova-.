import React, { useEffect, useState } from 'react';
import { Database, GraduationCap } from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser } from '../types';
import { StudentAvatar } from '../components/StudentAvatar';
import { StatusBadge } from '../components/StatusBadge';

interface SettingsPageProps {
  currentUser: AuthUser;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser }) => {
  const [dbHealth, setDbHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api
      .getAdminDbHealth()
      .then((res) => setDbHealth(res))
      .catch(() => setDbHealth(null));
  }, []);

  const counts = (dbHealth?.counts as Record<string, number> | undefined) ?? undefined;
  const constraints = (dbHealth?.unique_constraints as string[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
          System Settings &amp; Academic Configuration
        </h1>
        <p className="text-sm text-[#85859B] mt-0.5">
          Institutional grading scale, workspace overview, and live relational schema integrity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <div className="edunova-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#24243A]">
              <GraduationCap className="w-5 h-5 text-[#7357E8]" />
              <h2 className="font-display text-base font-bold">EduNova Workspace</h2>
            </div>

            <div className="flex items-center gap-3.5 pt-1 pb-2">
              <StudentAvatar name={currentUser.username} size="lg" />
              <div>
                <p className="font-display text-base font-bold text-[#24243A]">
                  EduNova Academic Portal
                </p>
                <p className="text-xs text-[#85859B]">
                  Direct open access enabled for all modules
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-2 border-t border-[#ECEBF3]">
                <span className="text-[#85859B]">Workspace Mode</span>
                <StatusBadge label="Open Access" tone="success" />
              </div>
            </div>
          </div>

          <div className="edunova-card p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#24243A]">
              <Database className="w-5 h-5 text-[#7357E8]" />
              <h2 className="font-display text-base font-bold">Relational Database Health</h2>
            </div>
            {!dbHealth ? (
              <p className="text-xs text-[#85859B]">Inspecting live SQL schema...</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[#ECEBF3]">
                  <span className="text-[#85859B]">Engine</span>
                  <span className="font-mono text-[#24243A] font-semibold">
                    {String(dbHealth.engine || 'SQL')}
                  </span>
                </div>
                {counts && (
                  <div className="grid grid-cols-5 gap-2 pt-1 text-center">
                    {Object.entries(counts).map(([tbl, cnt]) => (
                      <div
                        key={tbl}
                        className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-2"
                      >
                        <p className="text-[11px] text-[#85859B] capitalize">{tbl}</p>
                        <p className="font-mono font-bold text-[#24243A] tabular-nums mt-0.5">
                          {cnt}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {constraints.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[#85859B] mb-1">Active Constraints:</p>
                    <p className="font-mono text-[11px] text-[#24243A]">
                      {constraints.join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 edunova-card p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#24243A]">
              Configured Grade Scale (Python Tuple)
            </h2>
            <p className="text-xs text-[#85859B] mt-0.5">
              Immutable <code className="font-mono">GRADE_RANGES</code> tuple applied by{' '}
              <code className="font-mono">grade_calculator.py</code> across all examinations.
            </p>
          </div>
          <div className="rounded-xl border border-[#ECEBF3] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7FC] border-b border-[#ECEBF3] text-xs text-[#85859B]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Percentage Range</th>
                  <th className="text-left px-4 py-3 font-semibold">Grade</th>
                  <th className="text-left px-4 py-3 font-semibold">Descriptor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEBF3]/70 font-mono text-xs tabular-nums">
                <tr>
                  <td className="px-4 py-3">90% – 100%</td>
                  <td className="px-4 py-3">
                    <StatusBadge label="A+" />
                  </td>
                  <td className="px-4 py-3 font-sans text-[#85859B]">Outstanding</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">80% – 89.9%</td>
                  <td className="px-4 py-3">
                    <StatusBadge label="A" />
                  </td>
                  <td className="px-4 py-3 font-sans text-[#85859B]">Excellent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">70% – 79.9%</td>
                  <td className="px-4 py-3">
                    <StatusBadge label="B" />
                  </td>
                  <td className="px-4 py-3 font-sans text-[#85859B]">Very Good</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">60% – 69.9%</td>
                  <td className="px-4 py-3">
                    <StatusBadge label="C" />
                  </td>
                  <td className="px-4 py-3 font-sans text-[#85859B]">Good</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">50% – 59.9%</td>
                  <td className="px-4 py-3">
                    <StatusBadge label="D" />
                  </td>
                  <td className="px-4 py-3 font-sans text-[#85859B]">Pass</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Below 50% or Any Subject Fail</td>
                  <td className="px-4 py-3">
                    <StatusBadge label="F" />
                  </td>
                  <td className="px-4 py-3 font-sans text-[#C23E3E]">Needs Improvement</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
