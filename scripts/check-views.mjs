// Pure-logic tests for the DataTable view engine (filter/sort/visibility) + the
// view-aware cascade & restore cores. No env needed — all pure.
//   npm run check:views
import assert from "node:assert/strict";
import {
  applyView,
  visibleColumns,
  matchesFilters,
  seedValuesFromView,
} from "../src/modules/datatable/viewModel.mjs";
import {
  defaultView,
  stripColumn,
  stripOption,
  captureColumnViewRefs,
  captureOptionViewRefs,
  restoreColumn,
  restoreOption,
  restoreView,
} from "../src/modules/datatable/model.mjs";

let n = 0;
const ok = (msg) => console.log(`✅ ${msg}`) || n++;

// column catalog
const cols = [
  { id: "t", name: "T", type: "text" },
  { id: "n", name: "N", type: "number" },
  { id: "d", name: "D", type: "date" },
  { id: "s", name: "S", type: "select", options: [{ id: "o1", name: "A" }, { id: "o2", name: "B" }, { id: "o3", name: "C" }] },
  { id: "m", name: "M", type: "multiSelect", options: [{ id: "p1" }, { id: "p2" }, { id: "p3" }] },
  { id: "c", name: "C", type: "checkbox" },
];
// match one filter against a values map
const match = (values, filter) => matchesFilters({ values }, cols, [filter]);
const F = (columnId, op, value) => ({ id: "f", columnId, op, value });

// --- defaultView is the fixed-id grid view ---
assert.deepEqual(defaultView(), { id: "view_all", name: "All", type: "grid", filters: [], sorts: [], hiddenColumnIds: [] });
ok("defaultView() is the fixed view_all grid view");

// --- visibleColumns ---
assert.deepEqual(visibleColumns(cols, { hiddenColumnIds: ["n", "d"] }).map((c) => c.id), ["t", "s", "m", "c"]);
assert.deepEqual(visibleColumns(cols, {}).map((c) => c.id), ["t", "n", "d", "s", "m", "c"]);
ok("visibleColumns removes hidden ids, preserves order");

// --- text ops + case-insensitivity + empty≡absent ---
assert.ok(match({ t: "Hello" }, F("t", "is", "hello")));            // case-insensitive
assert.ok(!match({}, F("t", "is", "hello")));                        // empty excluded (positive)
assert.ok(match({ t: "abcd" }, F("t", "contains", "BC")));
assert.ok(match({}, F("t", "isNot", "x")));                          // empty included (negative)
assert.ok(match({}, F("t", "notContains", "x")));                    // empty included
assert.ok(match({}, F("t", "isEmpty")));
assert.ok(match({ t: "x" }, F("t", "isNotEmpty")));
ok("text is/contains case-insensitive; positive excludes empty, negative includes empty");

// --- incomplete (empty-value) filters are IGNORED (match all) ---
assert.ok(match({}, F("t", "is", "")));                              // empty value → skip → true
assert.ok(match({ s: "o1" }, F("s", "isAnyOf", [])));                // isAnyOf [] → skip → true
assert.ok(match({ m: ["p1"] }, F("m", "hasAnyOf", [])));            // hasAnyOf [] → skip → true
assert.ok(match({}, F("m", "hasAllOf", [])));
ok("incomplete filters (empty value) are ignored, never blank the view");

// --- number thresholds are POSITIVE (empty never matches); neq includes empty ---
assert.ok(match({ n: 5 }, F("n", "lt", 10)) && !match({ n: 5 }, F("n", "lt", 5)));
assert.ok(!match({}, F("n", "lt", 10)));                             // empty must NOT match lt
assert.ok(!match({}, F("n", "gte", 0)));                            // empty must NOT match gte
assert.ok(match({ n: 3 }, F("n", "eq", 3)) && !match({ n: 4 }, F("n", "eq", 3)));
assert.ok(match({}, F("n", "neq", 3)));                             // empty included in neq
assert.ok(match({ n: 0 }, F("n", "eq", 0)));                        // 0 is a real value
ok("number lt/lte/gt/gte/eq exclude empty; neq includes empty; 0 is real");

