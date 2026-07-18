# Linked Fields (link · lookup · rollup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three linked-record column types to the `src/modules/datatable/` engine (used by `/expenses`): a two-way symmetric **link**, a derived **lookup**, and a derived **rollup** (sum/count/avg/min/max), including the record-picker UI.

**Architecture:** Two new dependency-free pure cores — `linkModel.mjs` (write: pairing, single-record add/remove delta with symmetric sync, cross-table cascades) and `linkDerive.mjs` (read: label + display-only derivations) — imported verbatim by the client optimistic layer (`DataTable.jsx`), the server DAL (`repo.js`), and a Node test (`scripts/check-links.mjs`). UI is new cells + one reusable config panel. Link edits are **single-record deltas off fresh state** (never absolute arrays), matching the repo's concurrency rule.

**Tech Stack:** Next.js 14 (app router), React, Zod (`schemas.js`), TanStack Table v8 + `@dnd-kit` (Grid), Upstash Redis (shared `state`), Node `assert/strict` test scripts.

## Global Constraints

- The module imports **NOTHING** from `@/config` or `@/features`. App-specifics arrive as props/adapter callbacks.
- `linkModel.mjs` / `linkDerive.mjs` are **dependency-free** (no zod/react/dnd-kit), carry no `"use client"`, and use `globalThis.crypto.randomUUID()`. Their deps point **downward** to `model.mjs` only.
- Server DAL imports the pure cores via the **DEEP path** `@/modules/datatable/linkModel.mjs` / `linkDerive.mjs` — never the `index.js` barrel.
- **Empty cell ≡ absent key** (never null). Use `writeCell` to set/drop.
- **Concurrency:** link writes are single-record `addRef`/`removeRef` deltas applied to FRESH server state; clients never send an absolute id array.
- `type` and a link column's `link.tableId` are **immutable** after creation. Zod stays **permissive** — a dangling cross-ref must never throw at the `StateSchema` boundary; derivation is defensive.
- Rollup fns v1 = `sum | count | avg | min | max`. Filter/sort on link/lookup/rollup is **out** of v1 (display-only).
- Verify per stage in the **main loop** (never inside a workflow): `npm run check:links`, `npm run lint`, `npm run build`, `/expenses` smoke test. Shared-state manual E2E in a **throwaway sheet** only.
- Spec: `docs/superpowers/specs/2026-07-19-linked-fields-design.md`. Branch: `linked-fields`.

---

# STAGE 1 — Schema + pure cores + Node test (headless)

### Task 1: `clampIds` + `coerceCell` link/derived arms (model.mjs)

**Files:**
- Modify: `src/modules/datatable/model.mjs` (add `clampIds`; extend `coerceCell`)
- Test: `scripts/check-links.mjs` (create)

**Interfaces:**
- Produces: `clampIds(ids, single) -> string[]`; `coerceCell(column, value)` now handles `type` `"link"` (→ clamped id array or `undefined`) and `"lookup"`/`"rollup"` (→ `undefined`).

- [ ] **Step 1: Write the failing test** — create `scripts/check-links.mjs`:

```js
// Pure-logic tests for linked-record columns (link/lookup/rollup): the write
// cores (pairing, add/remove delta + symmetric sync, cascades) and the read
// derivations. No env needed — all pure.  npm run check:links
import assert from "node:assert/strict";
import { clampIds, coerceCell } from "../src/modules/datatable/model.mjs";

let n = 0;
const ok = (msg) => console.log(`✅ ${msg}`) || n++;

// --- clampIds ---
assert.deepEqual(clampIds(["a", "b", "c"], false), ["a", "b", "c"]);
assert.deepEqual(clampIds(["a", "b", "c"], true), ["c"]); // single keeps last
assert.deepEqual(clampIds(["a", "", 3, "b"], false), ["a", "b"]); // drops non-string/empty
assert.deepEqual(clampIds(null, false), []);
ok("clampIds filters + applies single (keep-last)");

// --- coerceCell link + derived ---
const linkColM = { type: "link", link: { single: false } };
const linkColS = { type: "link", link: { single: true } };
assert.deepEqual(coerceCell(linkColM, ["r1", "r2"]), ["r1", "r2"]);
assert.equal(coerceCell(linkColM, []), undefined); // empty ⇒ drop
assert.deepEqual(coerceCell(linkColS, ["r1", "r2"]), ["r2"]); // single clamp
assert.equal(coerceCell({ type: "lookup" }, ["x"]), undefined); // derived, never stored
assert.equal(coerceCell({ type: "rollup" }, 5), undefined);
ok("coerceCell handles link (clamp) + lookup/rollup (never stored)");

console.log(`\n${n} checks passed.`);
process.exit(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-links.mjs`
Expected: FAIL — `SyntaxError`/`does not provide an export named 'clampIds'`.

- [ ] **Step 3: Implement in `model.mjs`** — add after `insertAt` (near line 101):

```js
// Clamp a link-cell id array to the single/multi rule. Filters non-string/empty.
// `single` keeps only the LAST id (most-recently chosen) — matches the picker's
// replace-on-pick UX. The single source of the single/multi cap.
export function clampIds(ids, single) {
  const arr = (Array.isArray(ids) ? ids : []).filter((v) => typeof v === "string" && v !== "");
  return single ? arr.slice(-1) : arr;
}
```

Then extend `coerceCell`'s switch (before the `text`/`date` default), around line 64:

```js
    case "link": {
      const ids = clampIds(value, column.link?.single);
      return ids.length ? ids : undefined;
    }
    case "lookup":
    case "rollup":
      return undefined; // derived — never stored in a cell
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-links.mjs`
Expected: PASS — `2 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add src/modules/datatable/model.mjs scripts/check-links.mjs
git commit -m "feat(datatable): clampIds + coerceCell link/derived arms"
```

---

### Task 2: `linkModel.mjs` — pairing + `applyLinkDelta`

**Files:**
- Create: `src/modules/datatable/linkModel.mjs`
- Test: `scripts/check-links.mjs` (extend)

**Interfaces:**
- Consumes: `clampIds`, `writeCell` (model.mjs).
- Produces: `DEFAULT_LINK_WIDTH`; `makeLinkPair({tabA,tabB,name,single,idA,idB}) -> {colA,colB}`; `insertLinkPair(tabs,tabAId,colA,tabBId,colB) -> tabs`; `applyLinkDelta(rows,tabs,rowId,colId,targetId,add) -> rows`; `findColumn(tabs,tabId,colId) -> Column|undefined`.

- [ ] **Step 1: Write the failing test** — append to `scripts/check-links.mjs` (before the final `console.log`):

