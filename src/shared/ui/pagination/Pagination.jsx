'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ── Fully controlled — koi bhi internal state nahi ───────────────────────────
// Parent (OutStandingReportComp) filters.limit = single source of truth
// localStorage sirf preference save karta hai — Pagination ko pata nahi hona chahiye
const Pagination = ({
  currentPage,
  totalItems,
  itemsPerPage,            
  onPageChange,
  onItemsPerPageChange,   
  className = '',
}) => {

  const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100];
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // User ne rows-per-page change kiya → sirf parent ko batao
  const handlePerPageChange = (e) => {
    onItemsPerPageChange?.(parseInt(e.target.value, 10));
  };

  // Page numbers with ellipsis logic
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 10;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      let end   = start + maxVisible - 1;

      if (end > totalPages) {
        end   = totalPages;
        start = Math.max(1, end - maxVisible + 1);
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }

      for (let i = start; i <= end; i++) pages.push(i);

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // ── Per-page select — reused in mobile + desktop ──────────────────────────
  const PerPageSelect = () => (
    <div className="flex items-center gap-1.5">
      <label className="text-sm text-gray-500 whitespace-nowrap select-none">
        Rows per page:
      </label>
      <select
        value={itemsPerPage}          // controlled — prop se aata hai
        onChange={handlePerPageChange}
        className="text-sm text-gray-700 bg-white border border-gray-300 rounded-md
                   px-2 py-1.5 cursor-pointer hover:border-gray-400
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {PAGE_SIZE_OPTIONS.map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );

  // Agar sirf ek page hai aur total items bhi kam hai toh hide karo
  if (totalPages <= 1 && totalItems <= PAGE_SIZE_OPTIONS[0]) return null;

  return (
    <div className={`flex items-center justify-between ${className}`}>

      {/* ── Mobile ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 sm:hidden">

        <PerPageSelect />

        <div className="flex justify-between">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md
                       bg-white text-gray-700
                       disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md
                       bg-white text-gray-700
                       disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>

      </div>

      {/* ── Desktop ───────────────────────────────────────────────────────── */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between gap-4">

        {/* Left: result count + rows per page */}
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-700">
            Showing{' '}
            <span className="font-medium">
              {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}
            </span>
            {' '}to{' '}
            <span className="font-medium">
              {Math.min(currentPage * itemsPerPage, totalItems)}
            </span>
            {' '}of{' '}
            <span className="font-medium">{totalItems}</span>
            {' '}results
          </p>
          <PerPageSelect />
        </div>

        {/* Right: page buttons */}
        {totalPages > 1 && (
          <nav
            className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
            aria-label="Pagination"
          >
            {/* Prev */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md
                         border border-gray-300 bg-white text-sm font-medium
                         text-gray-500 hover:bg-gray-50
                         disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Page numbers */}
            {getPageNumbers().map((page, i) => (
              <button
                key={i}
                onClick={() => typeof page === 'number' && onPageChange(page)}
                disabled={page === '...'}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium
                  ${currentPage === page
                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }
                  ${page === '...' ? 'cursor-default' : 'cursor-pointer'}
                `}
              >
                {page}
              </button>
            ))}

            {/* Next */}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md
                         border border-gray-300 bg-white text-sm font-medium
                         text-gray-500 hover:bg-gray-50
                         disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-5 w-5" />
            </button>

          </nav>
        )}

      </div>

    </div>
  );
};

export default Pagination;