// --- date lexical (ISO) ---
assert.ok(match({ d: "2026-01-01" }, F("d", "before", "2026-02-01")));
assert.ok(match({ d: "2026-03-01" }, F("d", "after", "2026-02-01")));
assert.ok(!match({}, F("d", "before", "2026-02-01")));
ok("date before/after compare ISO strings; empty excluded");

// --- select is (string) vs isAnyOf (array) ---
assert.ok(match({ s: "o1" }, F("s", "is", "o1")) && !match({ s: "o2" }, F("s", "is", "o1")));
assert.ok(match({ s: "o2" }, F("s", "isAnyOf", ["o2", "o3"])) && !match({ s: "o1" }, F("s", "isAnyOf", ["o2", "o3"])));
assert.ok(match({}, F("s", "isNot", "o1")) && !match({ s: "o1" }, F("s", "isNot", "o1"))); // empty included
ok("select is uses a string, isAnyOf uses an array; isNot includes empty");

// --- checkbox: checked=true only, unchecked≡absent ---
assert.ok(match({ c: true }, F("c", "isChecked")) && !match({}, F("c", "isChecked")));
assert.ok(match({}, F("c", "isUnchecked")) && !match({ c: true }, F("c", "isUnchecked")));
ok("checkbox isChecked=true only; isUnchecked matches absent");

// --- multiSelect hasAnyOf / hasAllOf / hasNoneOf incl. empty ---
assert.ok(match({ m: ["p1", "p2"] }, F("m", "hasAnyOf", ["p2", "p3"])));
assert.ok(!match({}, F("m", "hasAnyOf", ["p2"])));                  // empty → false
assert.ok(match({ m: ["p1", "p2"] }, F("m", "hasAllOf", ["p1", "p2"])) && !match({ m: ["p1"] }, F("m", "hasAllOf", ["p1", "p2"])));
assert.ok(match({}, F("m", "hasNoneOf", ["p1"])) && !match({ m: ["p1"] }, F("m", "hasNoneOf", ["p1"]))); // empty → true
ok("multiSelect hasAnyOf/hasAllOf exclude empty; hasNoneOf includes empty");

// --- AND across conditions + dangling column skipped ---
assert.ok(matchesFilters({ values: { t: "x", n: 5 } }, cols, [F("t", "is", "x"), F("n", "gt", 1)]));
assert.ok(!matchesFilters({ values: { t: "x", n: 0 } }, cols, [F("t", "is", "x"), F("n", "gt", 1)]));
assert.ok(matchesFilters({ values: { t: "x" } }, cols, [{ id: "f", columnId: "GONE", op: "is", value: "y" }])); // dangling → skip
ok("matchesFilters ANDs conditions and skips dangling column ids");

// --- sort: empties last in BOTH directions ---
const rows = (vals) => vals.map((v, i) => ({ id: "r" + i, tabId: "t", values: v }));
const ids = (rs) => rs.map((r) => r.id);
const nRows = rows([{ n: 3 }, {}, { n: 1 }, { n: 2 }]);
assert.deepEqual(ids(applyView(nRows, cols, { sorts: [{ columnId: "n", dir: "asc" }] })), ["r2", "r3", "r0", "r1"]); // 1,2,3,empty
assert.deepEqual(ids(applyView(nRows, cols, { sorts: [{ columnId: "n", dir: "desc" }] })), ["r0", "r3", "r2", "r1"]); // 3,2,1,empty(last)
ok("number sort is numeric; empties sink last in asc AND desc");

