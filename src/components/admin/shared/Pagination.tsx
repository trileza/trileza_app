import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onNext: () => void;
  onPrev: () => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onNext,
  onPrev,
}) => {
  if (totalPages <= 1) return null;

  // Generate visible page numbers (show max 5 around current)
  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/60">
      {/* Items count */}
      <span className="text-xs font-bold text-slate-500">
        Showing <span className="text-slate-800 font-extrabold">{startIndex}–{endIndex}</span> of <span className="text-slate-800 font-extrabold">{totalItems}</span> items
      </span>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          title="Previous page"
        >
          <ChevronLeft size={14} className="text-slate-600" />
        </button>

        {getVisiblePages().map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-2 text-slate-400 text-xs font-bold select-none">…</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[32px] h-8 rounded-lg text-xs font-extrabold transition-all active:scale-95 ${
                currentPage === page
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          title="Next page"
        >
          <ChevronRight size={14} className="text-slate-600" />
        </button>
      </div>
    </div>
  );
};

export default React.memo(Pagination);
