// Pure-logic tests for the expense-planner flexible-table model (migration,
// idempotency, cell helpers, cascades).
//   npm run check:expenses      (no env needed — all pure)
// Mirrors scripts/check-docs.mjs style: prints ✅ per case, exits non-zero on
// the first failure.
import assert from "node:assert/strict";
import {
  DEFAULT_COLUMNS,
  DEFAULT_TAB,
  normalizeExpenses,
  defaultView,
  coerceCell,
  isEmptyValue,
  writeCell,
  cloneValues,
  numberFmt,
  stripColumn,
  stripOption,
  insertAt,
  restoreColumn,
  restoreOption,
  restoreTab,
} from "../src/config/expenseModel.mjs";

let n = 0;
const ok = (msg) => console.log(`✅ ${msg}`) || n++;

// --- migration: legacy flat rows → columns + cells ---
const legacy = {
  expenseTabs: [{ id: "default", name: "Sheet 1" }],
  expenses: [
    { id: "r1", tabId: "default", item: "Matcha", notes: "n", date: "2026-01-01", price: 100, qty: 2 },
  ],
};
const mig = normalizeExpenses(legacy);
assert.deepEqual(mig.expenseTabs[0].columns, DEFAULT_COLUMNS);
assert.deepEqual(mig.expenses[0], {
  id: "r1",
  tabId: "default",
  values: { col_item: "Matcha", col_notes: "n", col_date: "2026-01-01", col_price: 100, col_qty: 2 },
});
assert.ok(!("item" in mig.expenses[0]) && !("price" in mig.expenses[0]));
ok("migration folds legacy tabs→DEFAULT_COLUMNS and rows→values (no legacy keys left)");

// --- migration: injects the fixed default view on any tab without one ---
const mv = normalizeExpenses({ expenseTabs: [{ id: "t", name: "T", columns: [] }], expenses: [] });
assert.deepEqual(mv.expenseTabs[0].views, [defaultView()]);
assert.equal(mv.expenseTabs[0].views[0].id, "view_all");
assert.deepEqual(normalizeExpenses(mv).expenseTabs[0].views, [defaultView()]); // idempotent
ok("migration injects the fixed view_all default view (length-guarded, idempotent)");

// --- migration: empty/blank text folds are omitted; 0 is kept ---
const mig0 = normalizeExpenses({
  expenseTabs: [{ id: "default", name: "S" }],
  expenses: [{ id: "r", tabId: "default", item: "", notes: "", date: "", price: 0, qty: 1 }],
});
assert.deepEqual(mig0.expenses[0].values, { col_price: 0, col_qty: 1 });
ok("migration omits empty text/date cells but keeps price 0 / qty 1");

// --- idempotency ---
for (const [label, X] of [
  ["legacy", legacy],
  ["already-new", mig],
  ["{}", {}],
  ["null", null],
  ["undefined", undefined],
]) {
  assert.deepEqual(normalizeExpenses(normalizeExpenses(X)), normalizeExpenses(X), label);
}
ok("normalizeExpenses is idempotent for legacy / already-new / {} / null / undefined");

// --- empty/default: guarantees ≥1 tab with DEFAULT_COLUMNS ---
for (const X of [{}, null, undefined, { expenseTabs: [] }]) {
  const r = normalizeExpenses(X);
  assert.equal(r.expenseTabs.length, 1);
  assert.equal(r.expenseTabs[0].id, DEFAULT_TAB.id);
  assert.deepEqual(r.expenseTabs[0].columns, DEFAULT_COLUMNS);
  assert.deepEqual(r.expenses, []);
}
ok("empty store / empty tabs → one default tab with DEFAULT_COLUMNS and no rows");

// --- empty-vs-absent: a user-emptied sheet / cleared row is NOT re-seeded ---
const emptied = {
  expenseTabs: [{ id: "t", name: "T", columns: [], views: [defaultView()] }],
  expenses: [{ id: "r", tabId: "t", values: {} }],
};
assert.deepEqual(normalizeExpenses(emptied), emptied);
ok("a fully-migrated tab (columns:[] + views) and a row with values:{} pass through untouched");

// --- fixed ids / formats ---
assert.deepEqual(
  DEFAULT_COLUMNS.map((c) => c.id),
  ["col_item", "col_notes", "col_date", "col_price", "col_qty"],
);
assert.deepEqual(DEFAULT_COLUMNS[3].number, { style: "currency", precision: 2 });
assert.deepEqual(DEFAULT_COLUMNS[4].number, { style: "plain", precision: 0 });
ok("DEFAULT_COLUMNS ids/formats are stable (col_price currency/2, col_qty plain/0)");

