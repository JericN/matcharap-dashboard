// Expense-planner CONSUMER of the use-agnostic DataTable module. The generic table
// cores (cell helpers + view-aware cascade/restore) now live in
// `src/modules/datatable/model.mjs` and are re-exported here so the existing
// importers (repo.js, schemas.js, the UI, scripts/check-expenses.mjs) keep their
// `@/config/expenseModel.mjs` import path. This file OWNS only the expense-specific
// pieces: the legacy `col_*` DEFAULT_COLUMNS, the new-sheet starter columns, and the
// migration (`normalizeExpenses`, which folds legacy flat rows + injects a default
// view). Mirrors src/config/docIndex.mjs. RELATIVE import (not `@/`) so the Node
// test scripts resolve the module without the Next alias.
import {
  isEmptyValue,
  coerceCell,
  writeCell,
  cloneValues,
  numberFmt,
  insertAt,
  cloneColumns,
  defaultView,
  stripColumn,
  stripOption,
  captureColumnViewRefs,
  captureOptionViewRefs,
  restoreColumn,
  restoreOption,
  restoreTab,
  restoreView,
} from "../modules/datatable/model.mjs";

// Re-export the generic cores under the historical import path.
export {
  isEmptyValue,
  coerceCell,
  writeCell,
  cloneValues,
  numberFmt,
  insertAt,
  cloneColumns,
  defaultView,
  stripColumn,
  stripOption,
  captureColumnViewRefs,
  captureOptionViewRefs,
  restoreColumn,
  restoreOption,
  restoreTab,
  restoreView,
};

const uid = () => globalThis.crypto.randomUUID();

// The 5 fixed default columns injected when migrating a legacy (pre-columns) tab.
// Fixed ids preserve the mapping from the old flat row fields into `values`.
export const DEFAULT_COLUMNS = [
  { id: "col_item", name: "Item", type: "text", width: 200 },
  { id: "col_notes", name: "Notes", type: "text", width: 220 },
  { id: "col_date", name: "Date", type: "date", width: 140 },
  { id: "col_price", name: "Price", type: "number", width: 120, number: { style: "currency", precision: 2 } },
  { id: "col_qty", name: "Qty", type: "number", width: 90, number: { style: "plain", precision: 0 } },
];

// Canonical default tab (schema fallback + empty-store default). Every table owns a
// default grid view so the Views UI always has ≥1 view to render.
export const DEFAULT_TAB = {
  id: "default",
  name: "Sheet 1",
  columns: cloneColumns(DEFAULT_COLUMNS),
  views: [defaultView()],
};

// Starter columns for a NEW user-created sheet — fresh uuids (col_* stays
// migration-only). An expense sheet wants at least an item + an amount.
export function defaultColumns() {
  return [
    { id: uid(), name: "Item", type: "text", width: 200 },
    { id: uid(), name: "Amount", type: "number", width: 130, number: { style: "currency", precision: 2 } },
  ];
}

// Migrate a raw stored value into the columns+cells+views model. IDEMPOTENT via key/
// length presence: a legacy tab gains `columns`; ANY tab without a view gains the
// fixed `view_all` default (length-guarded — an empty `views` array is never
// legitimate, unlike an empty `columns` array). Legacy flat rows fold into `values`.
// Guarantees ≥1 tab. Returns {expenseTabs, expenses} (the state preprocess spreads
// them over the other fields).
export function normalizeExpenses(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const rawTabs = Array.isArray(src.expenseTabs) ? src.expenseTabs : [];
  const rawRows = Array.isArray(src.expenses) ? src.expenses : [];

  let expenseTabs = rawTabs.map((t) => {
    if (!t || typeof t !== "object") return t; // junk element → let Zod reject cleanly (no TypeError)
    // Step 1: legacy (pre-columns) tab gains DEFAULT_COLUMNS. Independent of step 2.
    let out = "columns" in t ? t : { ...t, columns: cloneColumns(DEFAULT_COLUMNS) };
    // Step 2: any table without a view gains the default view (length-guarded).
    out = out.views?.length ? out : { ...out, views: [defaultView()] };
    return out;
  });
  if (expenseTabs.length === 0) {
    expenseTabs = [
      { id: DEFAULT_TAB.id, name: DEFAULT_TAB.name, columns: cloneColumns(DEFAULT_COLUMNS), views: [defaultView()] },
    ];
  }

  const expenses = rawRows.map((r) => {
    if (!r || typeof r !== "object") return r; // junk element → let Zod reject cleanly (no TypeError)
    if ("values" in r) return r;
    // Legacy flat row { item, notes, date, price, qty } → cells under fixed ids.
    let values = {};
    if (typeof r.item === "string" && r.item !== "") values.col_item = r.item;
    if (typeof r.notes === "string" && r.notes !== "") values.col_notes = r.notes;
    if (typeof r.date === "string" && r.date !== "") values.col_date = r.date;
    if (typeof r.price === "number" && !Number.isNaN(r.price)) values.col_price = r.price;
    if (typeof r.qty === "number" && !Number.isNaN(r.qty)) values.col_qty = r.qty;
    return { id: r.id, tabId: r.tabId ?? "default", values };
  });

  return { expenseTabs, expenses };
}
