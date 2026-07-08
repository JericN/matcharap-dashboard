"use client";
import { useRef, useState } from "react";
import AnchoredPopover from "../AnchoredPopover";
import { optionChip } from "../optionColors";

// Single-select cell: shows the chosen option chip (or —); click opens a portaled
// listbox with search, a "— None" clear, and "＋ Create" when the query is new.
// value = optionId | undefined. onCreateOption(name) returns the new {id,name,color}.
export default function SelectCell({ column, value, onCommit, onCreateOption }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const options = column.options ?? [];
  const selected = options.find((o) => o.id === value) || null;

  const openMenu = () => {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setQuery("");
    setOpen(true);
  };
  const close = () => setOpen(false);
  const pick = (id) => {
    onCommit(id);
    close();
  };
  const create = () => {
    const name = query.trim();
    if (!name) return;
    const opt = onCreateOption(name);
    if (opt) onCommit(opt.id);
    close();
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
        className="w-full min-h-[32px] flex items-center gap-1 px-2 py-[6px] rounded-[8px] hover:bg-cream-light/60 transition-colors text-left"
      >
        {selected ? (
          <span
            className="font-mono text-[.67rem] px-2 py-[2px] rounded-pill border truncate max-w-full"
            style={optionChip(selected.color)}
          >
            {selected.name}
          </span>
        ) : (
          <span className="text-brown-soft/45 text-[.82rem]">—</span>
        )}
      </button>
      {open && (
        <AnchoredPopover rect={rect} onClose={close} width={220}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or create…"
            className="field-box w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (filtered.length === 1) pick(filtered[0].id);
              else if (q && !exact) create();
            }}
          />
          <button
            type="button"
            onClick={() => pick(undefined)}
            className="block w-full text-left px-2 py-1.5 rounded-[7px] font-mono text-[.64rem] text-brown-soft hover:bg-cream-light"
          >
            — None
          </button>
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o.id)}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-[7px] hover:bg-cream-light"
            >
              <span
                className="font-mono text-[.67rem] px-2 py-[2px] rounded-pill border"
                style={optionChip(o.color)}
              >
                {o.name}
              </span>
              {o.id === value && <span className="ml-auto text-forest text-[.7rem]">✓</span>}
            </button>
          ))}
          {q && !exact && (
            <button
              type="button"
              onClick={create}
              className="block w-full text-left px-2 py-1.5 rounded-[7px] font-mono text-[.64rem] text-forest hover:bg-cream-light"
            >
              ＋ Create “{query.trim()}”
            </button>
          )}
        </AnchoredPopover>
      )}
    </>
  );
}
