import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export const PythonInspectorPage: React.FC = () => {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setPayload(await api.inspectPythonStructures());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
            Python Data Structures Runtime Inspector
          </h1>
          <p className="text-sm text-[#85859B] mt-0.5">
            Live output executed by{' '}
            <code className="font-mono text-xs bg-[#EEE9FF] text-[#4935A8] px-1.5 py-0.5 rounded">
              python_data_structures.py
            </code>{' '}
            directly against live database records.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#ECEBF3] bg-white px-4 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#F7F7FC]"
        >
          <RefreshCw className={`w-4 h-4 text-[#7357E8] ${loading ? 'animate-spin' : ''}`} />
          Re-evaluate Python Script
        </button>
      </div>

      {payload && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="edunova-card p-5 space-y-3">
            <h2 className="font-display text-sm font-bold text-[#24243A]">
              1. Tuples (Immutable Grade Ranges &amp; Branches)
            </h2>
            <p className="text-xs text-[#85859B]">
              <code className="font-mono">GRADE_RANGES</code> &amp;{' '}
              <code className="font-mono">ACADEMIC_BRANCHES</code> stored as Python tuples.
            </p>
            <pre className="rounded-xl bg-[#24243A] text-slate-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
              {JSON.stringify(
                {
                  grade_ranges_tuple: payload.grade_ranges_tuple,
                  academic_branches_tuple: payload.academic_branches_tuple,
                },
                null,
                2
              )}
            </pre>
          </div>

          <div className="edunova-card p-5 space-y-3">
            <h2 className="font-display text-sm font-bold text-[#24243A]">
              2. Lists (Cohort Marks Matrix)
            </h2>
            <p className="text-xs text-[#85859B]">
              Python lists aggregating subject marks per student for{' '}
              <code className="font-mono">sum()</code>, <code className="font-mono">max()</code>,{' '}
              <code className="font-mono">min()</code>.
            </p>
            <pre className="rounded-xl bg-[#24243A] text-slate-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed max-h-96">
              {JSON.stringify(payload.all_marks_matrix_list, null, 2)}
            </pre>
          </div>

          <div className="edunova-card p-5 space-y-3">
            <h2 className="font-display text-sm font-bold text-[#24243A]">
              3. Dictionaries (Student Record Object)
            </h2>
            <p className="text-xs text-[#85859B]">
              Structured student dictionary mapping subject names to marks &amp; breakdown lists.
            </p>
            <pre className="rounded-xl bg-[#24243A] text-slate-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed max-h-96">
              {JSON.stringify(payload.sample_student_dict, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