```js
import {
  makeLinkPair,
  insertLinkPair,
  applyLinkDelta,
} from "../src/modules/datatable/linkModel.mjs";

// two tables A (people) and B (projects)
const mkTabs = () => [
  { id: "A", name: "People", columns: [{ id: "a_name", name: "Name", type: "text" }], views: [] },
  { id: "B", name: "Projects", columns: [{ id: "b_name", name: "Name", type: "text" }], views: [] },
];

// --- makeLinkPair / insertLinkPair ---
{
  const [tabA, tabB] = mkTabs();
  const { colA, colB } = makeLinkPair({ tabA, tabB, name: "Projects", single: false, idA: "la", idB: "lb" });
  assert.equal(colA.type, "link");
  assert.deepEqual(colA.link, { tableId: "B", pairColumnId: "lb", single: false });
  assert.deepEqual(colB.link, { tableId: "A", pairColumnId: "la", single: false });
  assert.equal(colB.name, "People"); // reverse defaults to source table name
  const tabs = insertLinkPair([tabA, tabB], "A", colA, "B", colB);
  assert.equal(tabs[0].columns.at(-1).id, "la");
  assert.equal(tabs[1].columns.at(-1).id, "lb");
  ok("makeLinkPair builds paired columns; insertLinkPair appends both");
}

// --- applyLinkDelta: add mirrors both sides ---
{
  let tabs = mkTabs();
  const { colA, colB } = makeLinkPair({ tabA: tabs[0], tabB: tabs[1], single: false, idA: "la", idB: "lb" });
  tabs = insertLinkPair(tabs, "A", colA, "B", colB);
  let rows = [
    { id: "a1", tabId: "A", values: {} },
    { id: "b1", tabId: "B", values: {} },
  ];
  rows = applyLinkDelta(rows, tabs, "a1", "la", "b1", true);
  assert.deepEqual(rows.find((r) => r.id === "a1").values.la, ["b1"]);
  assert.deepEqual(rows.find((r) => r.id === "b1").values.lb, ["a1"]); // reverse synced
  rows = applyLinkDelta(rows, tabs, "a1", "la", "b1", false);
  assert.ok(!("la" in rows.find((r) => r.id === "a1").values)); // empty ⇒ dropped
  assert.ok(!("lb" in rows.find((r) => r.id === "b1").values));
  ok("applyLinkDelta add/remove keeps both sides consistent");
}

// --- applyLinkDelta: single source evicts the prior pair on BOTH sides ---
{
  let tabs = mkTabs();
  const { colA, colB } = makeLinkPair({ tabA: tabs[0], tabB: tabs[1], single: true, idA: "la", idB: "lb" });
  tabs = insertLinkPair(tabs, "A", colA, "B", colB);
  let rows = [
    { id: "a1", tabId: "A", values: {} },
    { id: "b1", tabId: "B", values: {} },
    { id: "b2", tabId: "B", values: {} },
  ];
  rows = applyLinkDelta(rows, tabs, "a1", "la", "b1", true);
  rows = applyLinkDelta(rows, tabs, "a1", "la", "b2", true); // single ⇒ replaces b1
  assert.deepEqual(rows.find((r) => r.id === "a1").values.la, ["b2"]);
  assert.ok(!("lb" in rows.find((r) => r.id === "b1").values)); // b1 lost its reverse ref
  assert.deepEqual(rows.find((r) => r.id === "b2").values.lb, ["a1"]);
  ok("applyLinkDelta single-source replaces + cleans the evicted reverse ref");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-links.mjs`
Expected: FAIL — cannot find `../src/modules/datatable/linkModel.mjs`.

- [ ] **Step 3: Implement `src/modules/datatable/linkModel.mjs`:**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-links.mjs`
Expected: PASS — `5 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add src/modules/datatable/linkModel.mjs scripts/check-links.mjs
git commit -m "feat(datatable): link pairing + symmetric add/remove delta"
```

---

### Task 3: `linkModel.mjs` — cross-table cascades + restore

**Files:**
- Modify: `src/modules/datatable/linkModel.mjs`
- Test: `scripts/check-links.mjs` (extend)

**Interfaces:**
- Produces: `dependentsOf(tabs, colIds) -> [{tabId,colId}]`; `stripRowEverywhere(tabs, rows, rowId, rowTabId) -> {rows, removedRefs}`; `deleteLinkColumnPair(tabs, rows, tabId, colId) -> {tabs, rows, removed}`; `stripTableCascade(tabs, rows, tabId) -> {tabs, rows, removed}`; `restoreLinkRemoval(tabs, rows, removed) -> {tabs, rows}`. `removed = { columns: [{tabId, column, index, cells, viewRefs}] }`.

- [ ] **Step 1: Write the failing test** — append to `scripts/check-links.mjs`:

```js
import {
  dependentsOf,
  stripRowEverywhere,
  deleteLinkColumnPair,
  stripTableCascade,
  restoreLinkRemoval,
} from "../src/modules/datatable/linkModel.mjs";

// Build A<->B linked, plus a rollup on A over B, with data.
const built = () => {
  let tabs = [
    { id: "A", name: "People", columns: [{ id: "a_name", name: "Name", type: "text" }], views: [{ id: "v", name: "All", type: "grid", filters: [], sorts: [], hiddenColumnIds: [] }] },
    { id: "B", name: "Projects", columns: [{ id: "b_name", name: "Name", type: "text" }, { id: "b_cost", name: "Cost", type: "number" }], views: [] },
  ];
  const { colA, colB } = makeLinkPair({ tabA: tabs[0], tabB: tabs[1], single: false, idA: "la", idB: "lb" });
  tabs = insertLinkPair(tabs, "A", colA, "B", colB);
  // a rollup on A that depends on la
  tabs = tabs.map((t) => t.id === "A" ? { ...t, columns: [...t.columns, { id: "roll", name: "Total", type: "rollup", width: 120, rollup: { linkColumnId: "la", targetColumnId: "b_cost", fn: "sum" } }] } : t);
  let rows = [
    { id: "a1", tabId: "A", values: {} },
    { id: "b1", tabId: "B", values: { b_cost: 10 } },
    { id: "b2", tabId: "B", values: { b_cost: 20 } },
  ];
  rows = applyLinkDelta(rows, tabs, "a1", "la", "b1", true);
  rows = applyLinkDelta(rows, tabs, "a1", "la", "b2", true);
  return { tabs, rows };
};

// --- dependentsOf finds the rollup depending on la ---
{
  const { tabs } = built();
  assert.deepEqual(dependentsOf(tabs, ["la"]), [{ tabId: "A", colId: "roll" }]);
  ok("dependentsOf finds lookup/rollup columns referencing a link column");
}

// --- stripRowEverywhere drops b1 from a1.la ---
{
  const { tabs, rows } = built();
  const { rows: next, removedRefs } = stripRowEverywhere(tabs, rows, "b1", "B");
  assert.ok(!next.some((r) => r.id === "b1"));
  assert.deepEqual(next.find((r) => r.id === "a1").values.la, ["b2"]);
  assert.deepEqual(removedRefs, [{ rowId: "a1", colId: "la", targetId: "b1" }]);
  ok("stripRowEverywhere removes the row + strips it from link cells");
}

// --- deleteLinkColumnPair removes la + lb + the dependent rollup, round-trips ---
{
  const { tabs, rows } = built();
  const { tabs: t2, rows: r2, removed } = deleteLinkColumnPair(tabs, rows, "A", "la");
  const aCols = t2.find((t) => t.id === "A").columns.map((c) => c.id);
  const bCols = t2.find((t) => t.id === "B").columns.map((c) => c.id);
  assert.deepEqual(aCols, ["a_name"]); // la + roll gone
  assert.deepEqual(bCols, ["b_name", "b_cost"]); // lb gone
  assert.ok(!r2.find((r) => r.id === "b1").values.lb); // reverse cells stripped
  assert.equal(removed.columns.length, 3); // la, lb, roll
  const back = restoreLinkRemoval(t2, r2, removed);
  assert.deepEqual(back.tabs.find((t) => t.id === "A").columns.map((c) => c.id), ["a_name", "la", "roll"]);
  assert.deepEqual(back.rows.find((r) => r.id === "b1").values.lb, ["a1"]); // cells restored
  ok("deleteLinkColumnPair strips pair + dependents + cells; restore round-trips");
}

