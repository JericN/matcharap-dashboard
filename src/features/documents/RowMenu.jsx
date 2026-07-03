"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

// Cursor-anchored context menu portaled to <body> — mirrors DrinkCard/TabBar.
// `.paper-card`/cards clip fixed overlays, so this must portal out. A full-screen
// backdrop closes on click or right-click; Escape also closes.
export default function RowMenu({ pos, items, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
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
        className="fixed z-[56] min-w-[150px] bg-cream-card border-2 border-forest rounded-[10px] shadow-hard-sm p-1"
        style={{ top: pos.y, left: pos.x }}
      >
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={
              "block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] hover:bg-cream-light transition " +
              (it.danger ? "text-clay" : "text-forest")
            }
          >
            {it.label}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}
