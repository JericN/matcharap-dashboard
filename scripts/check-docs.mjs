// Pure-logic tests for the documents index (folders + ordering + migration).
//   npm run check:docs      (no env needed — all pure)
// Mirrors scripts/check-redis.mjs style: prints ✅ per case, exits non-zero on
// the first failure.
import assert from "node:assert/strict";
import { normalizeIndex, moveBefore, placeDoc, removeFolder } from "../src/config/docIndex.mjs";

let n = 0;
const ok = (msg) => console.log(`✅ ${msg}`) || n++;

// --- normalizeIndex: legacy array migration ---
assert.deepEqual(normalizeIndex([{ id: "a" }]), {
  folders: [],
  docs: [{ id: "a", title: "Untitled", updatedAt: 0, folderId: null }],
});
ok("normalizeIndex migrates a legacy flat array to {folders:[],docs:[...]}");

// --- normalizeIndex: object passes through with defaults ---
assert.deepEqual(
  normalizeIndex({ folders: [{ id: "f" }], docs: [{ id: "a", folderId: "f", title: "T", updatedAt: 5 }] }),
  { folders: [{ id: "f", name: "" }], docs: [{ id: "a", title: "T", updatedAt: 5, folderId: "f" }] },
);
ok("normalizeIndex defaults folder.name and keeps folderId");

// --- normalizeIndex: nullish ---
assert.deepEqual(normalizeIndex(null), { folders: [], docs: [] });
assert.deepEqual(normalizeIndex(undefined), { folders: [], docs: [] });
ok("normalizeIndex tolerates null/undefined");

// --- moveBefore ---
const L = [{ id: "a" }, { id: "b" }, { id: "c" }];
assert.deepEqual(moveBefore(L, "c", "a").map((x) => x.id), ["c", "a", "b"]);
assert.deepEqual(moveBefore(L, "a", null).map((x) => x.id), ["b", "c", "a"]);
assert.deepEqual(moveBefore(L, "a", "a").map((x) => x.id), ["a", "b", "c"]); // before itself = no-op-ish
assert.deepEqual(moveBefore(L, "zzz", "a").map((x) => x.id), ["a", "b", "c"]); // unknown id: unchanged
ok("moveBefore reorders by anchor, appends on null, ignores unknown id");

// --- placeDoc: into a folder at end of that folder's group ---
const D = [
  { id: "1", folderId: null },
  { id: "2", folderId: "f" },
  { id: "3", folderId: null },
];
const p1 = placeDoc(D, "1", "f", null);
assert.deepEqual(p1.map((d) => d.id), ["2", "1", "3"]);
assert.equal(p1.find((d) => d.id === "1").folderId, "f");
ok("placeDoc(null beforeId) files a doc at the end of its target folder group");

// --- placeDoc: before a specific sibling ---
const p2 = placeDoc(D, "3", "f", "2");
assert.deepEqual(p2.map((d) => d.id), ["1", "3", "2"]);
assert.equal(p2.find((d) => d.id === "3").folderId, "f");
ok("placeDoc(beforeId) positions before the anchor sibling");

// --- placeDoc: back out to root ---
const p3 = placeDoc(D, "2", null, null);
assert.equal(p3.find((d) => d.id === "2").folderId, null);
ok("placeDoc moves a doc back to root");

// --- placeDoc: unknown docId is a no-op (never splices undefined) ---
assert.deepEqual(placeDoc(D, "nope", "f", null).map((d) => d.id), ["1", "2", "3"]);
ok("placeDoc ignores an unknown docId instead of splicing undefined");

// --- removeFolder promotes its docs ---
const idx = {
  folders: [{ id: "f", name: "F" }, { id: "g", name: "G" }],
  docs: [{ id: "1", folderId: "f" }, { id: "2", folderId: null }, { id: "3", folderId: "g" }],
};
const r = removeFolder(idx, "f");
assert.deepEqual(r.folders.map((f) => f.id), ["g"]);
assert.equal(r.docs.find((d) => d.id === "1").folderId, null);
assert.equal(r.docs.find((d) => d.id === "3").folderId, "g");
ok("removeFolder drops the folder and promotes only its docs to root");

console.log(`\n${n} checks passed.`);
process.exit(0);
