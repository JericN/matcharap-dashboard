// Pure, dependency-free READ-side cores for linked-record columns: primary/label
// resolution and the DISPLAY-ONLY derivations (linkedRows, lookupValues,
// rollupValue). Built once per render via buildCtx so every resolution is
// O(linked-count), never a scan. No zod/react/dnd-kit. Deps downward to model.mjs.

const LABELABLE = new Set(["text", "number", "date", "select", "checkbox"]);
const isDerived = (t) => t === "link" || t === "lookup" || t === "rollup";
const shortId = (id) => `#${String(id).slice(0, 6)}`;
const nonEmpty = (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

// One pass over all tables/rows → id maps + per-tab row buckets. Memoize on
// (tables, allRows) identity in the caller.
export function buildCtx(tables, allRows) {
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const rowById = new Map(allRows.map((r) => [r.id, r]));
  const rowsByTab = new Map();
  for (const r of allRows) {
    if (!rowsByTab.has(r.tabId)) rowsByTab.set(r.tabId, []);
    rowsByTab.get(r.tabId).push(r);
  }
  return { tableById, rowById, rowsByTab };
}

// Primary/label column = first column, unless it is derived, then the first
// labelable column; else null.
export function primaryColumn(table) {
  const cols = table?.columns ?? [];
  if (cols.length && !isDerived(cols[0].type)) return cols[0];
  return cols.find((c) => LABELABLE.has(c.type)) ?? null;
}

// Display label for a linked record.
export function rowLabel(table, row) {
  const col = primaryColumn(table);
  if (!col) return shortId(row.id);
  const v = row.values[col.id];
  if (!nonEmpty(v)) return shortId(row.id);
  if (col.type === "select") {
    const opt = (col.options ?? []).find((o) => o.id === v);
    return opt ? opt.name : shortId(row.id);
  }
  if (col.type === "checkbox") return v === true ? "✓" : shortId(row.id);
  return String(v);
}

// Resolve a link cell's id array → the linked rows (skips missing ids).
export function linkedRows(row, linkCol, ctx) {
  const ids = Array.isArray(row.values[linkCol.id]) ? row.values[linkCol.id] : [];
  return ids.map((id) => ctx.rowById.get(id)).filter(Boolean);
}

// Find the link column a lookup/rollup depends on (on the SAME table as `row`).
function depLink(row, derivedCol, ctx) {
  const cfg = derivedCol.lookup ?? derivedCol.rollup;
  const own = ctx.tableById.get(row.tabId);
  const linkCol = own?.columns.find((c) => c.id === cfg?.linkColumnId);
  if (!linkCol || linkCol.type !== "link") return { linkCol: null, targetTable: null };
  return { linkCol, targetTable: ctx.tableById.get(linkCol.link.tableId) };
}

// Lookup: the target field's values across the linked records (+ the target
// column so the UI renders each value as that column would).
export function lookupValues(row, lookupCol, ctx) {
  const { linkCol, targetTable } = depLink(row, lookupCol, ctx);
  const targetCol = targetTable?.columns.find((c) => c.id === lookupCol.lookup?.targetColumnId);
  if (!linkCol || !targetCol) return { targetCol: null, values: [] };
  const values = linkedRows(row, linkCol, ctx).map((r) => r.values[targetCol.id]).filter(nonEmpty);
  return { targetCol, values };
}

// Rollup: count = #linked rows; sum/avg/min/max over numeric coercion of the
// target field (empties skipped). Returns null when nothing to aggregate or refs dangle.
export function rollupValue(row, rollupCol, ctx) {
  const { linkCol, targetTable } = depLink(row, rollupCol, ctx);
  if (!linkCol) return null;
  const rows = linkedRows(row, linkCol, ctx);
  const fn = rollupCol.rollup?.fn;
  if (fn === "count") return rows.length;
  const targetCol = targetTable?.columns.find((c) => c.id === rollupCol.rollup?.targetColumnId);
  if (!targetCol) return null;
  const nums = rows.map((r) => r.values[targetCol.id]).filter(nonEmpty).map(Number).filter(Number.isFinite);
  if (!nums.length) return fn === "sum" ? 0 : null;
  switch (fn) {
    case "sum": return nums.reduce((a, b) => a + b, 0);
    case "avg": return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min": return Math.min(...nums);
    case "max": return Math.max(...nums);
    default: return null;
  }
}
