"use client";
import CursorMenu from "./CursorMenu";
import { numberFmt } from "./model.mjs";

// Cursor-anchored column-header menu (opened by right-clicking a header). Add
// field + Rename + Delete always; number columns get inline format controls
// (₱/plain + decimals); select columns get "Edit options".
const itemCls =
  "block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] hover:bg-cream-light transition ";
const divider = <div className="my-1 border-t border-dashed border-brown-soft/30" />;

export default function ColumnMenu({
  column,
  pos,
  onClose,
  onAddField,
  onRename,
  onDelete,
  onSetFormat,
  onEditOptions,
  onToggleSingle,
}) {
  const isNumber = column.type === "number";
  const isSelect = column.type === "select" || column.type === "multiSelect";
  const isLink = column.type === "link";
  const fmt = numberFmt(column);

  return (
    <CursorMenu pos={pos} onClose={onClose}>
      <button
        type="button"
        className={itemCls + "text-forest"}
        onClick={() => {
          onClose();
          onAddField();
        }}
      >
        ＋ Add field
      </button>
      {divider}
      <button
        type="button"
        className={itemCls + "text-forest"}
        onClick={() => {
          onClose();
          onRename();
        }}
      >
        ✎ Rename field
      </button>

      {isSelect && (
        <button
          type="button"
          className={itemCls + "text-forest"}
          onClick={() => {
            onClose();
            onEditOptions();
          }}
        >
          🏷 Edit options
        </button>
      )}

      {isLink && (
        <button
          type="button"
          className={itemCls + "text-forest"}
          onClick={() => {
            onClose();
            onToggleSingle();
          }}
        >
          {column.link?.single ? "🔗 Allow multiple records" : "🔗 Limit to single record"}
        </button>
      )}

      {isNumber && (
        <div className="px-2.5 py-1.5 mt-1 border-t border-dashed border-brown-soft/30">
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft mb-1">Format</div>
          <div className="flex gap-1 mb-2">
            {[
              ["plain", "123"],
              ["currency", "₱"],
            ].map(([st, glyph]) => (
              <button
                key={st}
                type="button"
                onClick={() => onSetFormat({ style: st, precision: fmt.precision })}
                className={
                  "flex-1 font-mono text-[.62rem] py-1 rounded-[6px] border transition " +
                  (fmt.style === st ? "bg-forest text-cream-light border-forest" : "border-olive text-forest")
                }
              >
                {glyph}
              </button>
            ))}
          </div>
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft mb-1">Decimals</div>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSetFormat({ style: fmt.style, precision: p })}
                className={
                  "flex-1 font-mono text-[.62rem] py-1 rounded-[6px] border transition " +
                  (fmt.precision === p ? "bg-forest text-cream-light border-forest" : "border-olive text-forest")
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className={itemCls + "text-clay border-t border-dashed border-brown-soft/30 mt-1"}
        onClick={() => {
          onClose();
          onDelete();
        }}
      >
        🗑 Delete field
      </button>
    </CursorMenu>
  );
}
