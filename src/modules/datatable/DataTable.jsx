"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  writeCell,
  cloneValues,
  coerceCell,
  defaultView,
  stripColumn,
  stripOption,
  restoreColumn,
  restoreOption,
  restoreTab,
  restoreView,
  captureColumnViewRefs,
  captureOptionViewRefs,
} from "./model.mjs";
import { applyView, visibleColumns, seedValuesFromView } from "./viewModel.mjs";
import {
  applyLinkDelta as applyLinkDeltaClient,
  makeLinkPair as makeLinkPairClient,
  insertLinkPair as insertLinkPairClient,
  deleteLinkColumnPair as deleteLinkColumnPairClient,
  restoreLinkRemoval as restoreLinkRemovalClient,
  stripRowEverywhere as stripRowEverywhereClient,
  stripTableCascade as stripTableCascadeClient,
} from "./linkModel.mjs";
import { nextOptionColor } from "./optionColors";
import TableTabs from "./TableTabs";
import ViewBar from "./ViewBar";
import ViewToolbar from "./ViewToolbar";
import Grid from "./Grid";
import UndoControls from "./UndoControls";
import Toast from "./Toast";
import useUndo from "./useUndo";

const uid = () => crypto.randomUUID();

// Reorder one table's rows within the global list to match `orderedIds`.
function reorderRowsInList(rows, tabId, orderedIds) {
  const byId = new Map(rows.filter((r) => r.tabId === tabId).map((r) => [r.id, r]));
  const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const seen = new Set(seq.map((r) => r.id));
  for (const r of byId.values()) if (!seen.has(r.id)) seq.push(r);
  let k = 0;
  return rows.map((r) => (r.tabId === tabId ? seq[k++] : r));
}

