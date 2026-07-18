"use client";
import AnchoredPopover from "./AnchoredPopover";
import { SelectField, TextField, NumberField } from "@/components/form";
import { OPS_BY_TYPE, defaultOpFor, valueKind } from "./viewOps";
import { optionChip } from "./optionColors";

// Derived types (link/lookup/rollup) have no meaningful filter semantics — exclude
// them from the field picker so a user can't add a no-op filter (still hideable).
const FILTERABLE = (c) => c.type !== "link" && c.type !== "lookup" && c.type !== "rollup";

// The operand widget for one filter row, driven by valueKind(type, op):
//   text/number/date → the shared form fields; selectOne → a chip row storing a
//   SINGLE optionId string; selectMany → a toggle chip row storing optionId[];
//   none → nothing (valueless op). Empty ("" / [] / undefined) ⇒ the engine
//   treats the filter as incomplete and ignores it (Airtable-style), so we store
//   undefined when a value is cleared.
function ValueInput({ column, filter, onValue }) {
  const kind = valueKind(column.type, filter.op);
  if (kind === "none") return null;

  if (kind === "text")
    return (
      <TextField
        aria-label="Filter value"
        placeholder="Value…"
        value={filter.value ?? ""}
        onChange={(e) => onValue(e.target.value === "" ? undefined : e.target.value)}
        inputClassName="py-[5px] px-[9px] text-[.7rem]"
      />
    );

  if (kind === "number")
    return (
      <NumberField
        aria-label="Filter value"
        placeholder="0"
        value={filter.value ?? ""}
        onChange={(e) => onValue(e.target.value === "" ? undefined : Number(e.target.value))}
        inputClassName="py-[5px] px-[9px] text-[.7rem]"
      />
    );

  if (kind === "date")
    return (
      <TextField
        type="date"
        aria-label="Filter value"
        value={filter.value ?? ""}
        onChange={(e) => onValue(e.target.value === "" ? undefined : e.target.value)}
        inputClassName="py-[5px] px-[9px] text-[.7rem]"
      />
    );

  // selectOne / selectMany — chips by option NAME + color (optionChip).
  const options = column.options ?? [];
  if (options.length === 0)
    return <p className="font-mono text-[.58rem] text-brown-soft/70 px-1">No options in this field.</p>;

  if (kind === "selectOne") {
    return (
      <div className="flex flex-wrap gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => onValue(undefined)}
          className={
            "font-mono text-[.6rem] px-2 py-[2px] rounded-pill border transition " +
            (filter.value == null ? "bg-matcha-fill text-forest border-forest" : "border-olive text-brown-soft")
          }
        >
          Any
        </button>
        {options.map((o) => {
          const on = filter.value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onValue(o.id)}
              className={"font-mono text-[.63rem] px-2 py-[2px] rounded-pill border transition " + (on ? "" : "opacity-55")}
              style={optionChip(o.color)}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    );
  }

  // selectMany — toggle chips, stored as optionId[] (empty ⇒ undefined).
  const arr = Array.isArray(filter.value) ? filter.value : [];
  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {options.map((o) => {
        const on = arr.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              const next = on ? arr.filter((x) => x !== o.id) : [...arr, o.id];
              onValue(next.length ? next : undefined);
            }}
            className={
              "font-mono text-[.63rem] px-2 py-[2px] rounded-pill border transition flex items-center gap-1 " +
              (on ? "" : "opacity-55")
            }
            style={optionChip(o.color)}
          >
            {on && <span className="text-[.55rem] leading-none">✓</span>}
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

// Filter editor for a view — one popover (portaled, anchored to the toolbar
// button). Each row: [column] [operator (filtered to the column's type)] [value].
// Changing the column resets the op to the type default + clears the value;
// changing the op clears the value only when the value KIND changes. Every edit
// emits the full next filters array via onChange. `columns` is the live column
// set, so only existing fields are selectable.
export default function FilterEditor({ view, columns, rect, onClose, onChange }) {
  const filters = view.filters ?? [];
  const byId = new Map(columns.map((c) => [c.id, c]));
  const fieldColumns = columns.filter(FILTERABLE);

  const setFilter = (id, patch) => onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFilter = (id) => onChange(filters.filter((f) => f.id !== id));
  const addFilter = () => {
    const first = fieldColumns[0];
    if (!first) return;
    onChange([
      ...filters,
      { id: crypto.randomUUID(), columnId: first.id, op: defaultOpFor(first.type), value: undefined },
    ]);
  };

  const changeColumn = (filter, colId) => {
    const col = byId.get(colId);
    if (!col) return;
    setFilter(filter.id, { columnId: colId, op: defaultOpFor(col.type), value: undefined });
  };
  const changeOp = (filter, col, op) => {
    const cleared = valueKind(col.type, filter.op) !== valueKind(col.type, op);
    setFilter(filter.id, cleared ? { op, value: undefined } : { op });
  };

  return (
    <AnchoredPopover rect={rect} onClose={onClose} width={320}>
      <div className="font-mono text-[.52rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1.5">
        Filters
      </div>

      {filters.length === 0 ? (
        <p className="font-mono text-[.62rem] text-brown-soft/75 px-1 py-1">
          No filters — the view shows all records.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 mb-2">
          {filters.map((f) => {
            const col = byId.get(f.columnId);
            const ops = col ? OPS_BY_TYPE[col.type] ?? [] : [];
            return (
              <div
                key={f.id}
                className="flex flex-col gap-1 p-1.5 rounded-[8px] border border-dashed border-brown-soft/30"
              >
                <div className="flex items-center gap-1">
                  <SelectField
                    aria-label="Filter field"
                    className="flex-1 min-w-0"
                    selectClassName="py-[5px] px-[8px] text-[.66rem]"
                    value={col ? f.columnId : ""}
                    onChange={(e) => changeColumn(f, e.target.value)}
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

                  <SelectField
                    aria-label="Filter operator"
                    className="flex-1 min-w-0"
                    selectClassName="py-[5px] px-[8px] text-[.66rem]"
                    value={col ? f.op : ""}
                    disabled={!col}
                    onChange={(e) => changeOp(f, col, e.target.value)}
                  >
                    {!col && (
                      <option value="" disabled>
                        —
                      </option>
                    )}
                    {ops.map((o) => (
                      <option key={o.op} value={o.op}>
                        {o.label}
                      </option>
                    ))}
                  </SelectField>

                  <button
                    type="button"
                    onClick={() => removeFilter(f.id)}
                    className="text-clay text-[.8rem] px-1 shrink-0"
                    aria-label="Remove filter"
                  >
                    🗑
                  </button>
                </div>

                {col && <ValueInput column={col} filter={f} onValue={(value) => setFilter(f.id, { value })} />}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={addFilter}
        disabled={fieldColumns.length === 0}
        className="chip w-full justify-center py-1 text-[.64rem] disabled:opacity-40"
      >
        ＋ Add filter
      </button>
    </AnchoredPopover>
  );
}