// --- stripTableCascade drops B, strips inbound la + rollup on A ---
{
  const { tabs, rows } = built();
  const { tabs: t2, rows: r2, removed } = stripTableCascade(tabs, rows, "B");
  assert.ok(!t2.some((t) => t.id === "B"));
  assert.ok(!r2.some((r) => r.tabId === "B"));
  assert.deepEqual(t2.find((t) => t.id === "A").columns.map((c) => c.id), ["a_name"]); // la + roll gone
  assert.equal(removed.columns.length, 2); // la + roll (lb went with B)
  ok("stripTableCascade drops the table + inbound link/dependents on other tables");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-links.mjs`
Expected: FAIL — `dependentsOf` not exported.

- [ ] **Step 3: Implement — append to `linkModel.mjs`:**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-links.mjs`
Expected: PASS — `9 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add src/modules/datatable/linkModel.mjs scripts/check-links.mjs
git commit -m "feat(datatable): cross-table link cascades + restore"
```

---

### Task 4: `linkDerive.mjs` — read-side derivations

**Files:**
- Create: `src/modules/datatable/linkDerive.mjs`
- Test: `scripts/check-links.mjs` (extend)

**Interfaces:**
- Consumes: `numberFmt` (model.mjs) — not required if unused; keep zero-dep.
- Produces: `buildCtx(tables, allRows) -> {tableById,rowById,rowsByTab}`; `primaryColumn(table) -> Column|null`; `rowLabel(table,row) -> string`; `linkedRows(row, linkCol, ctx) -> Row[]`; `lookupValues(row, lookupCol, ctx) -> {targetCol, values}`; `rollupValue(row, rollupCol, ctx) -> number|null`.

- [ ] **Step 1: Write the failing test** — append to `scripts/check-links.mjs`:

```js
import {
  buildCtx,
  rowLabel,
  linkedRows,
  lookupValues,
  rollupValue,
} from "../src/modules/datatable/linkDerive.mjs";

{
  const { tabs, rows } = built(); // a1 links b1(10) + b2(20)
  rows.find((r) => r.id === "b1").values.b_name = "Alpha";
  rows.find((r) => r.id === "b2").values.b_name = "Beta";
  const ctx = buildCtx(tabs, rows);
  const a1 = rows.find((r) => r.id === "a1");
  const linkCol = tabs.find((t) => t.id === "A").columns.find((c) => c.id === "la");
  const rollCol = tabs.find((t) => t.id === "A").columns.find((c) => c.id === "roll");

  assert.equal(rowLabel(tabs.find((t) => t.id === "B"), rows.find((r) => r.id === "b1")), "Alpha");
  assert.deepEqual(linkedRows(a1, linkCol, ctx).map((r) => r.id), ["b1", "b2"]);

  const lu = lookupValues(a1, { type: "lookup", lookup: { linkColumnId: "la", targetColumnId: "b_name" } }, ctx);
  assert.equal(lu.targetCol.id, "b_name");
  assert.deepEqual(lu.values, ["Alpha", "Beta"]);

  assert.equal(rollupValue(a1, rollCol, ctx), 30); // sum 10+20
  assert.equal(rollupValue(a1, { type: "rollup", rollup: { linkColumnId: "la", fn: "count" } }, ctx), 2);
  assert.equal(rollupValue(a1, { type: "rollup", rollup: { linkColumnId: "la", targetColumnId: "b_cost", fn: "avg" } }, ctx), 15);
  // dangling: link col gone ⇒ null / []
  assert.equal(rollupValue(a1, { type: "rollup", rollup: { linkColumnId: "nope", targetColumnId: "b_cost", fn: "sum" } }, ctx), null);
  ok("linkDerive: rowLabel / linkedRows / lookupValues / rollupValue (+dangling safe)");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-links.mjs`
Expected: FAIL — cannot find `linkDerive.mjs`.

- [ ] **Step 3: Implement `src/modules/datatable/linkDerive.mjs`:**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-links.mjs`
Expected: PASS — `10 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add src/modules/datatable/linkDerive.mjs scripts/check-links.mjs
git commit -m "feat(datatable): link read-side derivations (label/lookup/rollup)"
```

---

### Task 5: Extend `ColumnSchema` + wire `check:links` + build gate

**Files:**
- Modify: `src/config/schemas.js:200-212` (`ColumnSchema`)
- Modify: `package.json` (add `check:links` script)

**Interfaces:**
- Produces: `ColumnSchema` accepts `type ∈ …|"link"|"lookup"|"rollup"` + optional `link`/`lookup`/`rollup` objects.

- [ ] **Step 1: Extend `ColumnSchema`** in `src/config/schemas.js` — replace the `ColumnSchema` object (lines ~200-212):

```js
const ColumnSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  type: z
    .enum(["text", "number", "date", "select", "multiSelect", "checkbox", "link", "lookup", "rollup"])
    .default("text"),
  width: z.number().default(160),
  number: z
    .object({
      style: z.enum(["plain", "currency"]).default("plain"),
      precision: z.number().int().min(0).max(4).default(0),
    })
    .optional(),
  options: z.array(OptionSchema).optional(),
  // Linked-record configs. PERMISSIVE (no cross-ref validation) — a dangling ref
  // (concurrent delete) must never throw here; derivation is defensive.
  link: z.object({ tableId: z.string(), pairColumnId: z.string(), single: z.boolean().default(false) }).optional(),
  lookup: z.object({ linkColumnId: z.string(), targetColumnId: z.string() }).optional(),
  rollup: z
    .object({
      linkColumnId: z.string(),
      targetColumnId: z.string().optional(),
      fn: z.enum(["sum", "count", "avg", "min", "max"]).default("count"),
    })
    .optional(),
});
```

- [ ] **Step 2: Add the npm script** — in `package.json` `scripts`, after `"check:views"`:

```json
    "check:views": "node scripts/check-views.mjs",
    "check:links": "node scripts/check-links.mjs"
```

- [ ] **Step 3: Run the test + build**

Run: `npm run check:links && npm run build`
Expected: `10 checks passed.` then a green build (`✓ Compiled`, all routes generated). Then `rm -rf .next`.

- [ ] **Step 4: Commit**

```bash
git add src/config/schemas.js package.json
git commit -m "feat(expenses): ColumnSchema accepts link/lookup/rollup + check:links script"
```

---

# STAGE 2 — Link column end-to-end (incl. the picker UI)

### Task 6: Extract `ValueView.jsx` from Grid's `GhostValue` (refactor, no behavior change)

**Files:**
- Create: `src/modules/datatable/cells/ValueView.jsx`
- Modify: `src/modules/datatable/Grid.jsx` (replace `GhostValue` body with `<ValueView>`; keep `ColumnGhost` using it)

**Interfaces:**
- Produces: `ValueView({ column, value })` — read-only render of a value as its column type displays it (moved verbatim from `GhostValue`).

- [ ] **Step 1: Create `cells/ValueView.jsx`** — move the current `GhostValue` function (Grid.jsx lines 36-86) into it, exported as `ValueView`, importing `numberFmt` from `../model.mjs`, `formatNumber` from `../format`, `optionChip` from `../optionColors`:

```jsx
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
        <span className="flex flex-wrap gap-1">
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
```

- [ ] **Step 2: Update `Grid.jsx`** — delete the `GhostValue` function (lines ~34-86), add `import ValueView from "./cells/ValueView";` near the other cell imports (line ~24), and in `ColumnGhost` replace `<GhostValue column={column} value={r.values[column.id]} />` with `<ValueView column={column} value={r.values[column.id]} />`.

- [ ] **Step 3: Build + smoke test**

Run: `npm run build` then the `/expenses` smoke test (background `./node_modules/.bin/next start -p 3199`, poll with python3 until 200, fetch `/expenses`, assert 200 + `expense planner` in HTML, `kill`, `rm -rf .next`).
Expected: green build, `/expenses` 200. Column-drag ghost renders unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/modules/datatable/cells/ValueView.jsx src/modules/datatable/Grid.jsx
git commit -m "refactor(datatable): extract ValueView from Grid GhostValue"
```

