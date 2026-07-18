"use client";
import { rollupValue } from "../linkDerive.mjs";
import { formatNumber } from "../format";
import { numberFmt } from "../model.mjs";

// Read-only rollup cell: the single aggregated value. count → integer; numeric
// aggregations use the column's own number format (default plain/0).
export default function RollupCell({ column, row, ctx }) {
  const v = rollupValue(row, column, ctx);
  if (v === null || v === undefined) return <span className="px-2 text-brown-soft/45 text-[.82rem]">—</span>;
  const fmt = column.rollup?.fn === "count" ? { style: "plain", precision: 0 } : numberFmt(column);
  return <span className="w-full block text-right px-2 font-mono text-[.82rem] text-forest">{formatNumber(v, fmt)}</span>;
}
