"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Bottom-center toast with an Undo action; auto-dismisses. Portaled above menus
// (z-[60]). Shown after destructive ops so an accidental delete is one tap away.
export default function Toast({ message, onUndo, onClose, duration = 5000 }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Reset the auto-dismiss timer only when the message changes (not on every
  // parent re-render); always call the latest onClose via the ref.
  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-forest text-cream-light border-2 border-forest rounded-[12px] shadow-hard-sm px-4 py-2.5 font-mono text-[.72rem]"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          onUndo();
          onClose();
        }}
        className="font-bold uppercase tracking-wide underline underline-offset-2 hover:text-star"
      >
        Undo
      </button>
    </div>,
    document.body,
  );
}
