"use client";
import { useState } from "react";
import AnchoredPopover from "./AnchoredPopover";
import LinkFieldConfig from "./LinkFieldConfig";

const TYPES = [
  { type: "text", label: "Text", icon: "📝" },
  { type: "number", label: "Number", icon: "#" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "select", label: "Single select", icon: "◉" },
  { type: "multiSelect", label: "Multi-select", icon: "🏷" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
  { type: "link", label: "Link to table", icon: "🔗" },
  { type: "lookup", label: "Lookup", icon: "👁" },
];

// Add a column: name + type picker. Link/lookup/rollup open a config step.
export default function AddColumnPopover({
  rect,
  onClose,
  onCreate,
  tables = [],
  currentTabId,
  columns = [],
  onCreateLink,
  onCreateDerived,
}) {
  const [name, setName] = useState("Column");
  const [step, setStep] = useState(null); // null = type list; "link"/"lookup" = config
  const [draft, setDraft] = useState({ single: false });

  const createSimple = (type) => {
    onCreate(name.trim() || "Column", type);
    onClose();
  };
  const confirmLink = () => {
    if (!draft.tableId) return;
    onCreateLink(name.trim() || "Column", draft.tableId, !!draft.single);
    onClose();
  };
  const confirmLookup = () => {
    if (!draft.linkColumnId || !draft.targetColumnId) return;
    onCreateDerived("lookup", name.trim() || "Column", draft);
    onClose();
  };

  return (
    <AnchoredPopover rect={rect} onClose={onClose} width={230}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder="Field name"
        className="field-box w-full mb-2 py-[6px] px-[10px] text-[.72rem]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !step) createSimple("text");
        }}
      />
      {step === "link" ? (
        <>
          <LinkFieldConfig mode="link" tables={tables} currentTabId={currentTabId} draft={draft} setDraft={setDraft} />
          <div className="flex gap-1 mt-2">
            <button type="button" onClick={() => setStep(null)} className="flex-1 chip">
              ← Back
            </button>
            <button type="button" onClick={confirmLink} disabled={!draft.tableId} className="flex-1 chip chip--active disabled:opacity-40">
              Create link
            </button>
          </div>
        </>
      ) : step === "lookup" ? (
        <>
          <LinkFieldConfig mode="lookup" tables={tables} currentTabId={currentTabId} columns={columns} draft={draft} setDraft={setDraft} />
          <div className="flex gap-1 mt-2">
            <button type="button" onClick={() => setStep(null)} className="flex-1 chip">
              ← Back
            </button>
            <button
              type="button"
              onClick={confirmLookup}
              disabled={!draft.linkColumnId || !draft.targetColumnId}
              className="flex-1 chip chip--active disabled:opacity-40"
            >
              Create lookup
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Type</div>
          {TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => (t.type === "link" || t.type === "lookup" ? setStep(t.type) : createSimple(t.type))}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-[7px] font-mono text-[.68rem] text-forest hover:bg-cream-light transition"
            >
              <span className="w-4 text-center">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </>
      )}
    </AnchoredPopover>
  );
}
