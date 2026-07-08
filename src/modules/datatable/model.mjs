// Pure, use-agnostic table model for the DataTable module — cell read/write
// helpers, number format, and the cascade/restore cores (columns · options ·
// views). NO imports (no zod, no react, no dnd-kit) so it is Node-testable
// (scripts/check-views.mjs) and importable by BOTH the client <DataTable> AND the
// server DAL via the DEEP PATH `@/modules/datatable/model.mjs` (never the barrel,
// which would drag react into the server bundle). Mirrors src/config/docIndex.mjs.
//
// Model: each table/tab owns ordered `columns` + `views`; each row is
// { id, tabId, values } keyed by column id. Empty cell ≡ ABSENT key (never null).
// A view is { id, name, type:"grid", filters, sorts, hiddenColumnIds } — a saved
// lens over the same rows. Consumer-specific bits (DEFAULT_COLUMNS, migration,
// starter columns) live in the consumer (@/config/expenseModel.mjs), not here.

const uid = () => globalThis.crypto.randomUUID();

const dropKey = (obj, key) => {
  const { [key]: _drop, ...rest } = obj;
  return rest;
};

export function cloneColumn(c) {
  const out = { id: c.id, name: c.name, type: c.type, width: c.width };
  if (c.number) out.number = { style: c.number.style, precision: c.number.precision };
  if (c.options) out.options = c.options.map((o) => ({ id: o.id, name: o.name, color: o.color }));
  return out;
}
export const cloneColumns = (cols) => cols.map(cloneColumn);

// The default grid view injected for every table (migration + runtime add-table).
// FIXED deterministic id — NOT a uuid: the consumer's StateSchema preprocess
// re-runs on every read without persisting, so a random id would churn per request
// and break per-browser active-view selection. Unique only WITHIN a table.
export function defaultView() {
  return { id: "view_all", name: "All", type: "grid", filters: [], sorts: [], hiddenColumnIds: [] };
}