// --- isEmptyValue / writeCell ---
assert.ok(isEmptyValue("") && isEmptyValue([]) && isEmptyValue(undefined) && isEmptyValue(NaN));
assert.ok(!isEmptyValue(0) && !isEmptyValue("x") && !isEmptyValue(["a"]));
assert.deepEqual(writeCell({ a: 1 }, "b", 2), { a: 1, b: 2 });
assert.deepEqual(writeCell({ a: 1, b: 2 }, "b", ""), { a: 1 }); // empty → key removed
assert.deepEqual(writeCell({ a: 1 }, "a", 0), { a: 0 }); // 0 is a real value, kept
ok("isEmptyValue + writeCell: empty clears the key, 0 is preserved");

// --- coerceCell ---
const numCol = { id: "c", type: "number" };
assert.equal(coerceCell(numCol, "10"), 10);
assert.equal(coerceCell(numCol, ""), undefined);
assert.equal(coerceCell(numCol, "abc"), undefined);
assert.equal(coerceCell({ type: "text" }, 5), "5");
assert.deepEqual(coerceCell({ type: "multiSelect" }, ["a", "", "b"]), ["a", "b"]);
assert.equal(coerceCell({ type: "select" }, "opt1"), "opt1");
ok("coerceCell enforces the column type ('10'→10, ''→undefined, multiSelect→array)");

// --- checkbox: only `true` is stored; unchecked/anything else = empty ---
assert.equal(coerceCell({ type: "checkbox" }, true), true);
assert.equal(coerceCell({ type: "checkbox" }, false), undefined);
assert.equal(coerceCell({ type: "checkbox" }, "true"), undefined); // strings are not truthy checkboxes
assert.ok(isEmptyValue(false) && !isEmptyValue(true));
assert.deepEqual(writeCell({ a: 1, done: true }, "done", false), { a: 1 }); // unchecking clears the key
assert.deepEqual(writeCell({ a: 1 }, "done", true), { a: 1, done: true }); // checking sets it
ok("checkbox coerces to true-only; false is empty (unchecking clears the cell)");

// --- numberFmt default ---
assert.deepEqual(numberFmt({ type: "number" }), { style: "plain", precision: 0 });
assert.deepEqual(numberFmt({ number: { style: "currency", precision: 2 } }), { style: "currency", precision: 2 });
ok("numberFmt fills the plain/0 default");

// --- cloneValues deep-copies arrays ---
const orig = { a: 1, tags: ["x", "y"] };
const clone = cloneValues(orig);
clone.tags.push("z");
assert.deepEqual(orig.tags, ["x", "y"]); // source untouched
ok("cloneValues deep-copies arrays (duplication won't alias)");

// --- stripColumn: removes column + strips its key from in-tab rows ---
const sc = stripColumn(
  [{ id: "t", name: "T", columns: [{ id: "c1", type: "text" }, { id: "c2", type: "text" }] }],
  [{ id: "r", tabId: "t", values: { c1: "keep", c2: "gone" } }],
  "t",
  "c2",
);
assert.deepEqual(sc.tabs[0].columns.map((c) => c.id), ["c1"]);
assert.deepEqual(sc.rows[0].values, { c1: "keep" });
ok("stripColumn removes the column and strips its cell key");

// --- stripOption: single-value key removed, array filtered ---
const so = stripOption(
  [{ id: "t", name: "T", columns: [{ id: "s", type: "select", options: [{ id: "o1" }, { id: "o2" }] }] }],
  [
    { id: "r1", tabId: "t", values: { s: "o2" } }, // single → key removed
    { id: "r2", tabId: "t", values: { s: ["o1", "o2"] } }, // array → filtered
  ],
  "t",
  "s",
  "o2",
);
assert.deepEqual(so.tabs[0].columns[0].options.map((o) => o.id), ["o1"]);
assert.deepEqual(so.rows[0].values, {}); // single-value cell cleared
assert.deepEqual(so.rows[1].values, { s: ["o1"] }); // array cell filtered
ok("stripOption removes the option, clears single-value cells, filters array cells");

