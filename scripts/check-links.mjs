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