---

### Task 7: repo + actions + adapter wiring for links

**Files:**
- Modify: `src/config/repo.js` (imports + new methods + upgrade `removeExpense`/`removeExpenseTab`)
- Modify: `src/config/actions.js` (new server actions)
- Modify: `src/features/expenses/ExpensesDataTable.jsx` (adapter map)

**Interfaces:**
- Produces (repo + actions): `addLinkPair(tabAId, colA, tabBId, colB)`, `addRef(rowId, colId, targetId)`, `removeRef(rowId, colId, targetId)`, `deleteLinkColumn(tabId, colId)`, `restoreLinkColumn(removed)`. `removeExpense`/`removeExpenseTab` now cascade.
- Produces (adapter): same names on `expenseAdapter`.

- [ ] **Step 1: Extend `repo.js` imports** (top block, after the existing `expenseModel.mjs` import) — add the deep-path link cores:

```js
import {
  insertLinkPair,
  applyLinkDelta,
  deleteLinkColumnPair,
  stripRowEverywhere,
  stripTableCascade,
  restoreLinkRemoval,
} from "@/modules/datatable/linkModel.mjs";
```

- [ ] **Step 2: Add repo methods** — inside the `repo` object, in the expense-columns area (after `deleteColumn`, ~line 357):

```js
  // ---- linked-record columns (two-way symmetric) ----
  addLinkPair: (tabAId, colA, tabBId, colB) =>
    mutate((s) => ({ ...s, expenseTabs: insertLinkPair(s.expenseTabs, tabAId, colA, tabBId, colB) })),
  // single-record delta off FRESH state → both sides stay consistent under concurrency
  addRef: (rowId, colId, targetId) =>
    mutate((s) => ({ ...s, expenses: applyLinkDelta(s.expenses, s.expenseTabs, rowId, colId, targetId, true) })),
  removeRef: (rowId, colId, targetId) =>
    mutate((s) => ({ ...s, expenses: applyLinkDelta(s.expenses, s.expenseTabs, rowId, colId, targetId, false) })),
  deleteLinkColumn: (tabId, colId) =>
    mutate((s) => {
      const { tabs, rows } = deleteLinkColumnPair(s.expenseTabs, s.expenses, tabId, colId);
      return { ...s, expenseTabs: tabs, expenses: rows };
    }),
  restoreLinkColumn: (removed) =>
    mutate((s) => {
      const { tabs, rows } = restoreLinkRemoval(s.expenseTabs, s.expenses, removed);
      return { ...s, expenseTabs: tabs, expenses: rows };
    }),
```

- [ ] **Step 3: Upgrade `removeExpense`** (repo.js ~line 302) to cascade link refs:

```js
  removeExpense: (id) =>
    mutate((s) => {
      const row = s.expenses.find((r) => r.id === id);
      if (!row) return s;
      const { rows } = stripRowEverywhere(s.expenseTabs, s.expenses, id, row.tabId);
      return { ...s, expenses: rows };
    }),
```

- [ ] **Step 4: Upgrade `removeExpenseTab`** (repo.js ~line 433) to cascade inbound links. Replace its body:

```js
  removeExpenseTab: (id) =>
    mutate((s) => {
      if (s.expenseTabs.length <= 1) return s; // last-tab protected
      const { tabs, rows } = stripTableCascade(s.expenseTabs, s.expenses, id);
      return { ...s, expenseTabs: tabs, expenses: rows };
    }),
```

- [ ] **Step 5: Add server actions** in `src/config/actions.js` (after `deleteColumn`):

```js
export async function addLinkPair(tabAId, colA, tabBId, colB) {
  await repo.addLinkPair(tabAId, colA, tabBId, colB);
  revalidatePath("/expenses");
}
export async function addRef(rowId, colId, targetId) {
  await repo.addRef(rowId, colId, targetId);
  revalidatePath("/expenses");
}
export async function removeRef(rowId, colId, targetId) {
  await repo.removeRef(rowId, colId, targetId);
  revalidatePath("/expenses");
}
export async function deleteLinkColumn(tabId, colId) {
  await repo.deleteLinkColumn(tabId, colId);
  revalidatePath("/expenses");
}
export async function restoreLinkColumn(removed) {
  await repo.restoreLinkColumn(removed);
  revalidatePath("/expenses");
}
```

- [ ] **Step 6: Wire the adapter** — in `src/features/expenses/ExpensesDataTable.jsx`, import the new actions and add to `expenseAdapter`:

```js
// add to the import list from "@/config/actions":
  addLinkPair,
  addRef,
  removeRef,
  deleteLinkColumn,
  restoreLinkColumn,
```
```js
// add to expenseAdapter (after the options block):
  // links
  addLinkPair,
  addRef,
  removeRef,
  deleteLinkColumn,
  restoreLinkColumn,
```

- [ ] **Step 7: Build + smoke test**

Run: `npm run build` + `/expenses` smoke test (as Task 6 Step 3), then `rm -rf .next`.
Expected: green build, `/expenses` 200 (no UI change yet — wiring only).

- [ ] **Step 8: Commit**

```bash
git add src/config/repo.js src/config/actions.js src/features/expenses/ExpensesDataTable.jsx
git commit -m "feat(expenses): repo/actions/adapter for link pairs, refs, cascades"
```

---

### Task 8: `LinkCell.jsx` picker + `Cell` dispatch + `Grid` cross-table wiring

**Files:**
- Create: `src/modules/datatable/cells/LinkCell.jsx`
- Modify: `src/modules/datatable/Cell.jsx` (dispatch `link`)
- Modify: `src/modules/datatable/Grid.jsx` (accept `link` prop, build `ctx`, pass to cells + `ValueView`/ghost for link)

**Interfaces:**
- Consumes: `buildCtx`, `rowLabel`, `linkedRows` (linkDerive); the `link` prop bundle `{tables, allRows, onAddRef, onRemoveRef, onClearRefs}`.
- Produces: `LinkCell({ column, row, ctx, link })`.

- [ ] **Step 1: Create `cells/LinkCell.jsx`:**