// Use-agnostic Airtable-style table: owns optimistic { tabs, rows } + the undo
// stacks + per-browser active table/view; persistence flows entirely through the
// `adapter` (granular deltas). Every mutating handler = an apply* primitive
// (optimistic setData + adapter call) + a recorded inverse command. Structural view
// ops (add/rename/delete/reorder) are undoable; filter/sort/hide EDITS are not.
export default function DataTable({ initialTables, initialRows, adapter, storageKey = "datatable", makeDefaultColumns }) {
  const [data, setData] = useState({ tabs: initialTables, rows: initialRows });
  const [activeTabId, setActiveTabId] = useState(initialTables[0]?.id);
  const [activeViewByTable, setActiveViewByTable] = useState({}); // { [tabId]: viewId }, per-browser
  const [toast, setToast] = useState(null);
  const [, startTransition] = useTransition();
  const hydrated = useRef(false);
  const { push, undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useUndo();

  const { tabs, rows } = data;
  const activeId = tabs.some((t) => t.id === activeTabId) ? activeTabId : tabs[0]?.id;
  const activeTab = tabs.find((t) => t.id === activeId);
  const columns = activeTab?.columns ?? []; // FULL columns (ops target these)
  const views = activeTab?.views ?? [];
  const storedViewId = activeViewByTable[activeId];
  const activeViewId = views.some((v) => v.id === storedViewId) ? storedViewId : views[0]?.id;
  const activeView = views.find((v) => v.id === activeViewId) ?? views[0];
  const activeRows = rows.filter((r) => r.tabId === activeId);
  const renderColumns = visibleColumns(columns, activeView);

  const selectView = (viewId) => setActiveViewByTable((m) => ({ ...m, [activeId]: viewId }));

  // ---- per-browser active table/view persistence (read once after mount) ----
  useEffect(() => {
    try {
      const t = localStorage.getItem(`${storageKey}:table`);
      const v = localStorage.getItem(`${storageKey}:views`);
      if (t) setActiveTabId(t);
      if (v) setActiveViewByTable(JSON.parse(v));
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, [storageKey]);
  useEffect(() => {
    if (hydrated.current && activeId) {
      try {
        localStorage.setItem(`${storageKey}:table`, activeId);
      } catch {
        /* ignore */
      }
    }
  }, [activeId, storageKey]);
  useEffect(() => {
    if (hydrated.current) {
      try {
        localStorage.setItem(`${storageKey}:views`, JSON.stringify(activeViewByTable));
      } catch {
        /* ignore */
      }
    }
  }, [activeViewByTable, storageKey]);

  // ---- sticky visible-set: filter membership is frozen on view/table switch AND
  // when the view's FILTER definition changes — but NOT on cell edits, so a row you
  // edit never vanishes mid-edit. Sort is applied live. New rows are added in. ----
  const stickyKey = `${activeId}|${activeViewId}|${JSON.stringify(activeView?.filters ?? [])}`;
  const [sticky, setSticky] = useState({ key: null, ids: null });
  let stickyIds = sticky.ids;
  if (sticky.key !== stickyKey) {
    stickyIds = new Set(applyView(activeRows, columns, activeView).map((r) => r.id));
    setSticky({ key: stickyKey, ids: stickyIds });
  }
  const addSticky = (id) => setSticky((s) => ({ key: s.key, ids: new Set([...(s.ids ?? []), id]) }));

  // Rows the grid renders: sticky membership + live sort (filters already decided).
  const shown = applyView(
    activeRows.filter((r) => stickyIds.has(r.id)),
    columns,
    { ...(activeView ?? {}), filters: [] },
  );
  const sortActive = (activeView?.sorts?.length ?? 0) > 0;

  const record = (cmd, nextToast = null) => {
    push(cmd);
    setToast(nextToast);
  };
  const doUndo = useCallback(() => {
    setToast(null);
    undo();
  }, [undo]);
  const doRedo = useCallback(() => {
    setToast(null);
    redo();
  }, [redo]);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo]);

  // ---------- apply* primitives (optimistic setData + adapter delta) ----------
  const applySetCell = (rowId, colId, value) => {
    setData((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.id === rowId ? { ...r, values: writeCell(r.values, colId, value) } : r)),
    }));
    startTransition(() => adapter.setCell(rowId, colId, value));
  };
  const applyAddRef = (rowId, colId, targetId) => {
    setData((d) => ({ ...d, rows: applyLinkDeltaClient(d.rows, d.tabs, rowId, colId, targetId, true) }));
    startTransition(() => adapter.addRef(rowId, colId, targetId));
  };
  const applyRemoveRef = (rowId, colId, targetId) => {
    setData((d) => ({ ...d, rows: applyLinkDeltaClient(d.rows, d.tabs, rowId, colId, targetId, false) }));
    startTransition(() => adapter.removeRef(rowId, colId, targetId));
  };
  const applyAddLinkPair = (tabAId, colA, tabBId, colB) => {
    setData((d) => ({ ...d, tabs: insertLinkPairClient(d.tabs, tabAId, colA, tabBId, colB) }));
    startTransition(() => adapter.addLinkPair(tabAId, colA, tabBId, colB));
  };
  const applyDeleteLinkPair = (tabId, colId) => {
    setData((d) => {
      const { tabs, rows } = deleteLinkColumnPairClient(d.tabs, d.rows, tabId, colId);
      return { tabs, rows };
    });
    startTransition(() => adapter.deleteLinkColumn(tabId, colId));
  };
  const applyRestoreLinkPair = (removed) => {
    setData((d) => {
      const { tabs, rows } = restoreLinkRemovalClient(d.tabs, d.rows, removed);
      return { tabs, rows };
    });
    startTransition(() => adapter.restoreLinkColumn(removed));
  };
  const applyAddRow = (row) => {
    setData((d) => ({ ...d, rows: [...d.rows, row] }));
    startTransition(() => adapter.addRow(row));
  };
  const applyInsertRow = (row, afterId) => {
    setData((d) => {
      const i = afterId ? d.rows.findIndex((r) => r.id === afterId) : -1;
      const rows2 = d.rows.slice();
      if (i < 0) rows2.push(row);
      else rows2.splice(i + 1, 0, row);
      return { ...d, rows: rows2 };
    });
    startTransition(() => adapter.addRow(row, afterId));
  };
  const applyRemoveRow = (id) => {
    setData((d) => {
      const row = d.rows.find((r) => r.id === id);
      if (!row) return d;
      const { rows } = stripRowEverywhereClient(d.tabs, d.rows, id, row.tabId);
      return { ...d, rows };
    });
    startTransition(() => adapter.removeRow(id));
  };
  const applyDuplicate = (srcId, newId, copy) => {
    setData((d) => {
      const i = d.rows.findIndex((r) => r.id === srcId);
      const rows2 = d.rows.slice();
      if (i < 0) rows2.push(copy);
      else rows2.splice(i + 1, 0, copy);
      return { ...d, rows: rows2 };
    });
    startTransition(() => adapter.duplicateRow(srcId, newId, srcId));
  };
  const applyReorderRows = (tabId, orderedIds) => {
    setData((d) => ({ ...d, rows: reorderRowsInList(d.rows, tabId, orderedIds) }));
    startTransition(() => adapter.reorderRows(tabId, orderedIds));
  };
  const applyAddColumn = (tabId, col) => {
    setData((d) => ({
      ...d,
      tabs: d.tabs.map((t) => (t.id === tabId ? { ...t, columns: [...t.columns, col] } : t)),
    }));
    startTransition(() => adapter.addColumn(tabId, col));
  };
  const applyUpdateColumn = (tabId, colId, patch) => {
    setData((d) => ({
      ...d,
      tabs: d.tabs.map((t) =>
        t.id === tabId ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) } : t,
      ),
    }));
    startTransition(() => adapter.updateColumn(tabId, colId, patch));
  };
  const applyReorderColumns = (tabId, orderedIds) => {
    setData((d) => ({
      ...d,
      tabs: d.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const byId = new Map(t.columns.map((c) => [c.id, c]));
        const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
        const seen = new Set(seq.map((c) => c.id));
        for (const c of t.columns) if (!seen.has(c.id)) seq.push(c);
        return { ...t, columns: seq };
      }),
    }));
    startTransition(() => adapter.reorderColumns(tabId, orderedIds));
  };
  const applyDeleteColumn = (tabId, colId) => {
    setData((d) => {
      const { tabs: t, rows: r } = stripColumn(d.tabs, d.rows, tabId, colId);
      return { tabs: t, rows: r };
    });
    startTransition(() => adapter.deleteColumn(tabId, colId));
  };
  const applyRestoreColumn = (tabId, col, index, cells, viewRefs) => {
    setData((d) => {
      const { tabs: t, rows: r } = restoreColumn(d.tabs, d.rows, tabId, col, index, cells, viewRefs);
      return { tabs: t, rows: r };
    });
    startTransition(() => adapter.restoreColumn(tabId, col, index, cells, viewRefs));
  };
  const applyAddOption = (tabId, colId, option) => {
    setData((d) => ({
      ...d,
      tabs: d.tabs.map((t) =>
        t.id === tabId
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, options: [...(c.options ?? []), option] } : c)) }
          : t,
      ),
    }));
    startTransition(() => adapter.addOption(tabId, colId, option));
  };
  const applyUpdateOption = (tabId, colId, optionId, patch) => {
    setData((d) => ({
      ...d,
      tabs: d.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              columns: t.columns.map((c) =>
                c.id === colId
                  ? { ...c, options: (c.options ?? []).map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
                  : c,
              ),
            }
          : t,
      ),
    }));
    startTransition(() => adapter.updateOption(tabId, colId, optionId, patch));
  };
  const applyDeleteOption = (tabId, colId, optionId) => {
    setData((d) => {
      const { tabs: t, rows: r } = stripOption(d.tabs, d.rows, tabId, colId, optionId);
      return { tabs: t, rows: r };
    });
    startTransition(() => adapter.deleteOption(tabId, colId, optionId));
  };
  const applyRestoreOption = (tabId, colId, option, index, cells, viewRefs) => {
    setData((d) => {
      const { tabs: t, rows: r } = restoreOption(d.tabs, d.rows, tabId, colId, option, index, cells, viewRefs);
      return { tabs: t, rows: r };
    });
    startTransition(() => adapter.restoreOption(tabId, colId, option, index, cells, viewRefs));
  };
  const applyAddTab = (tab) => {
    setData((d) => ({ ...d, tabs: [...d.tabs, tab] }));
    setActiveTabId(tab.id);
    startTransition(() => adapter.addTable(tab));
  };
  const applyRemoveTab = (id) => {
    setData((d) => {
      const { tabs, rows } = stripTableCascadeClient(d.tabs, d.rows, id);
      return { tabs, rows };
    });
    startTransition(() => adapter.removeTable(id));
  };
  const applyRestoreTab = (tab, index, tabRows) => {
    setData((d) => {
      const { tabs: t, rows: r } = restoreTab(d.tabs, d.rows, tab, index, tabRows);
      return { tabs: t, rows: r };
    });
    setActiveTabId(tab.id);
    startTransition(() => adapter.restoreTable(tab, index, tabRows));
  };
  const applyRenameTab = (id, name) => {
    setData((d) => ({ ...d, tabs: d.tabs.map((t) => (t.id === id ? { ...t, name } : t)) }));
    startTransition(() => adapter.renameTable(id, name));
  };
  const applyReorderTabs = (orderedIds) => {
    setData((d) => {
      const byId = new Map(d.tabs.map((t) => [t.id, t]));
      const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
      const seen = new Set(seq.map((t) => t.id));
      for (const t of d.tabs) if (!seen.has(t.id)) seq.push(t);
      return { ...d, tabs: seq };
    });
    startTransition(() => adapter.reorderTables(orderedIds));
  };
  // views
  const applyAddView = (tabId, view) => {
    setData((d) => ({ ...d, tabs: d.tabs.map((t) => (t.id === tabId ? { ...t, views: [...(t.views ?? []), view] } : t)) }));
    setActiveViewByTable((m) => ({ ...m, [tabId]: view.id }));
    startTransition(() => adapter.addView(tabId, view));
  };
  const applyUpdateView = (tabId, viewId, patch) => {
    setData((d) => ({
      ...d,
      tabs: d.tabs.map((t) =>
        t.id === tabId ? { ...t, views: t.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)) } : t,
      ),
    }));
    startTransition(() => adapter.updateView(tabId, viewId, patch));
  };
  const applyRemoveView = (tabId, viewId) => {
    setData((d) => ({
      ...d,
      tabs: d.tabs.map((t) => (t.id === tabId ? { ...t, views: t.views.filter((v) => v.id !== viewId) } : t)),
    }));
    startTransition(() => adapter.removeView(tabId, viewId));
  };
  const applyRestoreView = (tabId, view, index) => {
    setData((d) => ({ ...d, tabs: restoreView(d.tabs, tabId, view, index) }));
    setActiveViewByTable((m) => ({ ...m, [tabId]: view.id }));
    startTransition(() => adapter.restoreView(tabId, view, index));
  };
  const applyReorderViews = (tabId, orderedIds) => {
    setData((d) => ({
      ...d,
      tabs: d.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const byId = new Map(t.views.map((v) => [v.id, v]));
        const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
        const seen = new Set(seq.map((v) => v.id));
        for (const v of t.views) if (!seen.has(v.id)) seq.push(v);
        return { ...t, views: seq };
      }),
    }));
    startTransition(() => adapter.reorderViews(tabId, orderedIds));
  };

  // ---------- public handlers (capture before-state + push inverse) ----------
  const onSetCell = (rowId, colId, value) => {
    const row = rows.find((r) => r.id === rowId);
    const before = row ? row.values[colId] : undefined;
    applySetCell(rowId, colId, value);
    record({
      label: "cell edit",
      undo: () => applySetCell(rowId, colId, before === undefined ? "" : before),
      redo: () => applySetCell(rowId, colId, value),
    });
  };
  const onAddRef = (rowId, colId, targetId) => {
    applyAddRef(rowId, colId, targetId);
    record({ label: "link record", undo: () => applyRemoveRef(rowId, colId, targetId), redo: () => applyAddRef(rowId, colId, targetId) });
  };
  const onRemoveRef = (rowId, colId, targetId) => {
    applyRemoveRef(rowId, colId, targetId);
    record({ label: "unlink record", undo: () => applyAddRef(rowId, colId, targetId), redo: () => applyRemoveRef(rowId, colId, targetId) });
  };
  const onClearRefs = (rowId, colId) => {
    const r = rows.find((x) => x.id === rowId);
    const ids = Array.isArray(r?.values[colId]) ? [...r.values[colId]] : [];
    if (!ids.length) return;
    for (const t of ids) applyRemoveRef(rowId, colId, t);
    record({
      label: "clear links",
      undo: () => ids.forEach((t) => applyAddRef(rowId, colId, t)),
      redo: () => ids.forEach((t) => applyRemoveRef(rowId, colId, t)),
    });
  };
  const addLinkColumn = (name, targetTabId, single) => {
    const idA = uid(), idB = uid();
    const tabA = tabs.find((t) => t.id === activeId);
    const tabB = tabs.find((t) => t.id === targetTabId);
    if (!tabA || !tabB) return;
    const { colA, colB } = makeLinkPairClient({ tabA, tabB, name, single, idA, idB });
    applyAddLinkPair(activeId, colA, targetTabId, colB);
    record({
      label: "add link field",
      undo: () => applyDeleteLinkPair(activeId, colA.id),
      redo: () => applyAddLinkPair(activeId, colA, targetTabId, colB),
    });
  };
  const onAddRow = () => {
    const seedRaw = seedValuesFromView(columns, activeView);
    const values = {};
    for (const colId in seedRaw) {
      const col = columns.find((c) => c.id === colId);
      const v = coerceCell(col, seedRaw[colId]);
      if (v !== undefined) values[colId] = v;
    }
    const row = { id: uid(), tabId: activeId, values };
    applyAddRow(row);
    addSticky(row.id);
    record({ label: "add row", undo: () => applyRemoveRow(row.id), redo: () => applyAddRow(row) });
  };
  const onDeleteRow = (id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const tabRows = rows.filter((r) => r.tabId === row.tabId);
    const pos = tabRows.findIndex((r) => r.id === id);
    const afterId = pos > 0 ? tabRows[pos - 1].id : null;
    const { removedRefs } = stripRowEverywhereClient(tabs, rows, id, row.tabId);
    applyRemoveRow(id);
    record(
      {
        label: "delete row",
        undo: () => {
          applyInsertRow(row, afterId);
          removedRefs.forEach((r) => applyAddRef(r.rowId, r.colId, r.targetId));
        },
        redo: () => applyRemoveRow(id),
      },
      { message: "Row deleted" },
    );
  };
  const onDuplicateRow = (id) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    const newId = uid();
    const copy = { ...src, id: newId, values: cloneValues(src.values) };
    applyDuplicate(id, newId, copy);
    addSticky(newId);
    record({ label: "duplicate row", undo: () => applyRemoveRow(newId), redo: () => applyDuplicate(id, newId, copy) });
  };
  const onReorderRows = (orderedIds) => {
    const oldOrder = activeRows.map((r) => r.id);
    applyReorderRows(activeId, orderedIds);
    record({
      label: "reorder rows",
      undo: () => applyReorderRows(activeId, oldOrder),
      redo: () => applyReorderRows(activeId, orderedIds),
    });
  };
  const onAddColumn = (name, type) => {
    const col = { id: uid(), name, type, width: type === "checkbox" ? 90 : 160 };
    if (type === "number") col.number = { style: "plain", precision: 0 };
    if (type === "select" || type === "multiSelect") col.options = [];
    const tabId = activeId;
    applyAddColumn(tabId, col);
    record({ label: "add column", undo: () => applyDeleteColumn(tabId, col.id), redo: () => applyAddColumn(tabId, col) });
  };
  // Lookup/rollup columns: config-only, no cells of their own — created via the
  // same generic add/delete-column path so undo comes free.
  const addDerivedColumn = (type, name, draft) => {
    const col = { id: uid(), name, type, width: type === "rollup" ? 120 : 180 };
    if (type === "lookup") col.lookup = { linkColumnId: draft.linkColumnId, targetColumnId: draft.targetColumnId };
    if (type === "rollup") col.rollup = { linkColumnId: draft.linkColumnId, targetColumnId: draft.targetColumnId, fn: draft.fn ?? "count" };
    const tabId = activeId;
    applyAddColumn(tabId, col);
    record({ label: `add ${type} field`, undo: () => applyDeleteColumn(tabId, col.id), redo: () => applyAddColumn(tabId, col) });
  };
  const onRenameColumn = (colId, name) => {
    const tabId = activeId;
    const old = columns.find((c) => c.id === colId)?.name;
    applyUpdateColumn(tabId, colId, { name });
    record({
      label: "rename column",
      undo: () => applyUpdateColumn(tabId, colId, { name: old }),
      redo: () => applyUpdateColumn(tabId, colId, { name }),
    });
  };
  const onResizeColumn = (colId, width) => {
    const tabId = activeId;
    const old = columns.find((c) => c.id === colId)?.width;
    applyUpdateColumn(tabId, colId, { width });
    record({
      label: "resize column",
      undo: () => applyUpdateColumn(tabId, colId, { width: old }),
      redo: () => applyUpdateColumn(tabId, colId, { width }),
    });
  };
  const onSetColumnFormat = (colId, number) => {
    const tabId = activeId;
    const old = columns.find((c) => c.id === colId)?.number;
    applyUpdateColumn(tabId, colId, { number });
    record({
      label: "number format",
      undo: () => applyUpdateColumn(tabId, colId, { number: old }),
      redo: () => applyUpdateColumn(tabId, colId, { number }),
    });
  };
  const onReorderColumns = (orderedIds) => {
    const tabId = activeId;
    const oldOrder = columns.map((c) => c.id);
    applyReorderColumns(tabId, orderedIds);
    record({
      label: "reorder columns",
      undo: () => applyReorderColumns(tabId, oldOrder),
      redo: () => applyReorderColumns(tabId, orderedIds),
    });
  };
  const onToggleLinkSingle = (colId) => {
    const col = columns.find((c) => c.id === colId);
    if (!col?.link) return;
    const next = !col.link.single;
    applyUpdateColumn(activeId, colId, { link: { ...col.link, single: next } });
    record({
      label: "link single/multi",
      undo: () => applyUpdateColumn(activeId, colId, { link: col.link }),
      redo: () => applyUpdateColumn(activeId, colId, { link: { ...col.link, single: next } }),
    });
  };
  const onEditLookup = (colId, lookup) => {
    const tabId = activeId;
    const old = columns.find((c) => c.id === colId)?.lookup;
    applyUpdateColumn(tabId, colId, { lookup });
    record({
      label: "edit lookup field",
      undo: () => applyUpdateColumn(tabId, colId, { lookup: old }),
      redo: () => applyUpdateColumn(tabId, colId, { lookup }),
    });
  };
  const onDeleteColumn = (colId) => {
    const tabId = activeId;
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    if (col.type === "link") {
      // capture the full removal (pair + dependents + cells + viewRefs) for undo
      const { removed } = deleteLinkColumnPairClient(tabs, rows, tabId, colId);
      applyDeleteLinkPair(tabId, colId);
      record(
        {
          label: "delete link field",
          undo: () => applyRestoreLinkPair(removed),
          redo: () => applyDeleteLinkPair(tabId, colId),
        },
        { message: `Field "${col.name || "link"}" deleted` },
      );
      return;
    }
    const index = columns.findIndex((c) => c.id === colId);
    const cells = rows
      .filter((r) => r.tabId === tabId && r.values[colId] !== undefined)
      .map((r) => ({ rowId: r.id, value: r.values[colId] }));
    const viewRefs = captureColumnViewRefs(activeTab, colId);
    applyDeleteColumn(tabId, colId);
    record(
      {
        label: "delete column",
        undo: () => applyRestoreColumn(tabId, col, index, cells, viewRefs),
        redo: () => applyDeleteColumn(tabId, colId),
      },
      { message: `Column "${col.name || "field"}" deleted` },
    );
  };
  const onAddOption = (colId, name) => {
    const tabId = activeId;
    const col = columns.find((c) => c.id === colId);
    const option = { id: uid(), name, color: nextOptionColor(col?.options?.length ?? 0) };
    applyAddOption(tabId, colId, option);
    record({
      label: "add option",
      undo: () => applyDeleteOption(tabId, colId, option.id),
      redo: () => applyAddOption(tabId, colId, option),
    });
    return option;
  };
  const onUpdateOption = (colId, optionId, patch) => {
    const tabId = activeId;
    const opt = columns.find((c) => c.id === colId)?.options?.find((o) => o.id === optionId);
    const oldPatch = {};
    for (const k in patch) oldPatch[k] = opt ? opt[k] : undefined;
    applyUpdateOption(tabId, colId, optionId, patch);
    record({
      label: "edit option",
      undo: () => applyUpdateOption(tabId, colId, optionId, oldPatch),
      redo: () => applyUpdateOption(tabId, colId, optionId, patch),
    });
  };
  const onDeleteOption = (colId, optionId) => {
    const tabId = activeId;
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    const option = (col.options ?? []).find((o) => o.id === optionId);
    const index = (col.options ?? []).findIndex((o) => o.id === optionId);
    const cells = rows
      .filter((r) => r.tabId === tabId)
      .flatMap((r) => {
        const v = r.values[colId];
        const refs = Array.isArray(v) ? v.includes(optionId) : v === optionId;
        return refs ? [{ rowId: r.id, value: v }] : [];
      });
    const viewRefs = captureOptionViewRefs(activeTab, colId, optionId);
    applyDeleteOption(tabId, colId, optionId);
    record(
      {
        label: "delete option",
        undo: () => applyRestoreOption(tabId, colId, option, index, cells, viewRefs),
        redo: () => applyDeleteOption(tabId, colId, optionId),
      },
      { message: `Option "${option?.name || ""}" deleted` },
    );
  };

  // ---------- tables ----------
  const addTab = () => {
    const id = uid();
    const prevActive = activeId;
    const starter = makeDefaultColumns ? makeDefaultColumns() : [];
    const tab = { id, name: `Sheet ${tabs.length + 1}`, columns: starter, views: [defaultView()] };
    applyAddTab(tab);
    record({
      label: "add sheet",
      undo: () => {
        applyRemoveTab(id);
        setActiveTabId(prevActive);
      },
      redo: () => applyAddTab(tab),
    });
  };
  const renameTab = (id, name) => {
    const old = tabs.find((t) => t.id === id)?.name;
    applyRenameTab(id, name);
    record({ label: "rename sheet", undo: () => applyRenameTab(id, old), redo: () => applyRenameTab(id, name) });
  };
  const deleteTab = (id) => {
    if (tabs.length <= 1) return;
    const tab = tabs.find((t) => t.id === id);
    const index = tabs.findIndex((t) => t.id === id);
    const tabRows = rows.filter((r) => r.tabId === id);
    const fallback = tabs.filter((t) => t.id !== id)[0]?.id;
    const { removed } = stripTableCascadeClient(tabs, rows, id);
    applyRemoveTab(id);
    if (activeId === id) setActiveTabId(fallback);
    record(
      {
        label: "delete sheet",
        undo: () => {
          applyRestoreTab(tab, index, tabRows);
          applyRestoreLinkPair(removed);
        },
        redo: () => {
          applyRemoveTab(id);
          setActiveTabId(fallback);
        },
      },
      { message: `Sheet "${tab.name}" deleted` },
    );
  };
  const onReorderTabs = (orderedIds) => {
    const oldOrder = tabs.map((t) => t.id);
    applyReorderTabs(orderedIds);
    record({
      label: "reorder sheets",
      undo: () => applyReorderTabs(oldOrder),
      redo: () => applyReorderTabs(orderedIds),
    });
  };

  // ---------- views ----------
  const addView = () => {
    const id = uid();
    const prevActiveView = activeViewId;
    const view = { id, name: `View ${views.length + 1}`, type: "grid", filters: [], sorts: [], hiddenColumnIds: [] };
    applyAddView(activeId, view);
    record({
      label: "add view",
      undo: () => {
        applyRemoveView(activeId, view.id);
        selectView(prevActiveView);
      },
      redo: () => applyAddView(activeId, view),
    });
  };
  const renameView = (viewId, name) => {
    const old = views.find((v) => v.id === viewId)?.name;
    applyUpdateView(activeId, viewId, { name });
    record({
      label: "rename view",
      undo: () => applyUpdateView(activeId, viewId, { name: old }),
      redo: () => applyUpdateView(activeId, viewId, { name }),
    });
  };
  const deleteView = (viewId) => {
    if (views.length <= 1) return;
    const view = views.find((v) => v.id === viewId);
    const index = views.findIndex((v) => v.id === viewId);
    const fallback = views.filter((v) => v.id !== viewId)[0]?.id;
    applyRemoveView(activeId, viewId);
    if (activeViewId === viewId) selectView(fallback);
    record(
      {
        label: "delete view",
        undo: () => applyRestoreView(activeId, view, index),
        redo: () => {
          applyRemoveView(activeId, viewId);
          selectView(fallback);
        },
      },
      { message: `View "${view.name}" deleted` },
    );
  };
  const onReorderViews = (orderedIds) => {
    const oldOrder = views.map((v) => v.id);
    applyReorderViews(activeId, orderedIds);
    record({
      label: "reorder views",
      undo: () => applyReorderViews(activeId, oldOrder),
      redo: () => applyReorderViews(activeId, orderedIds),
    });
  };
  // filter / sort / hide EDITS — optimistic, NOT undoable (Airtable doesn't Cmd+Z view config)
  const onUpdateActiveView = (patch) => applyUpdateView(activeId, activeViewId, patch);

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <TableTabs
          tabs={tabs}
          activeTabId={activeId}
          onSelect={setActiveTabId}
          onAdd={addTab}
          onRename={renameTab}
          onDelete={deleteTab}
          onReorder={onReorderTabs}
        />
        <UndoControls
          canUndo={canUndo}
          canRedo={canRedo}
          undoLabel={undoLabel}
          redoLabel={redoLabel}
          onUndo={doUndo}
          onRedo={doRedo}
        />
      </div>
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <ViewBar
          views={views}
          activeViewId={activeViewId}
          onSelectView={selectView}
          onAddView={addView}
          onRenameView={renameView}
          onDeleteView={deleteView}
          onReorderViews={onReorderViews}
        />
        {activeView && <ViewToolbar view={activeView} columns={columns} onUpdateView={onUpdateActiveView} />}
      </div>
      <Grid
        key={`${activeId}:${activeViewId}`}
        columns={renderColumns}
        rows={shown}
        sortActive={sortActive}
        totalCount={activeRows.length}
        filteredCount={shown.length}
        onClearFilter={() => onUpdateActiveView({ filters: [] })}
        onSetCell={onSetCell}
        onAddRow={onAddRow}
        onDeleteRow={onDeleteRow}
        onDuplicateRow={onDuplicateRow}
        onReorderRows={onReorderRows}
        onAddColumn={onAddColumn}
        onAddLinkColumn={addLinkColumn}
        onCreateDerived={addDerivedColumn}
        onRenameColumn={onRenameColumn}
        onResizeColumn={onResizeColumn}
        onSetColumnFormat={onSetColumnFormat}
        onReorderColumns={onReorderColumns}
        onDeleteColumn={onDeleteColumn}
        onToggleLinkSingle={onToggleLinkSingle}
        onUpdateLookup={onEditLookup}
        onAddOption={onAddOption}
        onUpdateOption={onUpdateOption}
        onDeleteOption={onDeleteOption}
        link={{
          tables: tabs,
          currentTabId: activeId,
          columns, // FULL active-tab columns (not view-filtered) — link/lookup config needs every field
          allRows: rows,
          onAddRef: (rowId, colId, targetId) => onAddRef(rowId, colId, targetId),
          onRemoveRef: (rowId, colId, targetId) => onRemoveRef(rowId, colId, targetId),
          onClearRefs: (rowId, colId) => onClearRefs(rowId, colId),
        }}
      />
      {toast && <Toast message={toast.message} onUndo={doUndo} onClose={() => setToast(null)} />}
    </div>
  );
}
