"use client";
import { useState } from "react";
import AnchoredPopover from "./AnchoredPopover";
import { OPTION_COLORS, optionChip } from "./optionColors";

// Manage a select/multiSelect column's options: recolor (swatch → palette),
// rename (inline, commit on blur), delete (cascades to cells), and add.
export default function OptionsEditor({ column, rect, onClose, onAddOption, onUpdateOption, onDeleteOption }) {
  const [newName, setNewName] = useState("");
  const [swatchFor, setSwatchFor] = useState(null); // optionId whose palette is open
  const options = column.options ?? [];

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    onAddOption(n);
    setNewName("");
  };

  return (
    <AnchoredPopover rect={rect} onClose={onClose} width={250}>
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1.5">
        Options · {column.name || "field"}
      </div>

      <div className="flex flex-col gap-1 mb-2">
        {options.map((o) => (
          <div key={o.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSwatchFor(swatchFor === o.id ? null : o.id)}
                className="w-5 h-5 rounded-[6px] border shrink-0"
                style={optionChip(o.color)}
                aria-label="Change color"
              />
              <input
                defaultValue={o.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== o.name) onUpdateOption(o.id, { name: v });
                  else e.target.value = o.name; // reject empty rename; restore display
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="field-bare flex-1 py-[4px] px-2 text-[.72rem]"
                aria-label="Option name"
              />
              <button
                type="button"
                onClick={() => onDeleteOption(o.id)}
                className="text-clay text-[.8rem] px-1 shrink-0"
                aria-label="Delete option"
              >
                🗑
              </button>
            </div>
            {swatchFor === o.id && (
              <div className="grid grid-cols-8 gap-1 pl-6 pb-1">
                {OPTION_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      onUpdateOption(o.id, { color: c.name });
                      setSwatchFor(null);
                    }}
                    className="w-5 h-5 rounded-[6px] border"
                    style={optionChip(c.name)}
                    aria-label={c.name}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {options.length === 0 && (
          <p className="font-mono text-[.6rem] text-brown-soft/70 px-1">No options yet.</p>
        )}
      </div>

      <p className="font-mono text-[.53rem] text-brown-soft/70 px-1 mb-1.5">
        Deleting an option removes it from all cells.
      </p>
      <div className="flex gap-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New option"
          className="field-box flex-1 py-[5px] px-[9px] text-[.7rem]"
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button type="button" onClick={add} className="chip px-3 py-1" aria-label="Add option">
          ＋
        </button>
      </div>
    </AnchoredPopover>
  );
}