// --- sort: checkbox exempt from empties-sink (asc ≠ desc) ---
const cRows = rows([{ c: true }, {}, { c: true }, {}]);
assert.deepEqual(ids(applyView(cRows, cols, { sorts: [{ columnId: "c", dir: "asc" }] })), ["r1", "r3", "r0", "r2"]); // unchecked first
assert.deepEqual(ids(applyView(cRows, cols, { sorts: [{ columnId: "c", dir: "desc" }] })), ["r0", "r2", "r1", "r3"]); // checked first
ok("checkbox sort makes two buckets that swap with dir (asc ≠ desc)");

// --- sort: select by option index; dangling optionId sinks ---
const sRows = rows([{ s: "o2" }, { s: "o1" }, { s: "gone" }, {}]);
assert.deepEqual(ids(applyView(sRows, cols, { sorts: [{ columnId: "s", dir: "asc" }] })), ["r1", "r0", "r2", "r3"]); // o1,o2,dangling,empty
ok("select sort orders by option index; dangling optionId sinks below real options");

// --- sort: multi-key (primary then secondary) ---
const mkRows = rows([{ n: 1, t: "b" }, { n: 1, t: "a" }, { n: 0, t: "z" }]);
assert.deepEqual(
  ids(applyView(mkRows, cols, { sorts: [{ columnId: "n", dir: "asc" }, { columnId: "t", dir: "asc" }] })),
  ["r2", "r1", "r0"],
); // n:0 first, then n:1 tie broken by t a<b
ok("multi-key sort applies keys in priority order");

// --- filter THEN sort together ---
const fsRows = rows([{ n: 5, t: "keep" }, { n: 1, t: "keep" }, { n: 9, t: "drop" }]);
assert.deepEqual(
  ids(applyView(fsRows, cols, { filters: [F("t", "is", "keep")], sorts: [{ columnId: "n", dir: "asc" }] })),
  ["r1", "r0"],
);
ok("applyView filters then sorts");

// --- cascade: stripColumn purges the column from views (filters/sorts/hidden) ---
const tabA = {
  id: "t", name: "T", columns: [{ id: "a", type: "text" }, { id: "b", type: "number" }],
  views: [{ id: "v1", filters: [F("a", "is", "x"), F("b", "gt", 1)], sorts: [{ columnId: "a", dir: "asc" }, { columnId: "b", dir: "desc" }], hiddenColumnIds: ["a"] }],
};
const scRefs = captureColumnViewRefs(tabA, "a");
const sc = stripColumn([tabA], [{ id: "r", tabId: "t", values: { a: "x", b: 5 } }], "t", "a");
assert.deepEqual(sc.tabs[0].views[0].filters.map((f) => f.columnId), ["b"]);
assert.deepEqual(sc.tabs[0].views[0].sorts.map((s) => s.columnId), ["b"]);
assert.deepEqual(sc.tabs[0].views[0].hiddenColumnIds, []);
assert.deepEqual(sc.tabs[0].columns.map((c) => c.id), ["b"]);
assert.deepEqual(sc.rows[0].values, { b: 5 });
ok("stripColumn purges the column from every view's filters/sorts/hidden + rows");

// --- restoreColumn merges captured view-refs back by viewId (sorts at index) ---
const rc = restoreColumn(sc.tabs, sc.rows, "t", { id: "a", name: "A", type: "text", width: 160 }, 0, [{ rowId: "r", value: "x" }], scRefs);
assert.deepEqual(rc.tabs[0].columns.map((c) => c.id), ["a", "b"]);
assert.ok(rc.tabs[0].views[0].filters.some((f) => f.columnId === "a"));
assert.deepEqual(rc.tabs[0].views[0].sorts.map((s) => s.columnId), ["a", "b"]); // sort re-inserted at index 0
assert.deepEqual(rc.tabs[0].views[0].hiddenColumnIds, ["a"]);
assert.deepEqual(rc.rows[0].values, { a: "x", b: 5 });
ok("restoreColumn re-inserts the column and merges captured filters/sorts/hidden by viewId");

