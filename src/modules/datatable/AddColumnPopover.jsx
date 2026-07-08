"use client";
import { useState } from "react";
import AnchoredPopover from "./AnchoredPopover";

const TYPES = [
  { type: "text", label: "Text", icon: "📝" },
  { type: "number", label: "Number", icon: "#" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "select", label: "Single select", icon: "◉" },
  { type: "multiSelect", label: "Multi-select", icon: "🏷" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
];

// Anchored popover to add a column: a name field + a type picker. Picking a type
// creates the column (Enter defaults to Text).
export default function AddColumnPopover({ rect, onClose, onCreate }) {
  const [name, setName] = useState("Column");

  const create = (type) => {
    onCreate(name.trim() || "Column", type);
    onClose();
  };

  return (
    <AnchoredPopover rect={rect} onClose={onClose} width={210}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder="Field name"
        className="field-box w-full mb-2 py-[6px] px-[10px] text-[.72rem]"
        onKeyDown={(e) => {
          if (e.key === "Enter") create("text");
        }}
      />
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Type</div>
      {TYPES.map((t) => (
        <button
          key={t.type}
          type="button"
          onClick={() => create(t.type)}
          className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-[7px] font-mono text-[.68rem] text-forest hover:bg-cream-light transition"
        >
          <span className="w-4 text-center">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </AnchoredPopover>
  );
}
