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



export function makePages(current: number, total: number, siblingCount = 2): (number | string)[] {
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

export default function PageNavigation({
  currentPage,
  totalPages,
  onPageChange,
  scrollToResultsTop,
  siblingCount = 2,
}: PaginationProps) {
  const pages = makePages(currentPage, totalPages, siblingCount);

  // helper so we don't repeat ourselves
const goToPage = (page: number) => {
  // 1) change the page first (causes render/reflow)
  onPageChange(page);

  // 2) after layout settles, do the scroll
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToResultsTop?.();
    });
  });
};


  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      {/* Prev */}
<Button
  variant="outline"
  className="hover:bg-gray-100 transition"
  onClick={() => goToPage(Math.max(1, currentPage - 1))}
  disabled={currentPage === 1}
  aria-label="Previous page"
>
  ‹
</Button>

{/* Page numbers */}
{pages.map((p, i) =>
  p === ELLIPSIS ? (
    <span key={`ellipsis-${i}`} style={{ padding: "0 0.5rem", userSelect: "none" }}>…</span>
  ) : (
    <Button
      key={p}
      variant="ghost"
      className="hover:bg-gray-100 transition"
      onClick={() => goToPage(p as number)}
      aria-current={p === currentPage ? "page" : undefined}
      style={{
        fontWeight: 600,
        fontSize: "1rem",
        color: p === currentPage ? "#003087" : "#1F2937",
        border: "none",
        borderBottom: p === currentPage ? "3px solid #003087" : "3px solid transparent",
        transition: "color 0.2s, border-bottom-color 0.2s, background-color 0.2s",
        cursor: "pointer",
        borderRadius: 0,
        paddingBottom: "2px",
      }}
      onMouseEnter={(e) => { if (p !== currentPage) e.currentTarget.style.color = "#003087"; }}
      onMouseLeave={(e) => { if (p !== currentPage) e.currentTarget.style.color = "#1F2937"; }}
    >
      {p}
    </Button>
  )
)}

{/* Next */}
<Button
  variant="outline"
  className="hover:bg-gray-100 transition"
  onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
  disabled={currentPage >= totalPages}
  aria-label="Next page"
>
  ›
</Button>

    </div>
  );
}
