"use client";
import { numberFmt } from "../model.mjs";
import { formatNumber } from "../format";
import { optionChip } from "../optionColors";

// Read-only render of one cell's value, exactly as its column type displays it
// (no editors). Shared by the column-drag ghost AND the derived lookup cell.
export default function ValueView({ column, value }) {
  const empty = <span className="text-brown-soft/40 text-[.8rem]">—</span>;
  switch (column.type) {
    case "number": {
      const text = formatNumber(value, numberFmt(column));
      return <span className="w-full text-right font-mono text-[.82rem] text-forest truncate">{text || empty}</span>;
    }
    case "checkbox":
      return (
        <span className="w-full flex justify-center">
          <span
            className={
              "w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center text-[.7rem] leading-none " +
              (value === true ? "bg-forest border-forest text-cream-light" : "border-olive")
            }
          >
            {value === true ? "✓" : ""}
          </span>
        </span>
      );
    case "select": {
      const opt = (column.options ?? []).find((o) => o.id === value);
      return opt ? (
        <span className="font-mono text-[.67rem] px-2 py-[2px] rounded-pill border truncate max-w-full" style={optionChip(opt.color)}>
          {opt.name}
        </span>
      ) : (
        empty
      );
    }
    case "multiSelect": {
      const ids = Array.isArray(value) ? value : [];
      const opts = ids.map((id) => (column.options ?? []).find((o) => o.id === id)).filter(Boolean);
      return opts.length ? (
        <span className="flex flex-nowrap gap-1 overflow-hidden">
          {opts.map((o) => (
            <span key={o.id} className="font-mono text-[.65rem] px-[7px] py-[2px] rounded-pill border" style={optionChip(o.color)}>
              {o.name}
            </span>
          ))}
        </span>
      ) : (
        empty
      );
    }
    case "text":
    case "date":
    default:
      return value ? <span className="font-mono text-[.8rem] text-forest truncate">{String(value)}</span> : empty;
  }
}
