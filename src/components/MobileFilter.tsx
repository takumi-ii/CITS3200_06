import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type MobileFilterProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onApply?: () => void;
  onReset?: () => void;
  /** Place your filter controls here */
  children: React.ReactNode;
  /** Optional: custom footer content. If provided, it replaces default buttons */
  footer?: React.ReactNode;
  /** Optional: portal mount node (defaults to document.body) */
  mountTo?: HTMLElement | null;
  /** Optional: id for the dialog element */
  id?: string;
};

export const MobileFilter: React.FC<MobileFilterProps> = ({
  open,
  title = "Filters",
  onClose,
  onApply,
  onReset,
  children,
  footer,
  mountTo,
  id = "mobile-filter",
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLButtonElement>(null);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Basic focus trap + initial focus
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    const focusable = el?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusable ? Array.from(focusable).filter(n => !n.hasAttribute("disabled")) : [];
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };

    el?.addEventListener("keydown", trap as any);
    return () => el?.removeEventListener("keydown", trap as any);
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Portal target
  const target = mountTo ?? (typeof document !== "undefined" ? document.body : null);
  if (!target) return null;
  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="mfs-overlay"
      onMouseDown={handleBackdropClick}
      aria-hidden={false}
      role="presentation"
    >
      <div
        id={id}
        ref={dialogRef}
        className="mfs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="mfs-header">
          <button
            ref={firstFocusRef}
            className="mfs-icon-btn"
            onClick={onClose}
            aria-label="Close filters"
          >
            ✕
          </button>
          <h2 className="mfs-title">{title}</h2>
          {onReset ? (
            <button className="mfs-text-btn" onClick={onReset}>
              Reset
            </button>
          ) : (
            <span className="mfs-header-spacer" />
          )}
        </header>

        <div className="mfs-content">{children}</div>

        <footer className="mfs-footer">
          {footer ?? (
            <>
              <button className="mfs-btn mfs-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                ref={lastFocusRef}
                className="mfs-btn mfs-btn-primary"
                onClick={onApply ?? onClose}
              >
                Apply
              </button>
            </>
          )}
        </footer>
      </div>

      {/* inline CSS for convenience; move to your stylesheet if you prefer */}
      <style>{`
        .mfs-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.5);
          display: flex; justify-content: center; align-items: flex-end;
          z-index: 60;
          animation: mfs-fade .15s ease-out;
        }
        .mfs-sheet {
          width: 100%;
          max-width: 480px;
          background: #fff;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          box-shadow: 0 -8px 24px rgba(0,0,0,.2);
          transform: translateY(8px);
          animation: mfs-slide-up .18s ease-out;
          display: grid;
          grid-template-rows: auto 1fr auto;
          max-height: 92vh;
        }
        .mfs-header {
          display: grid;
          grid-template-columns: 48px 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 12px 12px 8px;
          border-bottom: 1px solid rgba(0,0,0,.06);
        }
        .mfs-title { margin: 0; font-size: 18px; text-align: center; }
        .mfs-header-spacer { width: 48px; height: 32px; }
        .mfs-content {
          overflow: auto;
          padding: 12px 16px;
        }
        .mfs-footer {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 12px 16px 16px;
          border-top: 1px solid rgba(0,0,0,.06);
          position: sticky; bottom: 0; background: #fff;
        }
        .mfs-btn {
          height: 44px; border-radius: 10px; border: 1px solid transparent;
          font-size: 16px; cursor: pointer;
        }
        .mfs-btn-primary { background: #111827; color: #fff; }
        .mfs-btn-secondary { background: #f3f4f6; color: #111827; }
        .mfs-text-btn {
          background: transparent; border: none; color: #2563eb; cursor: pointer;
          padding: 8px 12px; font-size: 14px;
        }
        .mfs-icon-btn {
          width: 36px; height: 36px; border-radius: 10px; border: none;
          background: #f3f4f6; cursor: pointer; font-size: 18px;
        }
        @keyframes mfs-slide-up {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes mfs-fade {
          from { opacity: 0; } to { opacity: 1; }
        }
        @media (min-width: 640px) {
          .mfs-overlay { align-items: center; }
          .mfs-sheet { border-radius: 16px; max-height: 90vh; }
        }
      `}</style>
    </div>,
    target
  );
};
