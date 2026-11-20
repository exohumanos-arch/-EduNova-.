import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, currentPage * pageSize);

  const pages: number[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
      pages.push(p);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-t border-[#ECEBF3] bg-white text-xs text-[#85859B]">
      <span className="tabular-nums">
        Showing <strong className="font-semibold text-[#24243A]">{startIdx}</strong>–
        <strong className="font-semibold text-[#24243A]">{endIdx}</strong> of{' '}
        <strong className="font-semibold text-[#24243A]">{totalItems}</strong>
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#ECEBF3] text-[#24243A] hover:bg-[#F7F7FC] disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 rounded-lg font-mono font-medium tabular-nums transition-colors ${
              p === currentPage
                ? 'bg-[#7357E8] text-white'
                : 'border border-[#ECEBF3] text-[#24243A] hover:bg-[#EEE9FF]'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#ECEBF3] text-[#24243A] hover:bg-[#F7F7FC] disabled:opacity-40"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
