import React, { useState } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface ImportExportPageProps {
  currentUser: AuthUser;
  selectedExamId: number;
  onDataChanged: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

function downloadTemplate(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const ImportExportPage: React.FC<ImportExportPageProps> = ({
  currentUser,
  selectedExamId,
  onDataChanged,
  onNotify,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [marksFile, setMarksFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<'students' | 'marks' | null>(null);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<{
    kind: string;
    fileName: string;
    processed: number;
    totalValid: number;
    errors: string[];
    errorReportCsv?: string;
  } | null>(null);

  const handleUploadStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFile) return;
    setUploading('students');
    setProgress(35);
    setReport(null);
    try {
      const res = await api.importStudentsCSV(studentFile);
      setProgress(100);
      setReport({
        kind: 'Students CSV Import',
        fileName: studentFile.name,
        processed: res.inserted,
        totalValid: res.total_valid,
        errors: res.errors,
        errorReportCsv: res.error_report_csv,
      });
      onNotify(`Imported ${res.inserted} student record(s) via Python CSV DictReader`);
      onDataChanged();
      setStudentFile(null);
    } catch (err: any) {
      setProgress(0);
      onNotify(err?.message || 'Student import failed', 'error');
    } finally {
      setUploading(null);
    }
  };

  const handleUploadMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marksFile) return;
    setUploading('marks');
    setProgress(35);
    setReport(null);
    try {
      const res = await api.importMarksCSV(marksFile);
      setProgress(100);
      setReport({
        kind: 'Marks CSV Import',
        fileName: marksFile.name,
        processed: res.upserted,
        totalValid: res.total_valid,
        errors: res.errors,
        errorReportCsv: res.error_report_csv,
      });
      onNotify(`Processed ${res.upserted} marks record(s) via Python CSV DictReader`);
      onDataChanged();
      setMarksFile(null);
    } catch (err: any) {
      setProgress(0);
      onNotify(err?.message || 'Marks import failed', 'error');
    } finally {
      setUploading(null);
    }
  };

  const handleExport = async (type: 'students' | 'marks' | 'results') => {
    try {
      await api.downloadExportCSV(type, selectedExamId);
      onNotify(`Generated and downloaded ${type} CSV via Python DictWriter`);
    } catch (err: any) {
      onNotify(err?.message || 'CSV export failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#24243A]">
          CSV Import &amp; Export Center
        </h1>
        <p className="text-sm text-[#85859B] mt-0.5">
          Powered by Python&apos;s{' '}
          <code className="font-mono text-xs bg-[#EEE9FF] text-[#4935A8] px-1.5 py-0.5 rounded">
            csv.DictReader
          </code>{' '}
          and{' '}
          <code className="font-mono text-xs bg-[#EEE9FF] text-[#4935A8] px-1.5 py-0.5 rounded">
            csv.DictWriter
          </code>{' '}
          with row-level validation.
        </p>
      </div>

      {/* Import Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleUploadStudents} className="edunova-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#24243A]">
                Import Students CSV
              </h2>
              <p className="text-xs text-[#85859B] mt-0.5">
                Headers: <span className="font-mono">roll_no,name,course,branch,semester</span>{' '}
                (optional <span className="font-mono">email</span>)
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadTemplate(
                  'students_template.csv',
                  'roll_no,name,email,course,branch,semester\n2026011,Kavya Nair,kavya.nair@edunova.edu,B.Tech,CSE,3\n2026012,Siddharth Verma,siddharth.v@edunova.edu,B.Tech,AIML,3\n'
                )
              }
              className="text-xs font-semibold text-[#7357E8] hover:underline whitespace-nowrap"
            >
              Download Template
            </button>
          </div>

          <input
            type="file"
            accept=".csv"
            disabled={!isAdmin}
            onChange={(e) => setStudentFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-[#85859B] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-[#ECEBF3] file:text-xs file:font-semibold file:bg-[#F7F7FC] file:text-[#24243A] hover:file:bg-[#EEE9FF]"
          />

          {studentFile && (
            <div className="flex items-center gap-2 rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] px-3 py-2 text-xs text-[#24243A]">
              <FileCheck2 className="w-4 h-4 text-[#7357E8]" />
              <span className="font-medium truncate">{studentFile.name}</span>
              <span className="ml-auto font-mono text-[#85859B] tabular-nums">
                {(studentFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          {uploading === 'students' && (
            <div className="w-full h-2 rounded-full bg-[#EEE9FF] overflow-hidden">
              <div
                className="h-full bg-[#7357E8] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {!isAdmin && (
              <span className="text-xs text-[#B56E10]">Admin role required for student imports</span>
            )}
            <button
              type="submit"
              disabled={!isAdmin || !studentFile || uploading !== null}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] disabled:opacity-50 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading === 'students' ? 'Processing CSV...' : 'Import Students'}
            </button>
          </div>
        </form>

        <form onSubmit={handleUploadMarks} className="edunova-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#24243A]">
                Import Examination Marks CSV
              </h2>
              <p className="text-xs text-[#85859B] mt-0.5">
                Headers: <span className="font-mono">roll_no,subject_code,exam_name,marks</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadTemplate(
                  'marks_template.csv',
                  'roll_no,subject_code,exam_name,marks\n2026001,PY301,End-Semester Finals 2026,93\n2026002,PY301,End-Semester Finals 2026,97\n'
                )
              }
              className="text-xs font-semibold text-[#7357E8] hover:underline whitespace-nowrap"
            >
              Download Template
            </button>
          </div>

          <input
            type="file"
            accept=".csv"
            onChange={(e) => setMarksFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-[#85859B] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-[#ECEBF3] file:text-xs file:font-semibold file:bg-[#F7F7FC] file:text-[#24243A] hover:file:bg-[#EEE9FF]"
          />

          {marksFile && (
            <div className="flex items-center gap-2 rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] px-3 py-2 text-xs text-[#24243A]">
              <FileCheck2 className="w-4 h-4 text-[#7357E8]" />
              <span className="font-medium truncate">{marksFile.name}</span>
              <span className="ml-auto font-mono text-[#85859B] tabular-nums">
                {(marksFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          {uploading === 'marks' && (
            <div className="w-full h-2 rounded-full bg-[#EEE9FF] overflow-hidden">
              <div
                className="h-full bg-[#7357E8] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!marksFile || uploading !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-[#7357E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] disabled:opacity-50 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading === 'marks' ? 'Processing CSV...' : 'Import Marks'}
            </button>
          </div>
        </form>
      </div>

      {/* Validation & Error Report */}
      {report && (
        <div className="edunova-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#39B980]" />
              <div>
                <h3 className="font-display text-base font-bold text-[#24243A]">
                  {report.kind} Summary
                </h3>
                <p className="text-xs font-mono text-[#85859B]">File: {report.fileName}</p>
              </div>
            </div>
            <StatusBadge
              label={report.errors.length === 0 ? 'Completed' : 'Completed with Warnings'}
              tone={report.errors.length === 0 ? 'success' : 'warning'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-3.5">
              <p className="text-xs text-[#85859B]">Successful Records</p>
              <p className="font-mono text-xl font-bold text-[#218758] tabular-nums mt-0.5">
                {report.processed}
              </p>
            </div>
            <div className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-3.5">
              <p className="text-xs text-[#85859B]">Validated Rows</p>
              <p className="font-mono text-xl font-bold text-[#24243A] tabular-nums mt-0.5">
                {report.totalValid}
              </p>
            </div>
            <div className="rounded-xl bg-[#F7F7FC] border border-[#ECEBF3] p-3.5">
              <p className="text-xs text-[#85859B]">Failed / Skipped Rows</p>
              <p className="font-mono text-xl font-bold text-[#C23E3E] tabular-nums mt-0.5">
                {report.errors.length}
              </p>
            </div>
          </div>

          {report.errors.length > 0 && (
            <div className="rounded-xl border border-[#F4A340]/40 bg-[#FFF4E4] p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#B56E10]">
                  <AlertCircle className="w-4 h-4" />
                  Row Validation Warnings ({report.errors.length})
                </div>
                {report.errorReportCsv && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadTemplate(
                        `import_error_report_${Date.now()}.csv`,
                        report.errorReportCsv || ''
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#F4A340]/50 bg-white px-3 py-1.5 text-xs font-semibold text-[#B56E10] hover:bg-[#FFF4E4]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Error Report CSV
                  </button>
                )}
              </div>
              <ul className="list-disc pl-5 text-xs text-[#B56E10] space-y-1">
                {report.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Export Section */}
      <div className="edunova-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#EEE9FF] text-[#7357E8] flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-[#24243A]">
              Export Academic CSV Reports
            </h2>
            <p className="text-xs text-[#85859B]">
              Generated dynamically in Python and archived in{' '}
              <span className="font-mono">backend/exports/</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => handleExport('students')}
            className="flex items-center justify-between rounded-2xl border border-[#ECEBF3] bg-[#F7F7FC] px-4 py-3.5 text-left hover:border-[#7357E8] hover:bg-[#EEE9FF]/40 transition-colors"
          >
            <div>
              <p className="text-sm font-bold text-[#24243A]">Student Directory</p>
              <p className="text-xs text-[#85859B]">All enrolled student records</p>
            </div>
            <Download className="w-4 h-4 text-[#7357E8]" />
          </button>

          <button
            type="button"
            onClick={() => handleExport('marks')}
            className="flex items-center justify-between rounded-2xl border border-[#ECEBF3] bg-[#F7F7FC] px-4 py-3.5 text-left hover:border-[#7357E8] hover:bg-[#EEE9FF]/40 transition-colors"
          >
            <div>
              <p className="text-sm font-bold text-[#24243A]">Subject Marks Sheet</p>
              <p className="text-xs text-[#85859B]">Active exam raw marks</p>
            </div>
            <Download className="w-4 h-4 text-[#7357E8]" />
          </button>

          <button
            type="button"
            onClick={() => handleExport('results')}
            className="flex items-center justify-between rounded-2xl border border-[#ECEBF3] bg-[#F7F7FC] px-4 py-3.5 text-left hover:border-[#7357E8] hover:bg-[#EEE9FF]/40 transition-colors"
          >
            <div>
              <p className="text-sm font-bold text-[#24243A]">Final Results Report</p>
              <p className="text-xs text-[#85859B]">Totals, %, grades &amp; pass status</p>
            </div>
            <Download className="w-4 h-4 text-[#7357E8]" />
          </button>
        </div>
      </div>
    </div>
  );
};
