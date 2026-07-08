"use client";

// ↶ Undo / ↷ Redo buttons for the expense planner toolbar. Disabled + dimmed
// when their stack is empty; the tooltip names the next action.
const base =
  "font-mono text-[.95rem] leading-none w-[34px] h-[32px] flex items-center justify-center rounded-pill border-2 transition-transform ";

function Btn({ enabled, title, label, onClick, glyph }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      title={title}
      aria-label={label}
      className={
        base +
        (enabled
          ? "border-forest text-forest bg-cream-light hover:-translate-y-0.5"
          : "border-brown-soft/25 text-brown-soft/35 cursor-not-allowed")
      }
    >
      {glyph}
    </button>
  );
}

export default function UndoControls({ canUndo, canRedo, undoLabel, redoLabel, onUndo, onRedo }) {
  return (
    <div className="flex items-center gap-[6px]">
      <Btn
        enabled={canUndo}
        onClick={onUndo}
        label="Undo"
        glyph="↶"
        title={canUndo ? `Undo ${undoLabel ?? ""}`.trim() : "Nothing to undo"}
      />
      <Btn
        enabled={canRedo}
        onClick={onRedo}
        label="Redo"
        glyph="↷"
        title={canRedo ? `Redo ${redoLabel ?? ""}`.trim() : "Nothing to redo"}
      />
    </div>
  );
}
