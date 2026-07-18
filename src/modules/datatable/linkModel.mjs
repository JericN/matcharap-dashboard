// Pure, dependency-free WRITE-side cores for linked-record (link) columns:
// pairing, the single-record add/remove delta with symmetric sync, and the
// cross-table cascades. No zod/react/dnd-kit; no "use client". Imported by the
// client <DataTable> AND the server DAL via the DEEP path (never the barrel).
// Deps point downward to model.mjs. Mirrors model.mjs/viewModel.mjs style.
import {
  writeCell,
  stripColumn,
  captureColumnViewRefs,
  restoreColumn,
} from "./model.mjs";

export const DEFAULT_LINK_WIDTH = 200;

const arrIds = (v) => (Array.isArray(v) ? v : []);

export function findColumn(tabs, tabId, colId) {
  const tab = tabs.find((t) => t.id === tabId);
  return tab ? tab.columns.find((c) => c.id === colId) : undefined;
}

// ---- pairing (create) ----
export function makeLinkPair({ tabA, tabB, name, single, idA, idB }) {
  const colA = {
    id: idA,
    name: name || tabB.name || "Link",
    type: "link",
    width: DEFAULT_LINK_WIDTH,
    link: { tableId: tabB.id, pairColumnId: idB, single: !!single },
  };
  const colB = {
    id: idB,
    name: tabA.name || "Link",
    type: "link",
    width: DEFAULT_LINK_WIDTH,
    link: { tableId: tabA.id, pairColumnId: idA, single: false },
  };
  return { colA, colB };
}

export function insertLinkPair(tabs, tabAId, colA, tabBId, colB) {
  return tabs.map((t) => {
    if (t.id === tabAId) return { ...t, columns: [...t.columns, colA] };
    if (t.id === tabBId) return { ...t, columns: [...t.columns, colB] };
    return t;
  });
}

// ---- editing a link (single-record delta with symmetric sync) ----
// Apply a batch of cell-membership edits ({rowId,colId,memberId,add}) at once,
// grouped by row so each row is rewritten once. writeCell drops emptied keys.
function applyEdits(rows, edits) {
  const byRow = new Map();
  for (const e of edits) {
    if (!byRow.has(e.rowId)) byRow.set(e.rowId, []);
    byRow.get(e.rowId).push(e);
  }
  return rows.map((r) => {
    const es = byRow.get(r.id);
    if (!es) return r;
    let values = r.values;
    for (const e of es) {
      const cur = arrIds(values[e.colId]);
      const next = e.add
        ? cur.includes(e.memberId)
          ? cur
          : [...cur, e.memberId]
        : cur.filter((id) => id !== e.memberId);
      values = writeCell(values, e.colId, next);
    }
    return values === r.values ? r : { ...r, values };
  });
}

// Add or remove ONE pair (rowId <-> targetId) across a symmetric link,
// enforcing `single` on EITHER side by evicting the conflicting pair(s) first.
// Both directions always stay consistent (no drift). Missing target ⇒ no-op.
export function applyLinkDelta(rows, tabs, rowId, colId, targetId, add) {
  const srcRow = rows.find((r) => r.id === rowId);
  if (!srcRow) return rows;
  const srcCol = findColumn(tabs, srcRow.tabId, colId);
  if (!srcCol || srcCol.type !== "link") return rows;
  const revTableId = srcCol.link.tableId;
  const revColId = srcCol.link.pairColumnId;
  const revCol = findColumn(tabs, revTableId, revColId);
  const tgtRow = rows.find((r) => r.id === targetId);
  if (!tgtRow) return rows;

  const edits = [];
  if (add) {
    edits.push({ rowId, colId, memberId: targetId, add: true });
    edits.push({ rowId: targetId, colId: revColId, memberId: rowId, add: true });
    // source single ⇒ drop its OTHER targets (both directions)
    if (srcCol.link.single) {
      for (const other of arrIds(srcRow.values[colId])) {
        if (other !== targetId) {
          edits.push({ rowId, colId, memberId: other, add: false });
          edits.push({ rowId: other, colId: revColId, memberId: rowId, add: false });
        }
      }
    }
    // reverse single ⇒ drop the target's OTHER sources (both directions)
    if (revCol?.link?.single) {
      for (const otherSrc of arrIds(tgtRow.values[revColId])) {
        if (otherSrc !== rowId) {
          edits.push({ rowId: targetId, colId: revColId, memberId: otherSrc, add: false });
          edits.push({ rowId: otherSrc, colId, memberId: targetId, add: false });
        }
      }
    }
  } else {
    edits.push({ rowId, colId, memberId: targetId, add: false });
    edits.push({ rowId: targetId, colId: revColId, memberId: rowId, add: false });
  }
  return applyEdits(rows, edits);
}

// ---- cross-table cascades ----

