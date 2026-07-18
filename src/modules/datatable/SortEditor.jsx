"use client";
import AnchoredPopover from "./AnchoredPopover";
import { SelectField } from "@/components/form";

// Derived types (link/lookup/rollup/formula) have no meaningful sort semantics —
// exclude them from the field picker so a user can't add a no-op sort (still hideable).
const FILTERABLE = (c) => c.type !== "link" && c.type !== "lookup" && c.type !== "rollup" && c.type !== "formula";

// Sort editor for a view — an ordered list of sort keys (top row = highest
// priority). Each row: [column] [↑ A→Z / ↓ Z→A direction toggle]. Add appends a
// key on the first column (asc); 🗑 removes. Every edit emits the full next sorts
// array (each { columnId, dir }) via onChange. `columns` is the live column set.
export default function SortEditor({ view, columns, rect, onClose, onChange }) {
  const sorts = view.sorts ?? [];
  const byId = new Map(columns.map((c) => [c.id, c]));
  const fieldColumns = columns.filter(FILTERABLE);

  const setSort = (i, patch) => onChange(sorts.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeSort = (i) => onChange(sorts.filter((_, idx) => idx !== i));
  const addSort = () => {
    const first = fieldColumns[0];
    if (!first) return;
    onChange([...sorts, { columnId: first.id, dir: "asc" }]);
  };

  const dirBtn = (i, dir, glyph, active) => (
    <button
      type="button"
      onClick={() => setSort(i, { dir })}
      aria-pressed={active}
      className={
        "flex-1 font-mono text-[.6rem] py-[5px] rounded-[6px] border transition " +
        (active ? "bg-forest text-cream-light border-forest" : "border-olive text-forest")
      }
    >
      {glyph}
    </button>
  );

  return (
    <AnchoredPopover rect={rect} onClose={onClose} width={280}>
      <div className="font-mono text-[.52rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1.5">
        Sort
      </div>

      {sorts.length === 0 ? (
        <p className="font-mono text-[.62rem] text-brown-soft/75 px-1 py-1">
          No sorts — records keep their natural order.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 mb-2">
          {sorts.map((s, i) => {
            const col = byId.get(s.columnId);
            return (
              <div
                key={i}
                className="flex items-center gap-1 p-1.5 rounded-[8px] border border-dashed border-brown-soft/30"
              >
                <SelectField
                  aria-label="Sort field"
                  className="flex-1 min-w-0"
                  selectClassName="py-[5px] px-[8px] text-[.66rem]"
                  value={col ? s.columnId : ""}
                  onChange={(e) => setSort(i, { columnId: e.target.value })}
                >
                  {!col && (
                    <option value="" disabled>
                      (field removed)
                    </option>
                  )}
                  {fieldColumns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>

                <div className="flex gap-1 w-[92px] shrink-0">
                  {dirBtn(i, "asc", "↑ A→Z", s.dir === "asc")}
                  {dirBtn(i, "desc", "↓ Z→A", s.dir === "desc")}
                </div>

                <button
                  type="button"
                  onClick={() => removeSort(i)}
                  className="text-clay text-[.8rem] px-1 shrink-0"
                  aria-label="Remove sort"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={addSort}
        disabled={fieldColumns.length === 0}
        className="chip w-full justify-center py-1 text-[.64rem] disabled:opacity-40"
      >
        ＋ Add sort
      </button>
    </AnchoredPopover>
  );
}