```jsx
"use client";
import { useRef, useState } from "react";
import AnchoredPopover from "../AnchoredPopover";
import { rowLabel, linkedRows } from "../linkDerive.mjs";

// Link cell (the record-picker UI). Chips of linked records' labels; click opens
// a portaled searchable list of the target table's rows. Toggling issues one
// add/remove DELTA (concurrency-safe). `single` renders as radio-style (replace).
export default function LinkCell({ column, row, ctx, link }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const targetTable = ctx.tableById.get(column.link?.tableId);
  const single = !!column.link?.single;
  const chosen = linkedRows(row, column, ctx); // ordered linked rows
  const chosenIds = new Set(chosen.map((r) => r.id));
  const candidates = targetTable ? ctx.rowsByTab.get(targetTable.id) ?? [] : [];

  const openMenu = () => {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setQuery("");
    setOpen(true);
  };
  const toggle = (targetId) => {
    if (chosenIds.has(targetId)) link.onRemoveRef(row.id, column.id, targetId);
    else link.onAddRef(row.id, column.id, targetId);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((r) => rowLabel(targetTable, r).toLowerCase().includes(q))
    : candidates;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={openMenu}
        className="w-full min-h-[32px] flex items-center gap-1 flex-wrap px-2 py-[5px] rounded-[8px] hover:bg-cream-light/60 transition-colors text-left"
      >
        {chosen.length ? (
          chosen.map((r) => (
            <span
              key={r.id}
              className="font-mono text-[.65rem] px-[7px] py-[2px] rounded-pill border border-forest/40 bg-cream-light text-forest flex items-center gap-1"
            >
              {rowLabel(targetTable, r)}
              <span
                role="button"
                aria-label="Remove link"
                onClick={(e) => {
                  e.stopPropagation();
                  link.onRemoveRef(row.id, column.id, r.id);
                }}
                className="text-clay hover:text-forest cursor-pointer"
              >
                ✕
              </span>
            </span>
          ))
        ) : (
          <span className="text-brown-soft/45 text-[.82rem]">—</span>
        )}
      </button>
      {open && (
        <AnchoredPopover rect={rect} onClose={() => setOpen(false)} width={240}>
          {!targetTable ? (
            <div className="px-2 py-2 font-mono text-[.66rem] text-clay">Linked table was deleted.</div>
          ) : (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${targetTable.name}…`}
                className="field-box w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
              />
              {filtered.length === 0 && (
                <div className="px-2 py-1.5 font-mono text-[.64rem] text-brown-soft/70">
                  {candidates.length ? "No matches" : `No records in ${targetTable.name} yet`}
                </div>
              )}
              {filtered.map((r) => {
                const on = chosenIds.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-[7px] hover:bg-cream-light"
                  >
                    <span
                      className={
                        (single ? "rounded-full" : "rounded-[4px]") +
                        " w-[14px] h-[14px] border-2 flex items-center justify-center text-[.55rem] leading-none " +
                        (on ? "bg-forest border-forest text-cream-light" : "border-olive")
                      }
                    >
                      {on ? (single ? "●" : "✓") : ""}
                    </span>
                    <span className="font-mono text-[.67rem] text-forest truncate">{rowLabel(targetTable, r)}</span>
                  </button>
                );
              })}
              {chosen.length > 0 && (
                <button
                  type="button"
                  onClick={() => link.onClearRefs(row.id, column.id)}
                  className="block w-full text-left px-2 py-1.5 mt-1 rounded-[7px] font-mono text-[.6rem] text-clay hover:bg-cream-light border-t border-dashed border-brown-soft/30"
                >
                  Clear all
                </button>
              )}
            </>
          )}
        </AnchoredPopover>
      )}
    </>
  );
}
```

- [ ] **Step 2: Dispatch in `Cell.jsx`** — the current `Cell` only receives `{column, value, onCommit, onCreateOption}`. Link/lookup/rollup need `row` + `ctx` + `link`. Change `Cell`'s signature and add the arms. Replace `Cell.jsx` body:

```jsx
"use client";
import TextCell from "./TextCell";
import NumberCell from "./NumberCell";
import DateCell from "./DateCell";
import SelectCell from "./SelectCell";
import MultiSelectCell from "./MultiSelectCell";
import CheckboxCell from "./CheckboxCell";
import LinkCell from "./LinkCell";

// Dispatch a cell to the right editor by column type. Simple types use
// (value,onCommit); linked types use (row,ctx,link) for cross-table resolution.
export default function Cell({ column, value, row, ctx, link, onCommit, onCreateOption }) {
  switch (column.type) {
    case "number":
      return <NumberCell column={column} value={value} onCommit={onCommit} />;
    case "date":
      return <DateCell value={value} onCommit={onCommit} />;
    case "select":
      return <SelectCell column={column} value={value} onCommit={onCommit} onCreateOption={onCreateOption} />;
    case "multiSelect":
      return <MultiSelectCell column={column} value={value} onCommit={onCommit} onCreateOption={onCreateOption} />;
    case "checkbox":
      return <CheckboxCell value={value} onCommit={onCommit} />;
    case "link":
      return <LinkCell column={column} row={row} ctx={ctx} link={link} />;
    case "text":
    default:
      return <TextCell value={value} onCommit={onCommit} />;
  }
}
```

*(Lookup/rollup arms are added in Stages 3-4.)*

- [ ] **Step 3: Wire `Grid.jsx`** to accept `link` and build `ctx`:
  - Add `link` to the `Grid({...})` props (after `onDeleteOption`).
  - Add `import { buildCtx } from "./linkDerive.mjs";` (top).
  - Inside `Grid`, memoize: `const ctx = useMemo(() => buildCtx(link?.tables ?? [], link?.allRows ?? []), [link?.tables, link?.allRows]);`
  - In `BodyRow`, thread `ctx` + `link` down: add them to `BodyRow`'s props and pass to `<Cell … row={row.original} ctx={ctx} link={link} />`. (Add `ctx` and `link` params to `BodyRow`, and pass `ctx={ctx} link={link}` where `<BodyRow …/>` is rendered.)

Concretely, in the `<Cell>` render inside `BodyRow`:
```jsx
            <Cell
              column={col}
              value={cell.getValue()}
              row={row.original}
              ctx={ctx}
              link={link}
              onCommit={(v) => onSetCell(id, col.id, v)}
              onCreateOption={(name) => onAddOption(col.id, name)}
            />
```
And add `ctx, link` to `BodyRow`'s destructured props, and to the `<BodyRow key=… ctx={ctx} link={link} … />` call in the `tbody` map.

- [ ] **Step 4: Feed the `link` prop from `DataTable.jsx`** — in the `<Grid … />` render, add:
```jsx
        link={{
          tables: tabs,
          allRows: rows,
          onAddRef: (rowId, colId, targetId) => onAddRef(rowId, colId, targetId),
          onRemoveRef: (rowId, colId, targetId) => onRemoveRef(rowId, colId, targetId),
          onClearRefs: (rowId, colId) => onClearRefs(rowId, colId),
        }}
```
The `onAddRef`/`onRemoveRef`/`onClearRefs` handlers are added in Task 9 (they need undo). For this task, add temporary direct handlers so the picker works before undo lands:
```js
  const onAddRef = (rowId, colId, targetId) => applyAddRef(rowId, colId, targetId);
  const onRemoveRef = (rowId, colId, targetId) => applyRemoveRef(rowId, colId, targetId);
  const onClearRefs = (rowId, colId) => {
    const r = rows.find((x) => x.id === rowId);
    for (const t of (Array.isArray(r?.values[colId]) ? r.values[colId] : [])) applyRemoveRef(rowId, colId, t);
  };
```
with the `apply*` primitives (optimistic + adapter), added near the other `apply*`:
```js
  const applyAddRef = (rowId, colId, targetId) => {
    setData((d) => ({ ...d, rows: applyLinkDeltaClient(d.rows, d.tabs, rowId, colId, targetId, true) }));
    startTransition(() => adapter.addRef(rowId, colId, targetId));
  };
  const applyRemoveRef = (rowId, colId, targetId) => {
    setData((d) => ({ ...d, rows: applyLinkDeltaClient(d.rows, d.tabs, rowId, colId, targetId, false) }));
    startTransition(() => adapter.removeRef(rowId, colId, targetId));
  };
