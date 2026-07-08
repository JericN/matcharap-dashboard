"use client";
import { useEffect, useState } from "react";
import { NumberField } from "@/components/form";
import { numberFmt } from "../model.mjs";
import { formatNumber, parseNumber } from "../format";

// Number cell: a formatted right-aligned span (₱ / grouping / fixed decimals) that
// swaps to a bare numeric input on click. Commits on blur when changed; Escape
// reverts. An empty value commits as "" (⇒ the cell clears).
export default function NumberCell({ column, value, onCommit }) {
  const fmt = numberFmt(column);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  if (!editing) {
    const text = formatNumber(value, fmt);
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full min-h-[32px] text-right font-mono text-[.82rem] text-forest px-2 py-[7px] rounded-[8px] hover:bg-cream-light/60 transition-colors"
      >
        {text || <span className="text-brown-soft/45">—</span>}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    const parsed = parseNumber(draft);
    const cur = typeof value === "number" ? value : undefined;
    if (parsed !== cur) onCommit(parsed === undefined ? "" : parsed);
  };

  return (
    <NumberField
      variant="bare"
      autoFocus
      aria-label={column.name || "Number cell"}
      inputClassName="text-right"
      step={fmt.precision > 0 ? "0.01" : "1"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(value ?? "");
          setEditing(false);
        }
      }}
    />
  );
}
