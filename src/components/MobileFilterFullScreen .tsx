import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

// MobileFilterFullScreen.tsx
type Filters = {
  yearRange: number[];
  tags: string[];
  researchArea: string;
};

type MobileFilterFullScreenProps = {
  open: boolean;
  title?: string;
  filters: Filters;
  setFilters: (filters: any) => void; // 👈 match FilterSidebar
  onClose: () => void;
  onApply?: () => void;
  onReset?: () => void;
  mountTo?: HTMLElement | null;
};


const researchTags = [
  "Climate Change",
  "Coral Reef Health",
  "Marine Biodiversity",
  "Ocean Acidification",
  "Deep Sea Exploration",
  "Fisheries Management",
  "Coastal Erosion",
  "Marine Pollution",
  "Ecosystem Restoration",
  "Sustainable Aquaculture",
  "Marine Protected Areas",
  "Ocean Circulation",
  "Marine Genetics",
  "Blue Carbon",
  "Microplastics",
];

const researchAreas = [
  "Marine Biology",
  "Oceanography",
  "Marine Chemistry",
  "Marine Geology",
  "Marine Physics",
  "Marine Ecology",
  "Conservation Science",
  "Fisheries Science",
  "Coastal Management",
  "Marine Policy",
];

export default function MobileFilterFullScreen({
  open,
  title = "Filters",
  filters,
  setFilters,
  onClose,
  onApply,
  onReset,
  mountTo,
}: MobileFilterFullScreenProps):React.ReactNode  {
  // focus trap + initial focus
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;

    // initial focus
    const first = el?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();

    // trap tab
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;

      const focusable = el?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const list = Array.from(focusable).filter(
        (n) => !n.hasAttribute("disabled")
      );
      const firstEl = list[0];
      const lastEl = list[list.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    el?.addEventListener("keydown", onKeyDown as any);
    return () => el?.removeEventListener("keydown", onKeyDown as any);
  }, [open, onClose]);

  // lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // portal target
  const target =
    mountTo ?? (typeof document !== "undefined" ? document.body : null);
  if (!target || !open) return null;

  // handlers reused from your sidebar
  const handleYearRangeChange = (value: number[]) => {
    setFilters({ ...filters, yearRange: value });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    setFilters({ ...filters, tags: newTags });
  };

  const handleResearchAreaChange = (area: string) => {
    const newArea = area === "all" ? "" : area;
    setFilters({ ...filters, researchArea: newArea });
  };

  // MobileFilterFullScreen.tsx (inside component)
const handleResetFilters =
  onReset ??
  (() => {
    setFilters({
      yearRange: [2000, 2024],
      researchArea: 'all', // 👈 match sidebar
      tags: [],
    });
  });


  const backdropClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 shadow-none border-none "
      onMouseDown={backdropClick}
      aria-hidden={false}
      role="presentation"
    >
<div
  ref={panelRef}
  role="dialog"
  aria-modal="true"
  aria-label={title}
  tabIndex={-1}                                // 👈 prevent default focus ring
  className="
    relative fixed inset-0 z-50 bg-white flex flex-col
    md:max-w-md md:mx-auto md:my-6 md:rounded-xl
    shadow-none border-none outline-none       // 👈 no border/shadow/outline
    focus:outline-none focus-visible:outline-none ring-0 focus:ring-0
    animate-in fade-in zoom-in-95 duration-150
  "
  style={{ WebkitTapHighlightColor: 'transparent' }}  // 👈 remove grey tap highlight on mobile
  onMouseDown={(e) => e.stopPropagation()}
>


  {/* 2) REMOVE the entire sticky header block */}

  {/* 3) NEW: top-right circular close button */}
  <button
    onClick={onClose}
    aria-label="Close filters"
    className="
      absolute top-3 right-3
      inline-flex h-9 w-9 items-center justify-center
      rounded-full
      bg-gray-200 text-gray-500
      hover:bg-gray-300 hover:text-gray-600
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
    "
  >
    {/* slightly darker grey “X” via currentColor */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>

  {/* 4) Add a bit of top padding to avoid overlap */}
  <div className="flex-1 overflow-y-auto px-4 pb-28 pt-6">
          <Card className="border-0 border-b border-gray-200 shadow-none">

            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-semibold text-black">
                Filter results
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 space-y-6">
              {/* Year Range */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Publication Year ({filters.yearRange[0]} - {filters.yearRange[1]})
                </Label>
                <Slider
                  value={filters.yearRange}
                  onValueChange={handleYearRangeChange}
                  max={2024}
                  min={2000}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>2000</span>
                  <span>2024</span>
                </div>
              </div>

              <Separator />

              {/* Research Area */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Research Area
                </Label>
                <Select
                  value={filters.researchArea || "all"}
                  onValueChange={handleResearchAreaChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select research area..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Areas</SelectItem>
                    {researchAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Research Tags */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Research Focus ({filters.tags.length} selected)
                </Label>

                <div className="grid grid-cols-1 gap-2">
                  {researchTags.map((tag) => (
                    <label
                      key={tag}
                      htmlFor={tag}
                      className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-50"
                    >
                      <Checkbox
                        id={tag}
                        checked={filters.tags.includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <span className="text-sm text-gray-700">{tag}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Selected Tags */}
              {filters.tags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Selected Filters
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {filters.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
                          onClick={() => handleTagToggle(tag)}
                        >
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom action bar */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3">
          <div className="mx-auto flex max-w-md gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-lg border bg-gray-50 text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onApply ?? onClose}
              className="flex-1 h-12 rounded-lg bg-gray-900 text-white font-semibold"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    target
  );
}
