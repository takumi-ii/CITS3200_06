import React from "react";
import { Button } from "./button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  scrollToResultsTop?: () => void;
  siblingCount?: number;
}

const ELLIPSIS = "…";

/**
 * Helper: Generate an array of page numbers and ellipses.
 */
export function makePages(
  current: number,
  total: number,
  siblingCount = 2
): (number | string)[] {
  if (total <= 1) return [1];

  const first = 1;
  const last = total;

  const start = Math.max(first + 1, current - siblingCount);
  const end = Math.min(last - 1, current + siblingCount);

  const pages: (number | string)[] = [first];

  if (start > first + 1) pages.push(ELLIPSIS);

  for (let p = start; p <= end; p++) pages.push(p);

  if (end < last - 1) pages.push(ELLIPSIS);

  pages.push(last);
  return pages;
}

/**
 * Pagination Component
 */
export default function PageNavigation({
  currentPage,
  totalPages,
  onPageChange,
  scrollToResultsTop,
  siblingCount = 2,
}: PaginationProps) {
  const pages = makePages(currentPage, totalPages, siblingCount);

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      {/* Previous button */}
      <Button
        variant="outline"
        onClick={() => {
          onPageChange(Math.max(1, currentPage - 1));
          scrollToResultsTop?.();
        }}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        ‹
      </Button>

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === ELLIPSIS ? (
          <span key={`ellipsis-${i}`} className="px-2 select-none">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? "default" : "ghost"}
            onClick={() => {
              onPageChange(p as number);
              scrollToResultsTop?.();
            }}
            aria-current={p === currentPage ? "page" : undefined}
            className={p === currentPage ? "font-bold" : undefined}
          >
            {p}
          </Button>
        )
      )}

      {/* Next button */}
      <Button
        variant="outline"
        onClick={() => {
          onPageChange(Math.min(totalPages, currentPage + 1));
          scrollToResultsTop?.();
        }}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        ›
      </Button>
    </div>
  );
}