// --- cascade: stripOption on views (array filtered, emptied dropped, single dropped) ---
const tabB = {
  id: "t", name: "T",
  columns: [{ id: "s", type: "select", options: [{ id: "o1" }, { id: "o2" }] }, { id: "m", type: "multiSelect", options: [{ id: "o1" }, { id: "o2" }] }],
  views: [{
    id: "v1",
    filters: [
      { id: "fs", columnId: "s", op: "is", value: "o2" },              // single → dropped
      { id: "fm1", columnId: "m", op: "hasAnyOf", value: ["o1", "o2"] }, // array → filtered to [o1]
      { id: "fm2", columnId: "m", op: "hasAllOf", value: ["o2"] },       // array emptied → dropped
    ],
    sorts: [], hiddenColumnIds: [],
  }],
};
const soRefsS = captureOptionViewRefs(tabB, "s", "o2");
const soRefsM = captureOptionViewRefs(tabB, "m", "o2");
const soRows = [{ id: "r1", tabId: "t", values: { s: "o2", m: ["o1", "o2"] } }];
let so = stripOption([tabB], soRows, "t", "s", "o2");
so = stripOption(so.tabs, so.rows, "t", "m", "o2");
const soFilters = so.tabs[0].views[0].filters;
assert.ok(!soFilters.some((f) => f.id === "fs"));                    // single dropped
assert.deepEqual(soFilters.find((f) => f.id === "fm1").value, ["o1"]); // array filtered
assert.ok(!soFilters.some((f) => f.id === "fm2"));                   // emptied array dropped
assert.deepEqual(so.rows[0].values, { m: ["o1"] });                 // cell: select cleared, multi filtered
ok("stripOption purges option from view filters (single dropped, array filtered, emptied dropped) + cells");

// --- restoreOption re-applies option refs to fresh views by viewId + filterId ---
let ro = restoreOption(so.tabs, so.rows, "t", "s", { id: "o2", name: "B", color: "clay" }, 1, [{ rowId: "r1", value: "o2" }], soRefsS);
ro = restoreOption(ro.tabs, ro.rows, "t", "m", { id: "o2" }, 1, [], soRefsM);
const roFilters = ro.tabs[0].views[0].filters;
assert.ok(roFilters.some((f) => f.id === "fs" && f.value === "o2"));  // single re-inserted
assert.deepEqual(roFilters.find((f) => f.id === "fm1").value.sort(), ["o1", "o2"]); // array re-added
assert.ok(roFilters.some((f) => f.id === "fm2"));                    // dropped condition re-inserted
ok("restoreOption re-adds option to array filters and re-inserts dropped conditions by filterId");

// --- restoreView re-inserts a deleted view at its index ---
const rvTabs = [{ id: "t", name: "T", columns: [], views: [{ id: "v1" }, { id: "v3" }] }];
const rv = restoreView(rvTabs, "t", { id: "v2" }, 1);
assert.deepEqual(rv[0].views.map((v) => v.id), ["v1", "v2", "v3"]);
ok("restoreView re-inserts the view at its index");

// --- seedValuesFromView (equality-seedable ops only) ---
const seedView = {
  filters: [
    F("t", "is", "hi"),           // seed
    F("n", "eq", 7),              // seed
    F("s", "is", "o1"),           // seed
    F("c", "isChecked"),          // seed true
    F("t", "contains", "x"),      // NOT seedable (ignored — but note t already seeded)
    F("n", "gt", 3),              // NOT seedable
    F("m", "hasAnyOf", ["p1"]),   // NOT seedable
  ],
};
const seed = seedValuesFromView(cols, seedView);
assert.equal(seed.n, 7);
assert.equal(seed.s, "o1");
assert.equal(seed.c, true);
assert.ok(!("m" in seed));
ok("seedValuesFromView seeds only equality-seedable ops (text is / number eq / date is / select is / checkbox isChecked)");

console.log(`\n${n} checks passed.`);
process.exit(0);
