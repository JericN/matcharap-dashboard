"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

// A popover portaled to <body>, anchored below a trigger's bounding rect and
// clamped to the viewport (mirrors DrinkCard's openAdd popover). Backdrop click /
// right-click / Escape close. Used for add-column, options-editor, and the
// select-cell dropdowns. Only renders client-side after a rect is set (never SSR),
// so reading window here is safe.
export default function AnchoredPopover({ rect, onClose, children, width = 240 }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined" || !rect) return null;
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(margin, Math.min(rect.left, vw - width - margin));
  const top = Math.min(rect.bottom + 4, vh - margin);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[55]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        aria-hidden="true"
      />
      <div
        className="fixed z-[56] bg-cream-card border-2 border-forest rounded-[12px] shadow-hard-sm p-2 max-h-[300px] overflow-auto"
        style={{ top, left, width }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
