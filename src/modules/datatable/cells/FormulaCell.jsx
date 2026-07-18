"use client";
import { evalFormula } from "../formulaModel.mjs";
import { numberFmt } from "../model.mjs";
import { formatNumber } from "../format";

// Read-only formula cell: evaluates the expression against the row and renders the
// typed result. Errors show a #ERR chip (message on hover); nothing throws.
export default function FormulaCell({ column, row, columns, ctx }) {
  const { value, error } = evalFormula(column, row, columns ?? [], ctx ?? null);
  if (error) {
    return (
      <span
        title={error}
        className="mx-2 my-auto font-mono text-[.7rem] px-1.5 py-[1px] rounded border border-clay/50 text-clay bg-clay/5"
      >
        #ERR
      </span>
    );
  }
  if (value === undefined || value === null || value === "") {
    return <span className="px-2 text-brown-soft/45 text-[.82rem]">—</span>;
  }
  if (typeof value === "number") {
    return <span className="w-full block text-right px-2 font-mono text-[.82rem] text-forest">{formatNumber(value, numberFmt(column))}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="w-full block text-center px-2 font-mono text-[.82rem] text-forest">{value ? "✓" : "·"}</span>;
  }
  return <span className="px-2 font-mono text-[.8rem] text-forest truncate">{String(value)}</span>;
}
