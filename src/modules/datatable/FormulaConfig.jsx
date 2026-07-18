"use client";
import { compile } from "./formula/index.mjs";
import { namesToIds } from "./formula/refs.mjs";

// Reused for create + edit. `draft.expr` is the NAME-form expression being edited;
// the caller converts to id-form on save. Shows a click-to-insert column list and
// live parse validation (a broken formula is still savable — the cell shows #ERR).
export default function FormulaConfig({ columns, draft, setDraft }) {
  const expr = draft.expr ?? "";
  const insertable = columns.filter(
    (c) => c.type !== "link" && c.type !== "lookup" && c.type !== "multiSelect" && c.type !== "formula",
  );
  const { error } = compile(namesToIds(expr, columns));
  const insert = (name) => setDraft({ ...draft, expr: `${expr}${expr && !expr.endsWith(" ") ? " " : ""}{${name}}` });

  return (
    <div className="mt-1">
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Formula</div>
      <textarea
        autoFocus
        value={expr}
        onChange={(e) => setDraft({ ...draft, expr: e.target.value })}
        rows={2}
        placeholder="{Price} * {Qty}"
        spellCheck={false}
        className="field-box w-full py-[6px] px-[10px] text-[.72rem] font-mono resize-y"
      />
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mt-2 mb-1">Insert field</div>
      <div className="flex flex-wrap gap-1">
        {insertable.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => insert(c.name)}
            className="font-mono text-[.62rem] px-2 py-[3px] rounded-[6px] border border-olive text-forest hover:bg-cream-light"
          >
            {c.name || "Field"}
          </button>
        ))}
      </div>
      {error && <div className="mt-2 font-mono text-[.6rem] text-clay">⚠ {error} — you can still save; the cell shows #ERR.</div>}
    </div>
  );
}
