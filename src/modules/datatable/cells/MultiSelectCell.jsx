"use client";
import { useRef, useState } from "react";
import AnchoredPopover from "../AnchoredPopover";
import { optionChip } from "../optionColors";

// Multi-select cell: shows selected option chips (or —); click opens a portaled
// checklist with search, toggles, "＋ Create", and "Clear all". value = string[] |
// undefined. onCreateOption(name) returns the new {id,name,color}.
export default function MultiSelectCell({ column, value, onCommit, onCreateOption }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const options = column.options ?? [];
  const selectedIds = Array.isArray(value) ? value : [];
  const selectedOpts = selectedIds.map((id) => options.find((o) => o.id === id)).filter(Boolean);

  const openMenu = () => {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setQuery("");
    setOpen(true);
  };
  const close = () => setOpen(false);
  const toggle = (id) =>
    onCommit(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const create = () => {
    const name = query.trim();
    if (!name) return;
    const opt = onCreateOption(name);
    if (opt) onCommit([...selectedIds, opt.id]);
    setQuery("");
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  const exact = options.some((o) => o.name.toLowerCase() === q);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={openMenu}
        className="w-full min-h-[32px] flex items-center gap-1 flex-wrap px-2 py-[5px] rounded-[8px] hover:bg-cream-light/60 transition-colors text-left"
      >
        {selectedOpts.length ? (
          selectedOpts.map((o) => (
            <span
              key={o.id}
              className="font-mono text-[.65rem] px-[7px] py-[2px] rounded-pill border"
              style={optionChip(o.color)}
            >
              {o.name}
            </span>
          ))
        ) : (
          <span className="text-brown-soft/45 text-[.82rem]">—</span>
        )}
      </button>
      {open && (
        <AnchoredPopover rect={rect} onClose={close} width={230}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or create…"
            className="field-box w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && q && !exact) create();
            }}
          />
          {filtered.map((o) => {
            const on = selectedIds.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-[7px] hover:bg-cream-light"
              >
                <span
                  className={
                    "w-[14px] h-[14px] rounded-[4px] border-2 flex items-center justify-center text-[.55rem] leading-none " +
                    (on ? "bg-forest border-forest text-cream-light" : "border-olive")
                  }
                >
                  {on ? "✓" : ""}
                </span>
                <span
                  className="font-mono text-[.67rem] px-2 py-[2px] rounded-pill border"
                  style={optionChip(o.color)}
                >
                  {o.name}
                </span>
              </button>
            );
          })}
          {q && !exact && (
            <button
              type="button"
              onClick={create}
              className="block w-full text-left px-2 py-1.5 rounded-[7px] font-mono text-[.64rem] text-forest hover:bg-cream-light"
            >
              ＋ Create “{query.trim()}”
            </button>
          )}
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onCommit([])}
              className="block w-full text-left px-2 py-1.5 mt-1 rounded-[7px] font-mono text-[.6rem] text-clay hover:bg-cream-light border-t border-dashed border-brown-soft/30"
            >
              Clear all
            </button>
          )}
        </AnchoredPopover>
      )}
    </>
  );
}
