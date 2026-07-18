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

// --- linkModel: makeLinkPair, insertLinkPair, applyLinkDelta ---
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

// --- applyLinkDelta: reverse (pair) column single evicts the prior source ---
{
  let tabs = mkTabs();
  const { colA, colB } = makeLinkPair({ tabA: tabs[0], tabB: tabs[1], single: false, idA: "la", idB: "lb" });
  colB.link.single = true; // make the REVERSE column single-record
  tabs = insertLinkPair(tabs, "A", colA, "B", colB);
  let rows = [
    { id: "a1", tabId: "A", values: {} },
    { id: "a2", tabId: "A", values: {} },
    { id: "b1", tabId: "B", values: {} },
  ];
  rows = applyLinkDelta(rows, tabs, "a1", "la", "b1", true);
  rows = applyLinkDelta(rows, tabs, "a2", "la", "b1", true); // reverse single ⇒ b1 drops a1, keeps a2
  assert.deepEqual(rows.find((r) => r.id === "b1").values.lb, ["a2"]);
  assert.deepEqual(rows.find((r) => r.id === "a2").values.la, ["b1"]);
  assert.ok(!("la" in rows.find((r) => r.id === "a1").values)); // a1 lost its forward ref on both sides
  ok("applyLinkDelta reverse-single evicts the prior source on both sides");
}

console.log(`\n${n} checks passed.`);
process.exit(0);
