"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

// Cursor-anchored menu portaled to <body> — the grid's scroll container and the
// paper cards clip fixed overlays, so menus must portal out. A full-screen
// backdrop closes on click / right-click; Escape also closes. `children` are the
// menu rows (mirrors documents/RowMenu.jsx, but takes arbitrary content).
export default function CursorMenu({ pos, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  // Clamp to the viewport so a menu opened near the right/bottom edge stays on-screen.
  const MENU_W = 190;
  const MENU_H = 240;
  const left = Math.max(8, Math.min(pos.x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(pos.y, window.innerHeight - MENU_H - 8));
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
        className="fixed z-[56] min-w-[170px] bg-cream-card border-2 border-forest rounded-[10px] shadow-hard-sm p-1"
        style={{ top, left }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