// --- cascades leave OTHER tabs untouched (cross-tab isolation) ---
const twoTab = {
  tabs: [
    { id: "t1", name: "T1", columns: [{ id: "c", type: "text" }] },
    { id: "t2", name: "T2", columns: [{ id: "c", type: "text" }] }, // same colId in another tab
  ],
  rows: [
    { id: "r1", tabId: "t1", values: { c: "one" } },
    { id: "r2", tabId: "t2", values: { c: "two" } }, // must survive untouched
  ],
};
const scIso = stripColumn(twoTab.tabs, twoTab.rows, "t1", "c");
assert.deepEqual(scIso.tabs[1].columns.map((x) => x.id), ["c"]); // t2's column intact
assert.deepEqual(scIso.rows[1].values, { c: "two" }); // t2's row untouched
assert.deepEqual(scIso.rows[0].values, {}); // t1's cell stripped
ok("stripColumn is scoped to its tab — another tab's identical colId is untouched");

// --- coerceCell number edge cases ---
assert.equal(coerceCell({ type: "number" }, 0), 0); // 0 is a real value
assert.equal(coerceCell({ type: "number" }, "  "), undefined); // whitespace → not stored
assert.equal(coerceCell({ type: "number" }, true), undefined); // non-number/string → dropped
assert.deepEqual(writeCell({ a: 1, b: 2 }, "b", []), { a: 1 }); // empty array → key removed
ok("coerceCell drops whitespace/boolean, keeps 0; writeCell drops an emptied array key");

// --- normalizeExpenses tolerates junk elements without throwing ---
assert.doesNotThrow(() => normalizeExpenses({ expenseTabs: [null, 5], expenses: [null, 7] }));
ok("normalizeExpenses does not throw on junk tab/row elements (Zod rejects them downstream)");

// --- insertAt (index clamped) ---
assert.deepEqual(insertAt(["a", "b", "c"], "x", 1), ["a", "x", "b", "c"]);
assert.deepEqual(insertAt(["a", "b"], "x", 0), ["x", "a", "b"]);
assert.deepEqual(insertAt(["a", "b"], "x", 99), ["a", "b", "x"]); // clamped to end
ok("insertAt inserts at a clamped index");

// --- restoreColumn re-inserts the column + restores captured cells ---
const rcTabs = [{ id: "t", name: "T", columns: [{ id: "a", type: "text" }, { id: "b", type: "text" }] }];
const rcRows = [
  { id: "r1", tabId: "t", values: { a: "1" } },
  { id: "r2", tabId: "t", values: { a: "2" } },
];
const deletedCol = { id: "c", name: "Gone", type: "text", width: 160 };
const rc = restoreColumn(rcTabs, rcRows, "t", deletedCol, 1, [{ rowId: "r1", value: "keep-me" }]);
assert.deepEqual(rc.tabs[0].columns.map((c) => c.id), ["a", "c", "b"]); // re-inserted at index 1
assert.deepEqual(rc.rows[0].values, { a: "1", c: "keep-me" }); // cell restored
assert.deepEqual(rc.rows[1].values, { a: "2" }); // untouched row (no captured cell)
ok("restoreColumn re-inserts the column at its index and restores captured cells");

// --- restoreOption re-inserts the option + restores referencing cells ---
const roTabs = [{ id: "t", name: "T", columns: [{ id: "s", type: "multiSelect", options: [{ id: "o1" }] }] }];
const roRows = [{ id: "r1", tabId: "t", values: { s: ["o1"] } }];
const ro = restoreOption(roTabs, roRows, "t", "s", { id: "o2", name: "X", color: "clay" }, 1, [
  { rowId: "r1", value: ["o1", "o2"] },
]);
assert.deepEqual(ro.tabs[0].columns[0].options.map((o) => o.id), ["o1", "o2"]);
assert.deepEqual(ro.rows[0].values, { s: ["o1", "o2"] }); // cell restored to full prior value
ok("restoreOption re-inserts the option and restores the cells that referenced it");

// --- restoreTab re-inserts the sheet + its rows ---
const rtTabs = [{ id: "t1", name: "T1", columns: [] }];
const rtRows = [{ id: "r1", tabId: "t1", values: {} }];
const goneTab = { id: "t2", name: "Gone", columns: [{ id: "c", type: "text" }] };
const goneRows = [{ id: "r2", tabId: "t2", values: { c: "data" } }];
const rt = restoreTab(rtTabs, rtRows, goneTab, 0, goneRows);
assert.deepEqual(rt.tabs.map((t) => t.id), ["t2", "t1"]); // re-inserted at index 0
assert.equal(rt.rows.filter((r) => r.tabId === "t2").length, 1); // its rows back
ok("restoreTab re-inserts the sheet at its index and brings its rows back");

console.log(`\n${n} checks passed.`);
process.exit(0);
