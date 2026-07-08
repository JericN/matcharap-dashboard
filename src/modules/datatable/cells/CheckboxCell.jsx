"use client";

// Boolean checkbox cell. A ticked box stores `true`; unchecked is an EMPTY cell
// (absent key — coerceCell turns `false` into undefined). One click toggles, so
// there's no draft/focus dance like the text/number cells.
export default function CheckboxCell({ value, onCommit }) {
  const checked = value === true;
  return (
    <div className="w-full min-h-[32px] flex items-center justify-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label="Checkbox cell"
        onClick={() => onCommit(!checked)}
        className={
          "w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center text-[.7rem] leading-none transition-colors " +
          (checked ? "bg-forest border-forest text-cream-light" : "border-olive hover:border-forest")
        }
      >
        {checked ? "✓" : ""}
      </button>
    </div>
  );
}
