"use client";
import { useRef, useState } from "react";
import AnchoredPopover from "../AnchoredPopover";
import { rowLabel, linkedRows } from "../linkDerive.mjs";

// Link cell (the record-picker UI). Chips of linked records' labels; click opens
// a portaled searchable list of the target table's rows. Toggling issues one
// add/remove DELTA (concurrency-safe). `single` renders as radio-style (replace).
export default function LinkCell({ column, row, ctx, link }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const targetTable = ctx.tableById.get(column.link?.tableId);
  const single = !!column.link?.single;
  const chosen = linkedRows(row, column, ctx); // ordered linked rows
  const chosenIds = new Set(chosen.map((r) => r.id));
  const candidates = targetTable ? ctx.rowsByTab.get(targetTable.id) ?? [] : [];

  const openMenu = () => {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setQuery("");
    setOpen(true);
  };
  const toggle = (targetId) => {
    if (chosenIds.has(targetId)) link.onRemoveRef(row.id, column.id, targetId);
    else link.onAddRef(row.id, column.id, targetId);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((r) => rowLabel(targetTable, r).toLowerCase().includes(q))
    : candidates;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={openMenu}
        className="w-full min-h-[32px] flex items-center gap-1 flex-wrap px-2 py-[5px] rounded-[8px] hover:bg-cream-light/60 transition-colors text-left"
      >
        {chosen.length ? (
          chosen.map((r) => (
            <span
              key={r.id}
              className="font-mono text-[.65rem] px-[7px] py-[2px] rounded-pill border border-forest/40 bg-cream-light text-forest flex items-center gap-1"
            >
              {rowLabel(targetTable, r)}
              <span
                role="button"
                aria-label="Remove link"
                onClick={(e) => {
                  e.stopPropagation();
                  link.onRemoveRef(row.id, column.id, r.id);
                }}
                className="text-clay hover:text-forest cursor-pointer"
              >
                ✕
              </span>
            </span>
          ))
        ) : (
          <span className="text-brown-soft/45 text-[.82rem]">—</span>
        )}
      </button>
      {open && (
        <AnchoredPopover rect={rect} onClose={() => setOpen(false)} width={240}>
          {!targetTable ? (
            <div className="px-2 py-2 font-mono text-[.66rem] text-clay">Linked table was deleted.</div>
          ) : (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${targetTable.name}…`}
                className="field-box w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
              />
              {filtered.length === 0 && (
                <div className="px-2 py-1.5 font-mono text-[.64rem] text-brown-soft/70">
                  {candidates.length ? "No matches" : `No records in ${targetTable.name} yet`}
                </div>
              )}
              {filtered.map((r) => {
                const on = chosenIds.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-[7px] hover:bg-cream-light"
                  >
                    <span
                      className={
                        (single ? "rounded-full" : "rounded-[4px]") +
                        " w-[14px] h-[14px] border-2 flex items-center justify-center text-[.55rem] leading-none " +
                        (on ? "bg-forest border-forest text-cream-light" : "border-olive")
                      }
                    >
                      {on ? (single ? "●" : "✓") : ""}
                    </span>
                    <span className="font-mono text-[.67rem] text-forest truncate">{rowLabel(targetTable, r)}</span>
                  </button>
                );
              })}
              {chosen.length > 0 && (
                <button
                  type="button"
                  onClick={() => link.onClearRefs(row.id, column.id)}
                  className="block w-full text-left px-2 py-1.5 mt-1 rounded-[7px] font-mono text-[.6rem] text-clay hover:bg-cream-light border-t border-dashed border-brown-soft/30"
                >
                  Clear all
                </button>
              )}
            </>
          )}
        </AnchoredPopover>
      )}
    </>
  );
}
