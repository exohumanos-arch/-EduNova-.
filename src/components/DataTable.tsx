import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  className?: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  loadingText?: string;
  emptyState?: React.ReactNode;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  footer?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  loadingText = 'Loading records...',
  emptyState,
  sortKey,
  sortDirection,
  onSort,
  footer,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="edunova-card p-6 space-y-3">
        {[1, 2, 3, 4].map((r) => (
          <div key={r} className="h-10 rounded-xl bg-[#F7F7FC]" />
        ))}
        <p className="text-center text-xs text-[#85859B] pt-1">{loadingText}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="edunova-card p-10 text-center text-sm text-[#85859B]">
        {emptyState ?? 'No records available.'}
      </div>
    );
  }

  return (
    <div className="edunova-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7FC] border-b border-[#ECEBF3] text-xs text-[#85859B]">
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    className={`font-semibold px-4 py-3.5 first:pl-6 last:pr-6 whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-[#24243A] transition-colors"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#7357E8]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#7357E8]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECEBF3]/70">
            {data.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-[#F7F7FC]/80 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 first:pl-6 last:pr-6 ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.className ?? ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
