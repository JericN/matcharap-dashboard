"use client";
import ValueView from "./ValueView";
import { lookupValues } from "../linkDerive.mjs";

// Read-only lookup cell: the target field's values across the linked records,
// each rendered as that target column would display it (via ValueView).
export default function LookupCell({ column, row, ctx }) {
  const { targetCol, values } = lookupValues(row, column, ctx);
  if (!targetCol || values.length === 0) return <span className="px-2 text-brown-soft/45 text-[.82rem]">—</span>;
  return (
    <div className="w-full flex items-center gap-1 flex-wrap px-2 py-[5px]">
      {values.map((v, i) => (
        <ValueView key={i} column={targetCol} value={v} />
      ))}
    </div>
  );
}
