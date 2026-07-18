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