```
Import the client copy of the core at the top of `DataTable.jsx`:
```js
import { applyLinkDelta as applyLinkDeltaClient } from "./linkModel.mjs";
```

- [ ] **Step 5: Build + smoke test** (as before), then `rm -rf .next`.
Expected: green build, `/expenses` 200. (You can't create a link column yet — that's Task 9 — but the plumbing compiles.)

- [ ] **Step 6: Commit**

```bash
git add src/modules/datatable/cells/LinkCell.jsx src/modules/datatable/Cell.jsx src/modules/datatable/Grid.jsx src/modules/datatable/DataTable.jsx
git commit -m "feat(datatable): LinkCell picker + Grid cross-table ctx wiring"
```

---

### Task 9: `LinkFieldConfig` (link mode) + `AddColumnPopover` step + create/undo

**Files:**
- Create: `src/modules/datatable/LinkFieldConfig.jsx`
- Modify: `src/modules/datatable/AddColumnPopover.jsx` (config step for link)
- Modify: `src/modules/datatable/DataTable.jsx` (`addLinkPair` handler + undo; finalize ref handlers with undo)
- Modify: `src/modules/datatable/Grid.jsx` (pass `tables` into `AddColumnPopover`)

**Interfaces:**
- Consumes: `link.tables`, `adapter.addLinkPair`.
- Produces: `LinkFieldConfig({ mode:"link", tables, currentTabId, draft, setDraft })`; DataTable `addLinkColumn(name, targetTabId, single)`.

- [ ] **Step 1: Create `LinkFieldConfig.jsx`** (link mode only for now; lookup/rollup modes added in Stages 3-4):

```jsx
"use client";
// The reusable config panel for link/lookup/rollup columns. Rendered inside
// AddColumnPopover (create) and ColumnMenu (edit). This slice = LINK mode.
export default function LinkFieldConfig({ tables, currentTabId, draft, setDraft }) {
  const others = tables.filter((t) => t.id !== currentTabId); // no self-links in v1
  return (
    <div className="mt-1">
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Link to table</div>
      {others.length === 0 ? (
        <div className="px-2 py-1.5 font-mono text-[.64rem] text-clay">Create another sheet first.</div>
      ) : (
        <select
          value={draft.tableId ?? ""}
          onChange={(e) => setDraft({ ...draft, tableId: e.target.value })}
          className="field-select w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
        >
          <option value="" disabled>
            Choose a table…
          </option>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-2 px-1 font-mono text-[.66rem] text-forest cursor-pointer">
        <input
          type="checkbox"
          checked={!!draft.single}
          onChange={(e) => setDraft({ ...draft, single: e.target.checked })}
        />
        Limit to a single record
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Branch `AddColumnPopover.jsx`** — add `link` to `TYPES`, accept `tables` + `currentTabId` + `onCreateLink` props, and render `LinkFieldConfig` when the picked type is `link`. Replace the file:

```jsx
"use client";
import { useState } from "react";
import AnchoredPopover from "./AnchoredPopover";
import LinkFieldConfig from "./LinkFieldConfig";

const TYPES = [
  { type: "text", label: "Text", icon: "📝" },
  { type: "number", label: "Number", icon: "#" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "select", label: "Single select", icon: "◉" },
  { type: "multiSelect", label: "Multi-select", icon: "🏷" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
  { type: "link", label: "Link to table", icon: "🔗" },
];

// Add a column: name + type picker. Link/lookup/rollup open a config step.
export default function AddColumnPopover({ rect, onClose, onCreate, tables = [], currentTabId, onCreateLink }) {
  const [name, setName] = useState("Column");
  const [step, setStep] = useState(null); // null = type list; "link" = config
  const [draft, setDraft] = useState({ single: false });

  const createSimple = (type) => {
    onCreate(name.trim() || "Column", type);
    onClose();
  };
  const confirmLink = () => {
    if (!draft.tableId) return;
    onCreateLink(name.trim() || "Column", draft.tableId, !!draft.single);
    onClose();
  };

  return (
    <AnchoredPopover rect={rect} onClose={onClose} width={230}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder="Field name"
        className="field-box w-full mb-2 py-[6px] px-[10px] text-[.72rem]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !step) createSimple("text");
        }}
      />
      {step === "link" ? (
        <>
          <LinkFieldConfig tables={tables} currentTabId={currentTabId} draft={draft} setDraft={setDraft} />
          <div className="flex gap-1 mt-2">
            <button type="button" onClick={() => setStep(null)} className="flex-1 chip">
              ← Back
            </button>
            <button type="button" onClick={confirmLink} disabled={!draft.tableId} className="flex-1 chip chip--active disabled:opacity-40">
              Create link
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Type</div>
          {TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => (t.type === "link" ? setStep("link") : createSimple(t.type))}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-[7px] font-mono text-[.68rem] text-forest hover:bg-cream-light transition"
            >
              <span className="w-4 text-center">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </>
      )}
    </AnchoredPopover>
  );
}
```

- [ ] **Step 3: Pass `tables`/`currentTabId`/`onCreateLink` into `AddColumnPopover`** from `Grid.jsx`. There is one `<AddColumnPopover … />` render site (gated by `addColRect`; the empty-state ＋ button just sets `addColRect`). Pass:
```jsx
        <AddColumnPopover
          rect={addColRect}
          onClose={() => setAddColRect(null)}
          onCreate={(name, type) => onAddColumn(name, type)}
          tables={link?.tables ?? []}
          currentTabId={/* active tab id */ link?.currentTabId}
          onCreateLink={(name, targetTabId, single) => onAddLinkColumn(name, targetTabId, single)}
        />
```
Add `onAddColumn`'s sibling `onAddLinkColumn` to Grid's props, and add `currentTabId` to the `link` bundle. In `DataTable.jsx` `link={{…}}` add `currentTabId: activeId`, and pass `onAddLinkColumn={addLinkColumn}` to `<Grid>`.

- [ ] **Step 4: `DataTable.jsx` — `addLinkColumn` + finalized ref handlers with undo.** Add:
```js
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
```
Finalize the ref handlers with undo (replace the temporary ones from Task 8 Step 4):
```js
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
```
Add imports at the top of `DataTable.jsx`:
```js
import {
  makeLinkPair as makeLinkPairClient,
  insertLinkPair as insertLinkPairClient,
  deleteLinkColumnPair as deleteLinkColumnPairClient,
  restoreLinkRemoval as restoreLinkRemovalClient,
} from "./linkModel.mjs";
```

- [ ] **Step 5: Build + smoke test**, then `rm -rf .next`.
Expected: green build, `/expenses` 200.

- [ ] **Step 6: Manual E2E in a throwaway sheet** (dev server, `npm run dev` on 3005 — ask the user to run it if a persistent server is needed): create Sheet "B" with a text primary + a number column; on Sheet "A" add a **Link to table → B**; open the link cell, attach a couple of B records; confirm chips; switch to B and confirm the reverse link column shows A's record; Cmd+Z undoes.

- [ ] **Step 7: Commit**

```bash
git add src/modules/datatable/LinkFieldConfig.jsx src/modules/datatable/AddColumnPopover.jsx src/modules/datatable/Grid.jsx src/modules/datatable/DataTable.jsx
git commit -m "feat(datatable): create link columns (paired) + link/unlink undo"
```

---

### Task 10: `ColumnMenu` edit/delete for links + row/table-delete cascade undo

**Files:**
- Modify: `src/modules/datatable/ColumnMenu.jsx` (edit single toggle; route delete)
- Modify: `src/modules/datatable/DataTable.jsx` (delete-pair via cascade; upgrade row/table delete undo to restore refs)
- Modify: `src/modules/datatable/Grid.jsx` (pass link delete/edit handlers to ColumnMenu)

**Interfaces:**
- Consumes: `adapter.deleteLinkColumn`, `applyDeleteLinkPair`, `applyRestoreLinkPair`.
- Produces: link-aware `onDeleteColumn` routing; row/table delete inverse re-adds `removedRefs`.

- [ ] **Step 1: `ColumnMenu.jsx`** — for link columns show "🔗 Single/Multi" toggle + route Delete to the pair cascade. Add props `onToggleSingle`, and branch:
```jsx
  const isLink = column.type === "link";
```
Add, after the `isSelect` block:
```jsx
      {isLink && (
        <button
          type="button"
          className={itemCls + "text-forest"}
          onClick={() => {
            onClose();
            onToggleSingle();
          }}
        >
          {column.link?.single ? "🔗 Allow multiple records" : "🔗 Limit to single record"}
        </button>
      )}
```

- [ ] **Step 2: `Grid.jsx`** — pass link handlers into `<ColumnMenu>`:
```jsx
          onToggleSingle={() => onToggleLinkSingle(colMenu.colId)}
```
and route delete: the existing `onDelete={() => onDeleteColumn(colMenu.colId)}` stays; the branching (pair vs plain) is decided in `DataTable`'s `onDeleteColumn`. Add `onToggleLinkSingle` to Grid props.

- [ ] **Step 3: `DataTable.jsx` — link-aware column delete + single toggle:**
```js
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
```
Make `onDeleteColumn` route link columns to the pair cascade (replace the existing `onDeleteColumn`):
```js
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
    // …existing non-link body unchanged…
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
```

- [ ] **Step 4: Upgrade row-delete undo to restore link refs.** In `applyRemoveRow`, use the cascade + capture the removed refs so undo re-adds them. Replace `applyRemoveRow` + `onDeleteRow`:
```js
  const applyRemoveRow = (id) => {
    setData((d) => {
      const row = d.rows.find((r) => r.id === id);
      if (!row) return d;
      const { rows } = stripRowEverywhereClient(d.tabs, d.rows, id, row.tabId);
      return { ...d, rows };
    });
    startTransition(() => adapter.removeRow(id));
  };
```
```js
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
```
Add the import:
```js
import { stripRowEverywhere as stripRowEverywhereClient } from "./linkModel.mjs";
```
*(Table delete already routes through `applyRemoveTab`→`adapter.removeTable`, which now cascades server-side; its optimistic path should call `stripTableCascade` for parity. Update `applyRemoveTab` to use `stripTableCascadeClient`, and `deleteTab`'s undo to `applyRestoreTab(...)` then `applyRestoreLinkPair(removed)` — capture `removed` via `stripTableCascadeClient(tabs, rows, id)` before removing.)*

```js
import { stripTableCascade as stripTableCascadeClient } from "./linkModel.mjs";
```
```js
  const applyRemoveTab = (id) => {
    setData((d) => {
      const { tabs, rows } = stripTableCascadeClient(d.tabs, d.rows, id);
      return { tabs, rows };
    });
    startTransition(() => adapter.removeTable(id));
  };
```
And in `deleteTab`, capture `const { removed } = stripTableCascadeClient(tabs, rows, id);` before `applyRemoveTab(id)`, and make undo:
```js
      undo: () => {
        applyRestoreTab(tab, index, tabRows);
        applyRestoreLinkPair(removed);
      },
```

- [ ] **Step 5: Exclude display-only types from the Filter/Sort field pickers** (spec §6). In `FilterEditor.jsx` and `SortEditor.jsx`, wherever the field `<select>`/list is built from `columns`, filter out the derived types so a user can't add a no-op filter/sort:
```js
const FILTERABLE = (c) => c.type !== "link" && c.type !== "lookup" && c.type !== "rollup";
// ...columns.filter(FILTERABLE) in the field picker list
```
`HideFieldsMenu.jsx` is left as-is (it lists all columns — you can still hide/show a derived column). `viewModel.mjs` needs no change (stray refs already ignored by its `default` arms).

- [ ] **Step 6: Build + smoke test**, then `rm -rf .next`.

- [ ] **Step 7: Manual E2E (throwaway sheets):** delete a linked record → gone from both sides (undo restores both); delete a link column → pair + any dependent lookup/rollup gone (undo restores); delete a whole linked table → inbound link column on the other sheet disappears (undo restores). Toggle single/multi. Confirm link/lookup/rollup do NOT appear in the Filter/Sort field pickers but DO appear in Hide-fields.

- [ ] **Step 8: Commit**

```bash
git add src/modules/datatable/ColumnMenu.jsx src/modules/datatable/Grid.jsx src/modules/datatable/DataTable.jsx src/modules/datatable/FilterEditor.jsx src/modules/datatable/SortEditor.jsx
git commit -m "feat(datatable): link edit/delete, cross-table delete undo, derived excluded from filter/sort"
```

---

# STAGE 3 — Lookup column

### Task 11: `LookupCell` + lookup config + edit

**Files:**
- Create: `src/modules/datatable/cells/LookupCell.jsx`
- Modify: `src/modules/datatable/Cell.jsx` (dispatch `lookup`), `LinkFieldConfig.jsx` (lookup mode), `AddColumnPopover.jsx` (lookup type + confirm), `Grid.jsx` (ghost arm), `ColumnMenu.jsx` (edit lookup), `DataTable.jsx` (create/edit via existing `addColumn`/`updateColumn`)

**Interfaces:**
- Consumes: `lookupValues` (linkDerive), existing `onAddColumn`/`applyUpdateColumn`.
- Produces: `LookupCell({ column, row, ctx })`; `LinkFieldConfig` `lookup` mode; DataTable `addLookupColumn(name, linkColumnId, targetColumnId)`.

- [ ] **Step 1: Create `cells/LookupCell.jsx`:**

```jsx
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
```

- [ ] **Step 2: Dispatch in `Cell.jsx`** — add `import LookupCell from "./LookupCell";` and the arm:
```jsx
    case "lookup":
      return <LookupCell column={column} row={row} ctx={ctx} />;
```

- [ ] **Step 3: `Grid.jsx` ghost arm** — in `ValueView` there is no lookup case, so the column-drag ghost for a lookup column should render its derived values. In `ColumnGhost`, special-case derived columns to use the live cell render. Simplest: in `ColumnGhost`'s row map, for `column.type === "lookup"` render `<LookupCell column={column} row={r} ctx={ctx} />` instead of `<ValueView>`. Pass `ctx` into `ColumnGhost` (Grid already has it). Add the import to Grid.

- [ ] **Step 4: `LinkFieldConfig.jsx` — lookup mode.** Extend the component to accept `mode` + `columns` (this table's link columns) + `targetColumnsFor(linkColumnId)`. Add a `mode === "lookup"` branch: a link-column `<select>` (options = this table's `type==="link"` columns) + a target-field `<select>` (options = the chosen link's target-table columns, excluding derived). Store `draft.linkColumnId` + `draft.targetColumnId`.

```jsx
      {mode === "lookup" && (
        <div className="mt-1">
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Through link</div>
          <select
            value={draft.linkColumnId ?? ""}
            onChange={(e) => setDraft({ ...draft, linkColumnId: e.target.value, targetColumnId: "" })}
            className="field-select w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
          >
            <option value="" disabled>Choose a link field…</option>
            {linkColumns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Field to show</div>
          <select
            value={draft.targetColumnId ?? ""}
            onChange={(e) => setDraft({ ...draft, targetColumnId: e.target.value })}
            disabled={!draft.linkColumnId}
            className="field-select w-full py-[6px] px-[10px] text-[.7rem] disabled:opacity-40"
          >
            <option value="" disabled>Choose a field…</option>
            {targetColumns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
      )}
```
where `linkColumns` = `columns.filter((c) => c.type === "link")` and `targetColumns` = the columns of `tables.find(id === linkColumns.find(draft.linkColumnId).link.tableId)` filtered to non-derived. Compute these inside `LinkFieldConfig` from the passed `tables`, `columns`, and `draft.linkColumnId`.

- [ ] **Step 5: `AddColumnPopover.jsx`** — add `{ type: "lookup", label: "Lookup", icon: "👁" }` to `TYPES`; picking it sets `step="lookup"`; render `LinkFieldConfig mode="lookup"`; confirm calls `onCreateDerived("lookup", name, draft)` which in `DataTable` builds the column via `onAddColumn`-style path. Pass `columns={link.columns}` (the active tab's full columns) into `AddColumnPopover`.

- [ ] **Step 6: `DataTable.jsx` — `addLookupColumn`.** Reuse the generic column create so undo comes free:
```js
  const addDerivedColumn = (type, name, draft) => {
    const col = { id: uid(), name, type, width: type === "rollup" ? 120 : 180 };
    if (type === "lookup") col.lookup = { linkColumnId: draft.linkColumnId, targetColumnId: draft.targetColumnId };
    if (type === "rollup") col.rollup = { linkColumnId: draft.linkColumnId, targetColumnId: draft.targetColumnId, fn: draft.fn ?? "count" };
    const tabId = activeId;
    applyAddColumn(tabId, col);
    record({ label: `add ${type} field`, undo: () => applyDeleteColumn(tabId, col.id), redo: () => applyAddColumn(tabId, col) });
  };
```
Wire `onCreateDerived={addDerivedColumn}` through Grid → AddColumnPopover. Also add `columns: columns` and `currentTabId: activeId` to the `link` bundle so the config panels have them.

- [ ] **Step 7: `ColumnMenu.jsx` — edit lookup.** For `column.type === "lookup"`, add "👁 Edit lookup" that opens the config in edit mode (a small popover reusing `LinkFieldConfig mode="lookup"`), committing via `applyUpdateColumn(activeId, colId, { lookup: {...} })` with undo. (Mirror the single-toggle undo pattern.)

- [ ] **Step 8: Build + `check:links` + smoke test**, then `rm -rf .next`. Manual: add a lookup on A showing B's name; confirm it lists the linked records' names; change the target field via edit.

- [ ] **Step 9: Commit**

```bash
git add src/modules/datatable/cells/LookupCell.jsx src/modules/datatable/Cell.jsx src/modules/datatable/Grid.jsx src/modules/datatable/LinkFieldConfig.jsx src/modules/datatable/AddColumnPopover.jsx src/modules/datatable/ColumnMenu.jsx src/modules/datatable/DataTable.jsx
git commit -m "feat(datatable): lookup column (config + read-only cell)"
```

---

# STAGE 4 — Rollup column

### Task 12: `RollupCell` + rollup config + edit

**Files:**
- Create: `src/modules/datatable/cells/RollupCell.jsx`
- Modify: `Cell.jsx` (dispatch `rollup`), `LinkFieldConfig.jsx` (rollup mode), `AddColumnPopover.jsx` (rollup type), `Grid.jsx` (ghost arm), `ColumnMenu.jsx` (edit rollup), `DataTable.jsx` (reuses `addDerivedColumn`)

**Interfaces:**
- Consumes: `rollupValue` (linkDerive), `formatNumber`/`numberFmt`.
- Produces: `RollupCell({ column, row, ctx })`; `LinkFieldConfig` `rollup` mode.

- [ ] **Step 1: Create `cells/RollupCell.jsx`:**

```jsx
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
```

- [ ] **Step 2: Dispatch in `Cell.jsx`** — add `import RollupCell from "./RollupCell";` and:
```jsx
    case "rollup":
      return <RollupCell column={column} row={row} ctx={ctx} />;
```

- [ ] **Step 3: `Grid.jsx` ghost arm** — in `ColumnGhost`, render `<RollupCell>` for `column.type === "rollup"` (like the lookup arm in Task 11 Step 3).

- [ ] **Step 4: `LinkFieldConfig.jsx` — rollup mode.** Reuse the lookup mode's **link-field `<select>`** (identical: options = `linkColumns`, sets `draft.linkColumnId`) and its **target-field `<select>`** (options = `targetColumns`, sets `draft.targetColumnId`), and add an aggregation `<select>` (`count/sum/avg/min/max`). Hide the target-field select when `fn === "count"`. The `rollup` branch:
```jsx
      {mode === "rollup" && (
        <div className="mt-1">
          {/* 1) link-field select — copy the lookup mode's linkColumnId <select> verbatim */}
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Through link</div>
          <select
            value={draft.linkColumnId ?? ""}
            onChange={(e) => setDraft({ ...draft, linkColumnId: e.target.value, targetColumnId: "" })}
            className="field-select w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
          >
            <option value="" disabled>Choose a link field…</option>
            {linkColumns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          {/* 2) aggregation */}
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Aggregate</div>
          <select
            value={draft.fn ?? "count"}
            onChange={(e) => setDraft({ ...draft, fn: e.target.value })}
            className="field-select w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
          >
            {["count", "sum", "avg", "min", "max"].map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
          {/* 3) target field — only for numeric aggregations (count needs none) */}
          {draft.fn !== "count" && (
            <>
              <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Number field</div>
              <select
                value={draft.targetColumnId ?? ""}
                onChange={(e) => setDraft({ ...draft, targetColumnId: e.target.value })}
                disabled={!draft.linkColumnId}
                className="field-select w-full py-[6px] px-[10px] text-[.7rem] disabled:opacity-40"
              >
                <option value="" disabled>Choose a field…</option>
                {targetColumns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </>
          )}
        </div>
      )}
```
(`linkColumns` and `targetColumns` are the same derived lists computed in lookup mode — hoist their computation above the `mode` branches so both modes share them.)

- [ ] **Step 5: `AddColumnPopover.jsx`** — add `{ type: "rollup", label: "Rollup", icon: "∑" }`; `step="rollup"`; `LinkFieldConfig mode="rollup"`; confirm → `onCreateDerived("rollup", name, draft)` (already implemented in Task 11's `addDerivedColumn`).

- [ ] **Step 6: `ColumnMenu.jsx` — edit rollup** (change fn / target field), committing `applyUpdateColumn(activeId, colId, { rollup: {...} })` with undo (mirror lookup edit).

- [ ] **Step 7: Build + `check:links` + smoke test**, then `rm -rf .next`. Manual: on A add a rollup **sum** over B's `Cost` through the link → shows the total of the linked records' costs; add a **count** rollup → shows the number of linked records; change fn via edit; delete the link column → the rollup disappears (Task 3/10 cascade); undo restores both.

- [ ] **Step 8: Commit**

```bash
git add src/modules/datatable/cells/RollupCell.jsx src/modules/datatable/Cell.jsx src/modules/datatable/Grid.jsx src/modules/datatable/LinkFieldConfig.jsx src/modules/datatable/AddColumnPopover.jsx src/modules/datatable/ColumnMenu.jsx src/modules/datatable/DataTable.jsx
git commit -m "feat(datatable): rollup column (config + aggregated cell)"
```

---

## Final verification (after Stage 4)
- `npm run check:links` — all pure-core checks pass.
- `npm run check:views` + `npm run check:expenses` — existing tests still pass (no regressions in the shared cores).
- `npm run lint` — clean.
- `npm run build` — green; `rm -rf .next`.
- `/expenses` smoke test — 200 with link + lookup + rollup columns present.
- Manual E2E in a throwaway sheet: full create/link/lookup/rollup/edit/delete/undo loop across two sheets; then delete the throwaway sheets (backstop cleanup). Never touch real team data.
- Optional: `git push -u origin linked-fields` and open a PR (only if the user asks).
