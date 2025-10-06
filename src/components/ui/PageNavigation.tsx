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
    <span key={`ellipsis-${i}`} style={{ padding: "0 0.5rem", userSelect: "none" }}>
      …
    </span>
  ) : (
    <Button
      key={p}
      variant="ghost"
      onClick={() => {
        onPageChange(p as number);
        scrollToResultsTop?.();
      }}
      aria-current={p === currentPage ? "page" : undefined}
      style={{
        fontWeight: 600,
        fontSize: "1rem",
        color: p === currentPage ? "#1D4ED8" : "#1F2937", // orange for active, dark gray for others
        border: "none",
        borderBottom: p === currentPage ? "3px solid #1D4ED8" : "3px solid transparent",
        background: "none",
        transition: "color 0.2s ease, border-bottom-color 0.2s ease",
        cursor: "pointer",
        borderRadius: 0, // keeps the underline flat (no rounded edge)
        paddingBottom: "2px",
      }}
      onMouseEnter={(e) => {
        if (p !== currentPage) e.currentTarget.style.color = "#1D4ED8";
      }}
      onMouseLeave={(e) => {
        if (p !== currentPage) e.currentTarget.style.color = "#1F2937";
      }}
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