// All lookup/rollup columns whose linkColumnId is in colIds (the dependents).
export function dependentsOf(tabs, colIds) {
  const set = new Set(colIds);
  const out = [];
  for (const t of tabs) {
    for (const c of t.columns) {
      const ref = c.type === "lookup" ? c.lookup?.linkColumnId : c.type === "rollup" ? c.rollup?.linkColumnId : null;
      if (ref && set.has(ref)) out.push({ tabId: t.id, colId: c.id });
    }
  }
  return out;
}

// Capture (BEFORE stripping) each target column's {column,index,cells,viewRefs}
// in the exact shape restoreColumn consumes — for undo.
function captureRemoval(tabs, rows, targets) {
  const columns = [];
  for (const { tabId, colId } of targets) {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) continue;
    const index = tab.columns.findIndex((c) => c.id === colId);
    const column = tab.columns[index];
    if (!column) continue;
    const cells = rows
      .filter((r) => r.tabId === tabId && r.values[colId] !== undefined)
      .map((r) => ({ rowId: r.id, value: r.values[colId] }));
    const viewRefs = captureColumnViewRefs(tab, colId);
    columns.push({ tabId, column, index, cells, viewRefs });
  }
  return { columns };
}

// Strip each target column sequentially (reuses the view-aware stripColumn core).
function applyStrip(tabs, rows, targets) {
  let t = tabs, r = rows;
  for (const { tabId, colId } of targets) {
    const res = stripColumn(t, r, tabId, colId);
    t = res.tabs; r = res.rows;
  }
  return { tabs: t, rows: r };
}

// Remove a row AND strip its id from every link cell that could hold it (link
// columns whose link.tableId === the row's tab). Bounded scan. removedRefs for undo.
export function stripRowEverywhere(tabs, rows, rowId, rowTabId) {
  const holderCols = new Set();
  for (const t of tabs)
    for (const c of t.columns)
      if (c.type === "link" && c.link?.tableId === rowTabId) holderCols.add(c.id);
  const removedRefs = [];
  const nextRows = [];
  for (const r of rows) {
    if (r.id === rowId) continue;
    let values = r.values;
    for (const colId of holderCols) {
      const cur = values[colId];
      if (Array.isArray(cur) && cur.includes(rowId)) {
        removedRefs.push({ rowId: r.id, colId, targetId: rowId });
        values = writeCell(values, colId, cur.filter((id) => id !== rowId));
      }
    }
    nextRows.push(values === r.values ? r : { ...r, values });
  }
  return { rows: nextRows, removedRefs };
}

// Delete a link column + its paired column + dependent lookup/rollup on either
// side, stripping cells + view refs. `removed` captures all of it for undo.
export function deleteLinkColumnPair(tabs, rows, tabId, colId) {
  const colA = findColumn(tabs, tabId, colId);
  const targets = [{ tabId, colId }];
  if (colA?.type === "link") {
    targets.push({ tabId: colA.link.tableId, colId: colA.link.pairColumnId });
    targets.push(...dependentsOf(tabs, [colId, colA.link.pairColumnId]));
  } else {
    targets.push(...dependentsOf(tabs, [colId]));
  }
  const removed = captureRemoval(tabs, rows, targets);
  const stripped = applyStrip(tabs, rows, targets);
  return { ...stripped, removed };
}

// Delete a whole table: drop inbound link columns (+dependents) on OTHER tables
// first (capturing them), then drop the tab + its rows. The tab/rows themselves
// are captured by the consumer (existing restoreTab path); `removed` is the
// inbound-column capture that undo replays via restoreLinkRemoval.
export function stripTableCascade(tabs, rows, tabId) {
  const inbound = [];
  for (const t of tabs) {
    if (t.id === tabId) continue;
    for (const c of t.columns)
      if (c.type === "link" && c.link?.tableId === tabId) inbound.push({ tabId: t.id, colId: c.id });
  }
  const targets = [...inbound, ...dependentsOf(tabs, inbound.map((i) => i.colId))];
  const removed = captureRemoval(tabs, rows, targets);
  const stripped = applyStrip(tabs, rows, targets);
  return {
    tabs: stripped.tabs.filter((t) => t.id !== tabId),
    rows: stripped.rows.filter((r) => r.tabId !== tabId),
    removed,
  };
}

// Undo of a pair/table strip: re-insert each captured column at its index (ascending
// so shifted positions rebuild left-to-right), restoring its cells + view refs.
export function restoreLinkRemoval(tabs, rows, removed) {
  let t = tabs, r = rows;
  const ordered = [...removed.columns].sort((a, b) => a.index - b.index);
  for (const { tabId, column, index, cells, viewRefs } of ordered) {
    const res = restoreColumn(t, r, tabId, column, index, cells, viewRefs);
    t = res.tabs; r = res.rows;
  }
  return { tabs: t, rows: r };
}