// True when a cell value should be treated as "no value" (⇒ key removed).
// NOTE: 0 is NOT empty; unchecked (false) IS empty (checkbox stores true-only).
export function isEmptyValue(value) {
  if (value === undefined || value === null) return true;
  if (value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  if (typeof value === "boolean") return value === false;
  return false;
}

// Coerce an arbitrary value to the column's type at the write boundary. Returns
// `undefined` for an empty/uncoercible value (⇒ writeCell removes the key). The
// ONLY type-enforcement point (Zod stays permissive so one bad write can't brick
// shared getState).
export function coerceCell(column, value) {
  switch (column.type) {
    case "number": {
      if (typeof value !== "number" && typeof value !== "string") return undefined;
      const trimmed = typeof value === "string" ? value.trim() : value;
      if (trimmed === "") return undefined;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : undefined;
    }
    case "multiSelect":
      return Array.isArray(value) ? value.filter((v) => typeof v === "string" && v !== "") : undefined;
    case "select":
      return typeof value === "string" && value !== "" ? value : undefined;
    case "checkbox":
      return value === true ? true : undefined;
    case "text":
    case "date":
    default:
      return value === null || value === undefined ? undefined : String(value);
  }
}

// Set (or, when empty, delete) one cell. Returns a NEW values object.
export function writeCell(values, colId, v) {
  if (isEmptyValue(v)) return colId in values ? dropKey(values, colId) : values;
  return { ...values, [colId]: v };
}

// Deep-copy a values map (arrays must not alias — row duplication depends on it).
export function cloneValues(values) {
  const out = {};
  for (const k in values) {
    const v = values[k];
    out[k] = Array.isArray(v) ? v.slice() : v;
  }
  return out;
}

// The column's number format, with the plain/0 default filled in.
export function numberFmt(column) {
  return column.number ?? { style: "plain", precision: 0 };
}

// Insert `item` into `arr` at `index` (clamped to [0, len]). Returns a new array.
export function insertAt(arr, item, index) {
  const i = Math.max(0, Math.min(index ?? arr.length, arr.length));
  const out = arr.slice();
  out.splice(i, 0, item);
  return out;
}

// ---- cascade cores (delete a column/option → also purge dangling VIEW refs) ----

// Strip a column from a view's filters/sorts/hiddenColumnIds.
function cleanViewOfColumn(v, colId) {
  return {
    ...v,
    filters: (v.filters ?? []).filter((f) => f.columnId !== colId),
    sorts: (v.sorts ?? []).filter((s) => s.columnId !== colId),
    hiddenColumnIds: (v.hiddenColumnIds ?? []).filter((id) => id !== colId),
  };
}

// Delete a column from its tab AND strip its key from in-tab rows AND purge it from
// every view on that tab (filters/sorts/hidden) — else a view references a ghost.
export function stripColumn(tabs, rows, tabId, colId) {
  const nextTabs = tabs.map((t) =>
    t.id === tabId
      ? {
          ...t,
          columns: t.columns.filter((c) => c.id !== colId),
          views: (t.views ?? []).map((v) => cleanViewOfColumn(v, colId)),
        }
      : t,
  );
  const nextRows = rows.map((r) =>
    r.tabId === tabId && colId in r.values ? { ...r, values: dropKey(r.values, colId) } : r,
  );
  return { tabs: nextTabs, rows: nextRows };
}

// Capture (BEFORE a stripColumn) the view fragments that reference colId, so undo
// can restore them by viewId. sorts keep their index (order = key priority).
export function captureColumnViewRefs(tab, colId) {
  const refs = [];
  for (const v of tab.views ?? []) {
    const filters = (v.filters ?? []).filter((f) => f.columnId === colId);
    const sorts = (v.sorts ?? [])
      .map((sort, index) => ({ sort, index }))
      .filter((x) => x.sort.columnId === colId);
    const hidden = (v.hiddenColumnIds ?? []).includes(colId);
    if (filters.length || sorts.length || hidden) refs.push({ viewId: v.id, filters, sorts, hidden });
  }
  return refs;
}

// Re-insert captured sorts at their captured indexes (ascending order).
function reinsertSorts(current, capturedSorts) {
  let out = current.slice();
  for (const { sort, index } of capturedSorts) out = insertAt(out, sort, index);
  return out;
}

// Undo of deleteColumn: re-insert the column at `index`, restore captured cells,
// and MERGE captured view refs into the FRESH views by viewId (never replace a
// whole array — a teammate may have edited a view concurrently).
export function restoreColumn(tabs, rows, tabId, column, index, cells, viewRefs = []) {
  const refByView = new Map(viewRefs.map((r) => [r.viewId, r]));
  const nextTabs = tabs.map((t) => {
    if (t.id !== tabId) return t;
    const columns = insertAt(t.columns, column, index);
    const views = (t.views ?? []).map((v) => {
      const ref = refByView.get(v.id);
      if (!ref) return v;
      const filters = [...(v.filters ?? []), ...ref.filters];
      const sorts = reinsertSorts(v.sorts ?? [], ref.sorts);
      const hiddenColumnIds =
        ref.hidden && !(v.hiddenColumnIds ?? []).includes(column.id)
          ? [...(v.hiddenColumnIds ?? []), column.id]
          : v.hiddenColumnIds ?? [];
      return { ...v, filters, sorts, hiddenColumnIds };
    });
    return { ...t, columns, views };
  });
  const byRow = new Map(cells.map((c) => [c.rowId, c.value]));
  const nextRows = rows.map((r) =>
    r.tabId === tabId && byRow.has(r.id)
      ? { ...r, values: writeCell(r.values, column.id, byRow.get(r.id)) }
      : r,
  );
  return { tabs: nextTabs, rows: nextRows };
}

// Strip a single select/multiSelect option from a view's filters (an emptied
// array-filter is DROPPED so it can't become a `hasAnyOf []` that matches nothing).
function cleanViewOfOption(v, colId, optionId) {
  const filters = [];
  for (const f of v.filters ?? []) {
    if (f.columnId !== colId) {
      filters.push(f);
    } else if (Array.isArray(f.value)) {
      const nv = f.value.filter((x) => x !== optionId);
      if (nv.length) filters.push({ ...f, value: nv });
    } else if (f.value !== optionId) {
      filters.push(f);
    }
  }
  return { ...v, filters };
}

// Delete an option from its column AND strip it from every in-tab cell AND purge it
// from every view's select/multiSelect filters on that tab.
export function stripOption(tabs, rows, tabId, colId, optionId) {
  const nextTabs = tabs.map((t) =>
    t.id === tabId
      ? {
          ...t,
          columns: t.columns.map((c) =>
            c.id === colId ? { ...c, options: (c.options ?? []).filter((o) => o.id !== optionId) } : c,
          ),
          views: (t.views ?? []).map((v) => cleanViewOfOption(v, colId, optionId)),
        }
      : t,
  );
  const nextRows = rows.map((r) => {
    if (r.tabId !== tabId || !(colId in r.values)) return r;
    const val = r.values[colId];
    if (Array.isArray(val)) return { ...r, values: writeCell(r.values, colId, val.filter((x) => x !== optionId)) };
    if (val === optionId) return { ...r, values: dropKey(r.values, colId) };
    return r;
  });
  return { tabs: nextTabs, rows: nextRows };
}

// Capture (BEFORE a stripOption) the option's footprint in each view's filters —
// per filter: removed-from-array (re-add the id) vs whole-condition-dropped.
export function captureOptionViewRefs(tab, colId, optionId) {
  const refs = [];
  for (const v of tab.views ?? []) {
    const frags = [];
    for (const f of v.filters ?? []) {
      if (f.columnId !== colId) continue;
      if (Array.isArray(f.value) && f.value.includes(optionId)) {
        const dropped = f.value.filter((x) => x !== optionId).length === 0;
        frags.push({ filterId: f.id, kind: "array", optionId, dropped, before: f });
      } else if (f.value === optionId) {
        frags.push({ filterId: f.id, kind: "single", before: f });
      }
    }
    if (frags.length) refs.push({ viewId: v.id, frags });
  }
  return refs;
}

// Undo of deleteOption: re-insert the option at `index`, restore captured cells,
// and re-apply option refs into the FRESH views by viewId + filterId.
export function restoreOption(tabs, rows, tabId, colId, option, index, cells, viewRefs = []) {
  const refByView = new Map(viewRefs.map((r) => [r.viewId, r]));
  const nextTabs = tabs.map((t) => {
    if (t.id !== tabId) return t;
    const columns = t.columns.map((c) =>
      c.id === colId ? { ...c, options: insertAt(c.options ?? [], option, index) } : c,
    );
    const views = (t.views ?? []).map((v) => {
      const ref = refByView.get(v.id);
      if (!ref) return v;
      let filters = v.filters ?? [];
      for (const frag of ref.frags) {
        if (frag.kind === "array") {
          const existing = filters.find((f) => f.id === frag.filterId);
          if (existing && Array.isArray(existing.value)) {
            if (!existing.value.includes(frag.optionId))
              filters = filters.map((f) =>
                f.id === frag.filterId ? { ...f, value: [...f.value, frag.optionId] } : f,
              );
          } else if (frag.dropped) {
            filters = [...filters, frag.before];
          }
        } else if (!filters.some((f) => f.id === frag.filterId)) {
          filters = [...filters, frag.before];
        }
      }
      return { ...v, filters };
    });
    return { ...t, columns, views };
  });
  const byRow = new Map(cells.map((c) => [c.rowId, c.value]));
  const nextRows = rows.map((r) =>
    r.tabId === tabId && byRow.has(r.id)
      ? { ...r, values: writeCell(r.values, colId, byRow.get(r.id)) }
      : r,
  );
  return { tabs: nextTabs, rows: nextRows };
}

// Undo of deleteTab: re-insert the tab at `index` and append its rows back.
// (Views live on the tab object, so they come back for free.)
export function restoreTab(tabs, rows, tab, index, tabRows) {
  return { tabs: insertAt(tabs, tab, index), rows: [...rows, ...tabRows] };
}

// Undo of deleteView: re-insert the view at `index` on its tab (views are a tab
// field — no cell capture needed).
export function restoreView(tabs, tabId, view, index) {
  return tabs.map((t) => (t.id === tabId ? { ...t, views: insertAt(t.views ?? [], view, index) } : t));
}
