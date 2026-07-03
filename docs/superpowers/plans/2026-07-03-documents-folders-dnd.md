# Documents Folders + Drag-and-Drop Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Documents left sidebar into an organized drag-and-drop tree — create folders + documents, drag documents between/within folders and to root, reorder folders, delete/rename via right-click — with the per-row 🗑 removed.

**Architecture:** One-level folders. The single `docs:index` Redis key grows from a flat meta array into `{ folders, docs }` (each doc carries a nullable `folderId`; array position = order). A dependency-free pure module (`docIndex.mjs`) holds all migration + reorder logic, shared verbatim by the server DAL (`documents.js`), the optimistic client (`DocumentsApp.jsx`), and a Node test harness. `@dnd-kit` drives dragging; the sidebar is split into `DocTree` (DnD host) · `FolderRow` · `DocRow` · `RowMenu`.

**Tech Stack:** Next.js 14 (app router), React 18.3, Tailwind v3, Zod v4, Upstash Redis, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`, Node built-in for the pure-logic test.

## Global Constraints

- **One-level nesting only.** A doc's `folderId` is a folder id or `null` (root). Folders never nest.
- **Deleting a folder promotes its docs to root** (`folderId = null`) — never deletes documents.
- **Delete/rename via right-click context menu** (cursor-portaled, mirroring `DrinkCard.jsx` / `TabBar.jsx`). No visible per-row delete button.
- **Import pure logic with the explicit `.mjs` extension** (`from "./docIndex.mjs"` / `from "@/config/docIndex.mjs"`) so webpack and Node both resolve it unambiguously. `docIndex.mjs` imports NOTHING (no zod, no react) — keeps it Node-testable and out of the client's zod bundle.
- **Order = array position** in both `folders` and `docs`. Reorders send an *anchor* id (`beforeId`), never an absolute array, so the server re-splices off fresh data and concurrent edits survive.
- **Reuse existing tokens/patterns:** `bg-cream-card`, `border-2 border-forest`, `rounded-card`/`rounded-cell`, `font-doodle`, `bg-matcha-fill` (active), `chip chip--active` (buttons), `text-brown-soft` (muted); context menu = `createPortal(document.body)` with a `fixed inset-0 z-[55]` backdrop + `z-[56]` menu; inline rename = swap label for an `input.field-box` committing on Enter/blur, cancel on Escape; per-browser view state via `useLocalState` from `@/lib/useLocalState`.
- `/documents` stays `export const dynamic = "force-dynamic"`.

### Verification recipes (referenced by name in tasks)

- **BUILD:** `npm run build` — must end `✓ Compiled successfully` and generate all routes; `/documents` shown as `ƒ` (dynamic). Runs the Zod parse, catching bad index shapes.
- **LINT:** `npm run lint` — must report no errors (lint does NOT run during build).
- **CHECKDOCS:** `npm run check:docs` — the pure-logic test harness; prints `✅` lines and exits 0.
- **SMOKE /documents:** exercise the dynamic route against the real prod build + Redis, all in ONE shell command (background servers are reaped between turns):

  ```bash
  npm run build >/dev/null 2>&1 && \
  ( ./node_modules/.bin/next start -p 3123 & echo $! > /tmp/mm_docs.pid ) && \
  python3 -c "
  import urllib.request, time, sys
  for _ in range(60):
      try:
          h = urllib.request.urlopen('http://localhost:3123/documents', timeout=2)
          b = h.read().decode('utf-8', 'ignore')
          ok = h.status == 200 and ('New document' in b or 'New folder' in b or 'Notes & docs' in b)
          print('STATUS', h.status, 'MARKUP_OK', ok)
          sys.exit(0 if ok else 1)
      except Exception:
          time.sleep(1)
  print('server never came up'); sys.exit(1)
  "; RC=$?; kill "$(cat /tmp/mm_docs.pid)" 2>/dev/null; rm -rf .next; exit $RC
  ```
  Expected: `STATUS 200 MARKUP_OK True`. (Requires `.env.local` Redis creds, auto-loaded by `next start`.)

### Interface contract (every task honors these exact names/types)

**`src/config/docIndex.mjs`** (pure, no imports):
- `normalizeIndex(raw) → { folders: [{id, name}], docs: [{id, title, updatedAt, folderId}] }` — migrates a legacy array (`raw` is `[]`-shaped) to `{folders:[], docs:raw}`, defaults `name→""`, `title→"Untitled"`, `updatedAt→0`, `folderId→null`; tolerates `null`/`undefined`.
- `moveBefore(list, id, beforeId) → list` — new array with the `{id}`-item pulled and reinserted immediately before `beforeId` (or appended when `beforeId` is `null`/absent).
- `placeDoc(docs, docId, folderId, beforeId) → docs` — sets the moved doc's `folderId`, then positions it before `beforeId`, or (when `beforeId` is `null`) at the end of that folder's group.
- `removeFolder(index, folderId) → { folders, docs }` — drops the folder and sets `folderId = null` on its docs.

**`src/config/documents.js`** exports: `listIndex() → {folders,docs}`, `getDoc(id)`, `createDoc(id, title, folderId = null)`, `updateDoc(id, patch)`, `deleteDoc(id)`, `createFolder(id, name)`, `renameFolder(id, name)`, `deleteFolder(id)`, `moveDoc(docId, folderId, beforeId)`, `moveFolder(folderId, beforeId)`.

**`src/config/actions.js`** adds: `createFolder(id,name)`, `renameFolder(id,name)`, `deleteFolder(id)`, `moveDoc(docId,folderId,beforeId)`, `moveFolder(folderId,beforeId)`; changes `createDoc(id, title, folderId)`. Existing `updateDoc`/`deleteDoc`/`getDoc` unchanged.

**Component props:**
- `RowMenu({ pos:{x,y}, items:[{label, danger?, onClick}], onClose })`
- `DocRow({ doc, indent, active, onSelect, onRename, onDelete })` — `onSelect(id)`, `onRename(id,name)`, `onDelete(id)`.
- `FolderRow({ folder, docs, collapsed, selectedId, onToggle, onSelect, onRenameFolder, onDeleteFolder, onNewDocInFolder, onRenameDoc, onDeleteDoc })`.
- `DocTree({ index, selectedId, collapsed, onToggle, onSelect, onRenameDoc, onDeleteDoc, onRenameFolder, onDeleteFolder, onNewDocInFolder, onMoveDoc, onMoveFolder })` — `onMoveDoc(docId, folderId, beforeId)`, `onMoveFolder(folderId, beforeId)`.
- `DocSidebar({ index, selectedId, onSelect, onNewDoc, onNewFolder, onRenameDoc, onDeleteDoc, onRenameFolder, onDeleteFolder, onNewDocInFolder, onMoveDoc, onMoveFolder })` — owns collapse state internally.

---

### Task 1: Pure index logic + Node test harness + deps

**Files:**
- Create: `src/config/docIndex.mjs`
- Create: `scripts/check-docs.mjs`
- Modify: `package.json` (add dnd-kit deps + `check:docs` script)

**Interfaces:**
- Produces: `normalizeIndex`, `moveBefore`, `placeDoc`, `removeFolder` (signatures in the contract above). Consumed by Tasks 2 and 7.

- [ ] **Step 1: Install the drag-and-drop library**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
Expected: `package.json` dependencies gain `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`; lockfile updates.

- [ ] **Step 2: Add the `check:docs` script to `package.json`**

In the `"scripts"` block, add after `"check:redis"`:
```json
    "check:docs": "node scripts/check-docs.mjs",
```

- [ ] **Step 3: Write the failing test harness `scripts/check-docs.mjs`**

```js
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
```

- [ ] **Step 4: Run the harness to verify it fails**

Run: `npm run check:docs`
Expected: FAIL — `Cannot find module '../src/config/docIndex.mjs'` (module not yet created).

- [ ] **Step 5: Implement `src/config/docIndex.mjs`**

```js
// Pure index logic for the Documents feature — migration, ordering, and folder
// moves. NO imports (no zod, no react) so it is Node-testable (scripts/check-docs.mjs)
// and importable by both the server DAL and the client without dragging deps in.
// The one-level tree lives in a single object: { folders:[{id,name}], docs:[{id,
// title,updatedAt,folderId}] }, order = array position, folderId null = root.

function findLastIndex(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

// Shape/migrate a raw stored value. Legacy stores held a bare meta array; wrap it.
export function normalizeIndex(raw) {
  const base = Array.isArray(raw) ? { folders: [], docs: raw } : (raw ?? {});
  const folders = (base.folders ?? []).map((f) => ({ id: f.id, name: f.name ?? "" }));
  const docs = (base.docs ?? []).map((d) => ({
    id: d.id,
    title: d.title ?? "Untitled",
    updatedAt: d.updatedAt ?? 0,
    folderId: d.folderId ?? null,
  }));
  return { folders, docs };
}

// Reorder a list of {id,...}: pull `id`, reinsert immediately before `beforeId`
// (append when beforeId is null or not found). Returns a new array.
export function moveBefore(list, id, beforeId) {
  if (id === beforeId) return list; // anchoring before itself is a no-op
  const item = list.find((x) => x.id === id);
  if (!item) return list;
  const rest = list.filter((x) => x.id !== id);
  if (beforeId == null) return [...rest, item];
  const idx = rest.findIndex((x) => x.id === beforeId);
  if (idx === -1) return [...rest, item];
  return [...rest.slice(0, idx), item, ...rest.slice(idx)];
}

// Move a doc into `folderId` (null = root). With `beforeId` set, position it
// before that sibling; with null, land it at the end of the target folder's group.
export function placeDoc(docs, docId, folderId, beforeId) {
  const withFolder = docs.map((d) => (d.id === docId ? { ...d, folderId } : d));
  if (beforeId != null) return moveBefore(withFolder, docId, beforeId);
  const moving = withFolder.find((d) => d.id === docId);
  const rest = withFolder.filter((d) => d.id !== docId);
  const last = findLastIndex(rest, (d) => d.folderId === folderId);
  if (last === -1) return [...rest, moving];
  return [...rest.slice(0, last + 1), moving, ...rest.slice(last + 1)];
}

// Delete a folder, promoting its documents to root (never deletes docs).
export function removeFolder(index, folderId) {
  return {
    folders: index.folders.filter((f) => f.id !== folderId),
    docs: index.docs.map((d) => (d.folderId === folderId ? { ...d, folderId: null } : d)),
  };
}
```

- [ ] **Step 6: Run the harness to verify it passes**

Run: `npm run check:docs`
Expected: PASS — eight `✅` lines then `8 checks passed.`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/config/docIndex.mjs scripts/check-docs.mjs
git commit -m "Documents: pure folder/order index logic + dnd-kit deps + check:docs"
```

---

### Task 2: Rewrite `documents.js` to the `{folders,docs}` index

**Files:**
- Modify: `src/config/documents.js` (full rewrite of schemas + functions)
- Test: `npm run check:docs` (unchanged) + CHECKDOCS/BUILD gates

**Interfaces:**
- Consumes: `normalizeIndex`, `placeDoc`, `moveBefore`, `removeFolder` from Task 1.
- Produces: `listIndex`, `getDoc`, `createDoc(id,title,folderId)`, `updateDoc`, `deleteDoc`, `createFolder`, `renameFolder`, `deleteFolder`, `moveDoc`, `moveFolder` (contract above). Consumed by Tasks 3 and 7.

- [ ] **Step 1: Replace `src/config/documents.js` entirely**

```js
import { z } from "zod";
import { redis } from "./redis";
import { normalizeIndex, placeDoc, moveBefore, removeFolder } from "./docIndex.mjs";

// ============================================================================
// DOCUMENTS — shared notes, stored OUTSIDE the global `state` record.
//
// The sidebar tree lives in ONE key, `docs:index`, as { folders, docs } (one-level
// folders; each doc has a nullable folderId; array position = order). Each document
// BODY still lives under its own `doc:<id>` key, so listing/opening stay O(1) and
// large bodies never bloat the index. Pure migration/reorder logic is in
// docIndex.mjs (shared with the client + tested by scripts/check-docs.mjs).
//
// No fallback, no silent errors: if Redis isn't configured we throw loudly.
// ============================================================================

const FolderSchema = z.object({ id: z.string(), name: z.string().default("") });
const DocMetaSchema = z.object({
  id: z.string(),
  title: z.string().default("Untitled"),
  updatedAt: z.number().default(0),
  folderId: z.string().nullable().default(null), // null = root / unfiled
});
// Legacy `docs:index` was a bare meta array; normalizeIndex migrates it on read.
const IndexSchema = z.preprocess(normalizeIndex, z.object({
  folders: z.array(FolderSchema).default([]),
  docs: z.array(DocMetaSchema).default([]),
}));
// The `doc:<id>` body value — placement lives only in the index, not here.
const DocBodySchema = z.object({
  id: z.string(),
  title: z.string().default("Untitled"),
  body: z.string().default(""),
  updatedAt: z.number().default(0),
});

const KEY_INDEX = "docs:index";
const docKey = (id) => "doc:" + id;

function client() {
  if (!redis) {
    throw new Error(
      "Redis is not configured. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN " +
        "(or the KV_REST_API_* pair) in .env.local (dev) and the Vercel project env (prod). " +
        "Shared documents require it — there is no local fallback.",
    );
  }
  return redis;
}

async function readIndex() {
  return IndexSchema.parse((await client().get(KEY_INDEX)) ?? {});
}
async function writeIndex(next) {
  const value = IndexSchema.parse(next);
  await client().set(KEY_INDEX, value);
  return value;
}

export async function listIndex() {
  return readIndex();
}

export async function getDoc(id) {
  const v = await client().get(docKey(id));
  return v == null ? null : DocBodySchema.parse(v);
}

export async function createDoc(id, title, folderId = null) {
  const now = Date.now();
  const doc = DocBodySchema.parse({ id, title: title || "Untitled", body: "", updatedAt: now });
  await client().set(docKey(id), doc);
  const index = await readIndex();
  if (!index.docs.some((d) => d.id === id)) {
    await writeIndex({
      ...index,
      docs: [{ id, title: doc.title, updatedAt: now, folderId }, ...index.docs], // newest first
    });
  }
  return doc;
}

export async function updateDoc(id, patch) {
  const now = Date.now();
  const existing = (await getDoc(id)) ?? { id, title: "Untitled", body: "", updatedAt: now };
  const doc = DocBodySchema.parse({ ...existing, ...patch, id, updatedAt: now });
  await client().set(docKey(id), doc);
  const index = await readIndex();
  await writeIndex({
    ...index,
    docs: index.docs.map((d) => (d.id === id ? { ...d, title: doc.title, updatedAt: now } : d)),
  });
  return doc;
}

export async function deleteDoc(id) {
  await client().del(docKey(id));
  const index = await readIndex();
  await writeIndex({ ...index, docs: index.docs.filter((d) => d.id !== id) });
}

export async function createFolder(id, name) {
  const index = await readIndex();
  if (index.folders.some((f) => f.id === id)) return index;
  return writeIndex({ ...index, folders: [{ id, name: name || "" }, ...index.folders] });
}

export async function renameFolder(id, name) {
  const index = await readIndex();
  return writeIndex({
    ...index,
    folders: index.folders.map((f) => (f.id === id ? { ...f, name } : f)),
  });
}

export async function deleteFolder(id) {
  const index = await readIndex();
  return writeIndex(removeFolder(index, id)); // promotes its docs to root
}

export async function moveDoc(docId, folderId, beforeId) {
  const index = await readIndex();
  return writeIndex({ ...index, docs: placeDoc(index.docs, docId, folderId, beforeId) });
}

export async function moveFolder(folderId, beforeId) {
  const index = await readIndex();
  return writeIndex({ ...index, folders: moveBefore(index.folders, folderId, beforeId) });
}
```

- [ ] **Step 2: Verify the pure tests still pass (logic unchanged)**

Run: CHECKDOCS (`npm run check:docs`)
Expected: PASS — `8 checks passed.`

- [ ] **Step 3: Verify the build compiles the new module (Zod parse + imports)**

Run: BUILD (`npm run build`)
Expected: `✓ Compiled successfully`; note `/documents` will still fail to import in `page.js` until Task 7 — **at this point `page.js` still calls `listDocs()`**, which no longer exists. So DO NOT build in isolation here; instead:

Run: `node -e "import('./src/config/docIndex.mjs').then(m=>console.log(Object.keys(m)))"`
Expected: prints `[ 'normalizeIndex', 'moveBefore', 'placeDoc', 'removeFolder' ]` (sanity that the shared module resolves). The full BUILD gate runs in Task 7 once `page.js` is updated.

- [ ] **Step 4: Commit**

```bash
git add src/config/documents.js
git commit -m "Documents: store folders+docs index in one key; folder/move DAL fns"
```

---

### Task 3: Server actions for folders + moves

**Files:**
- Modify: `src/config/actions.js` (add wrappers; change `createDoc`)

**Interfaces:**
- Consumes: `documents.js` functions from Task 2.
- Produces: `createFolder`, `renameFolder`, `deleteFolder`, `moveDoc`, `moveFolder` actions; `createDoc(id,title,folderId)`. Consumed by Task 7.

- [ ] **Step 1: Update the doc-action block in `src/config/actions.js`**

Find the existing block (currently `createDoc`, `updateDoc`, `deleteDoc`, `getDoc` at the bottom of the file) and replace `createDoc` + append the new actions so the block reads:

```js
export async function createDoc(id, title, folderId = null) {
  const d = await docs.createDoc(id, title, folderId);
  revalidatePath("/documents");
  return d;
}

export async function updateDoc(id, patch) {
  await docs.updateDoc(id, patch);
  revalidatePath("/documents");
}

export async function deleteDoc(id) {
  await docs.deleteDoc(id);
  revalidatePath("/documents");
}

export async function getDoc(id) {
  return docs.getDoc(id);
}

export async function createFolder(id, name) {
  await docs.createFolder(id, name);
  revalidatePath("/documents");
}

export async function renameFolder(id, name) {
  await docs.renameFolder(id, name);
  revalidatePath("/documents");
}

export async function deleteFolder(id) {
  await docs.deleteFolder(id);
  revalidatePath("/documents");
}

export async function moveDoc(docId, folderId, beforeId) {
  await docs.moveDoc(docId, folderId, beforeId);
  revalidatePath("/documents");
}

export async function moveFolder(folderId, beforeId) {
  await docs.moveFolder(folderId, beforeId);
  revalidatePath("/documents");
}
```

- [ ] **Step 2: Verify lint (no build yet — `page.js` still stale until Task 7)**

Run: LINT (`npm run lint`)
Expected: no errors for `src/config/actions.js`.

- [ ] **Step 3: Commit**

```bash
git add src/config/actions.js
git commit -m "Documents: server actions for folder CRUD + doc/folder moves"
```

---

### Task 4: `RowMenu` — shared cursor context menu

**Files:**
- Create: `src/features/documents/RowMenu.jsx`

**Interfaces:**
- Produces: `RowMenu({ pos:{x,y}, items:[{label, danger?, onClick}], onClose })`. Consumed by Tasks 5.

- [ ] **Step 1: Create `src/features/documents/RowMenu.jsx`**

```jsx
"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

// Cursor-anchored context menu portaled to <body> — mirrors DrinkCard/TabBar.
// `.paper-card`/cards clip fixed overlays, so this must portal out. A full-screen
// backdrop closes on click or right-click; Escape also closes.
export default function RowMenu({ pos, items, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[55]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        aria-hidden="true"
      />
      <div
        className="fixed z-[56] min-w-[150px] bg-cream-card border-2 border-forest rounded-[10px] shadow-hard-sm p-1"
        style={{ top: pos.y, left: pos.x }}
      >
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={
              "block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] hover:bg-cream-light transition " +
              (it.danger ? "text-clay" : "text-forest")
            }
          >
            {it.label}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}
```

- [ ] **Step 2: Verify lint**

Run: LINT
Expected: no errors for `RowMenu.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/documents/RowMenu.jsx
git commit -m "Documents: shared RowMenu cursor context menu"
```

---

### Task 5: `DocRow` + `FolderRow` — sortable rows with menu + inline rename

**Files:**
- Create: `src/features/documents/DocRow.jsx`
- Create: `src/features/documents/FolderRow.jsx`

**Interfaces:**
- Consumes: `RowMenu` (Task 4); `@dnd-kit/sortable`, `@dnd-kit/core`, `@dnd-kit/utilities` (Task 1).
- Produces: `DocRow` + `FolderRow` (prop shapes in the contract). Sortable/droppable id + data conventions (relied on by Task 6's `DocTree` drag handlers):
  - doc sortable id `"doc:" + doc.id`, data `{ type:"doc", docId, folderId }`
  - folder sortable id `"folder:" + folder.id`, data `{ type:"folder", folderId }`
  - folder body droppable id `"container:" + folder.id`, data `{ type:"container", folderId }`
  - root droppable id `"container:__root__"`, data `{ type:"container", folderId:null }` (created in Task 6)

- [ ] **Step 1: Create `src/features/documents/DocRow.jsx`**

```jsx
"use client";
import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import RowMenu from "./RowMenu";

// One draggable document row. Click selects; right-click opens Rename/Delete;
// Rename swaps the label for an inline input (Enter/blur commit, Escape cancel).
// `indent` shifts docs that live inside a folder.
export default function DocRow({ doc, indent, active, onSelect, onRename, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: "doc:" + doc.id,
    data: { type: "doc", docId: doc.id, folderId: doc.folderId },
  });
  const [menu, setMenu] = useState(null); // {x,y} | null
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  const startRename = () => {
    setDraft(doc.title || "");
    setEditing(true);
  };
  const commit = () => {
    const v = draft.trim();
    if (v && v !== doc.title) onRename(doc.id, v);
    setEditing(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: indent ? 22 : 8,
  };

  if (editing) {
    return (
      <li>
        <input
          ref={inputRef}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") setEditing(false);
          }}
          aria-label={"Rename " + (doc.title || "Untitled")}
          className="field-box w-full py-[6px] px-[8px] text-[.7rem]"
          style={{ marginLeft: indent ? 14 : 0 }}
        />
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        type="button"
        onClick={() => onSelect(doc.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        title={doc.title}
        className={
          "w-full text-left truncate font-doodle text-[.95rem] rounded-cell pr-2 py-1.5 transition " +
          (active ? "bg-matcha-fill text-forest" : "hover:bg-cream-light")
        }
        style={{ paddingLeft: 8 }}
      >
        {doc.title || "Untitled"}
      </button>
      {menu && (
        <RowMenu
          pos={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "✎ Rename", onClick: startRename },
            { label: "🗑 Delete", danger: true, onClick: () => onDelete(doc.id) },
          ]}
        />
      )}
    </li>
  );
}
```

- [ ] **Step 2: Create `src/features/documents/FolderRow.jsx`**

```jsx
"use client";
import { useState, useRef, useEffect } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import RowMenu from "./RowMenu";
import DocRow from "./DocRow";

// A collapsible folder: a draggable header (reorders folders) + a droppable body
// that holds its DocRows and an end drop-zone. Dropping a doc on the header files
// it into this folder (handled by DocTree via the header's sortable data).
export default function FolderRow({
  folder,
  docs,
  collapsed,
  selectedId,
  onToggle,
  onSelect,
  onRenameFolder,
  onDeleteFolder,
  onNewDocInFolder,
  onRenameDoc,
  onDeleteDoc,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: "folder:" + folder.id,
    data: { type: "folder", folderId: folder.id },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: "container:" + folder.id,
    data: { type: "container", folderId: folder.id },
  });
  const [menu, setMenu] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  const startRename = () => {
    setDraft(folder.name || "");
    setEditing(true);
  };
  const commit = () => {
    const v = draft.trim();
    if (v && v !== folder.name) onRenameFolder(folder.id, v);
    setEditing(false);
  };

  const headerStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li>
      <div ref={setNodeRef} style={headerStyle} {...attributes} {...listeners}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") setEditing(false);
            }}
            aria-label={"Rename folder " + (folder.name || "Untitled")}
            className="field-box w-full py-[6px] px-[8px] text-[.72rem]"
          />
        ) : (
          <div
            className="flex items-center gap-1 rounded-cell px-2 py-1.5 hover:bg-cream-light transition"
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()} // let the chevron click through the drag listeners
              onClick={() => onToggle(folder.id)}
              aria-label={collapsed ? "Expand folder" : "Collapse folder"}
              className="shrink-0 w-4 text-brown-soft"
            >
              {collapsed ? "▸" : "▾"}
            </button>
            <span className="flex-1 min-w-0 truncate font-doodle font-bold text-[.98rem] text-forest">
              📁 {folder.name || "Untitled folder"}
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onNewDocInFolder(folder.id)}
              aria-label={"New document in " + (folder.name || "folder")}
              title="New document here"
              className="shrink-0 px-1 text-brown-soft hover:text-forest transition"
            >
              ＋
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <SortableContext
          items={docs.map((d) => "doc:" + d.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            ref={setDropRef}
            className={"flex flex-col gap-1 py-1 rounded-cell " + (isOver ? "bg-matcha-fill/30" : "")}
          >
            {docs.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                indent
                active={d.id === selectedId}
                onSelect={onSelect}
                onRename={onRenameDoc}
                onDelete={onDeleteDoc}
              />
            ))}
            {docs.length === 0 && (
              <li className="pl-[22px] py-1 font-mono text-[.58rem] text-brown-soft/70 italic">
                drop a doc here
              </li>
            )}
          </ul>
        </SortableContext>
      )}

      {menu && (
        <RowMenu
          pos={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "✎ Rename", onClick: startRename },
            { label: "🗑 Delete folder", danger: true, onClick: () => onDeleteFolder(folder.id) },
          ]}
        />
      )}
    </li>
  );
}
```

- [ ] **Step 3: Verify lint**

Run: LINT
Expected: no errors for `DocRow.jsx` / `FolderRow.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/documents/DocRow.jsx src/features/documents/FolderRow.jsx
git commit -m "Documents: sortable DocRow + collapsible droppable FolderRow"
```

---

### Task 6: `DocTree` (DnD host) + `DocSidebar` rewrite

**Files:**
- Create: `src/features/documents/DocTree.jsx`
- Modify: `src/features/documents/DocSidebar.jsx` (full rewrite)

**Interfaces:**
- Consumes: `FolderRow`, `DocRow` (Task 5); `@dnd-kit/*`.
- Produces: `DocTree` + `DocSidebar` (prop shapes in the contract). Consumed by Task 7.

- [ ] **Step 1: Create `src/features/documents/DocTree.jsx`**

```jsx
"use client";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import FolderRow from "./FolderRow";
import DocRow from "./DocRow";

// Owns the single DndContext. Renders folders (each a sortable header + droppable
// body) then the root docs (a droppable container). onDragEnd resolves a drop into
// either a folder reorder or a doc move (targetFolderId + beforeId anchor).
export default function DocTree({
  index,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
  onRenameDoc,
  onDeleteDoc,
  onRenameFolder,
  onDeleteFolder,
  onNewDocInFolder,
  onMoveDoc,
  onMoveFolder,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // click still selects
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const docsIn = (fid) => index.docs.filter((d) => d.folderId === fid);
  const rootDocs = docsIn(null);
  const { setNodeRef: setRootRef, isOver: rootOver } = useDroppable({
    id: "container:__root__",
    data: { type: "container", folderId: null },
  });

  const onDragEnd = ({ active, over }) => {
    if (!over) return;
    const a = active.data.current;
    const o = over.data.current;
    if (!a || !o) return;

    if (a.type === "folder") {
      if (o.type === "folder" && active.id !== over.id) onMoveFolder(a.folderId, o.folderId);
      return;
    }
    if (a.type === "doc") {
      let folderId, beforeId;
      if (o.type === "doc") {
        folderId = o.folderId;
        beforeId = o.docId;
      } else if (o.type === "container") {
        folderId = o.folderId;
        beforeId = null;
      } else if (o.type === "folder") {
        folderId = o.folderId; // dropped onto a (possibly collapsed) folder header → file into it
        beforeId = null;
      } else {
        return;
      }
      if (a.docId === beforeId) return; // dropped onto itself
      onMoveDoc(a.docId, folderId, beforeId);
    }
  };

  const folderIds = index.folders.map((f) => "folder:" + f.id);
  const rootIds = rootDocs.map((d) => "doc:" + d.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      {/* Folders reorder within THIS context; each folder's docs get their own
          SortableContext inside FolderRow, so the folder header isn't trapped in
          a doc context. */}
      <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1">
          {index.folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              docs={docsIn(folder.id)}
              collapsed={!!collapsed[folder.id]}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onNewDocInFolder={onNewDocInFolder}
              onRenameDoc={onRenameDoc}
              onDeleteDoc={onDeleteDoc}
            />
          ))}
        </ul>
      </SortableContext>

      {/* root / unfiled docs */}
      <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={setRootRef}
          className={"flex flex-col gap-1 mt-1 min-h-[26px] rounded-cell " + (rootOver ? "bg-matcha-fill/30" : "")}
        >
          {rootDocs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              active={d.id === selectedId}
              onSelect={onSelect}
              onRename={onRenameDoc}
              onDelete={onDeleteDoc}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 2: Replace `src/features/documents/DocSidebar.jsx` entirely**

```jsx
"use client";
import { useLocalState } from "@/lib/useLocalState";
import DocTree from "./DocTree";

// Sidebar card: header buttons (＋ New document / ＋ New folder) + the DnD tree.
// Owns only per-browser view state (which folders are collapsed); all data ops
// are callbacks up to DocumentsApp. The per-row 🗑 is gone — delete is right-click.
export default function DocSidebar({
  index,
  selectedId,
  onSelect,
  onNewDoc,
  onNewFolder,
  onRenameDoc,
  onDeleteDoc,
  onRenameFolder,
  onDeleteFolder,
  onNewDocInFolder,
  onMoveDoc,
  onMoveFolder,
}) {
  const [collapsed, setCollapsed] = useLocalState("docs:collapsed", {}); // { [folderId]: true }
  const toggle = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const empty = index.folders.length === 0 && index.docs.length === 0;

  return (
    <div className="bg-cream-card border-2 border-forest rounded-card p-2">
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => onNewDoc(null)}
          className="chip chip--active normal-case tracking-normal flex-1"
        >
          ＋ Document
        </button>
        <button
          type="button"
          onClick={onNewFolder}
          className="chip normal-case tracking-normal flex-1"
        >
          ＋ Folder
        </button>
      </div>

      {empty ? (
        <p className="px-2 py-3 text-center font-mono text-[.66rem] text-brown-soft">
          No documents yet
        </p>
      ) : (
        <DocTree
          index={index}
          selectedId={selectedId}
          collapsed={collapsed}
          onToggle={toggle}
          onSelect={onSelect}
          onRenameDoc={onRenameDoc}
          onDeleteDoc={onDeleteDoc}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onNewDocInFolder={onNewDocInFolder}
          onMoveDoc={onMoveDoc}
          onMoveFolder={onMoveFolder}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify lint (build gate is Task 7, once the app + page are wired)**

Run: LINT
Expected: no errors for `DocTree.jsx` / `DocSidebar.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/documents/DocTree.jsx src/features/documents/DocSidebar.jsx
git commit -m "Documents: DnD tree host + rewritten sidebar (new-folder button, no 🗑)"
```

---

### Task 7: Wire `DocumentsApp` state + `page.js` — build + smoke gate

**Files:**
- Modify: `src/features/documents/DocumentsApp.jsx` (index-shaped state + optimistic ops)
- Modify: `src/app/documents/page.js` (`listIndex` → `initialIndex`)

**Interfaces:**
- Consumes: `DocSidebar` (Task 6); actions from Task 3; pure fns from Task 1; `documents.listIndex` from Task 2.
- Produces: the fully wired feature.

- [ ] **Step 1: Replace `src/features/documents/DocumentsApp.jsx` entirely**

```jsx
"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import {
  createDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  createFolder,
  renameFolder,
  deleteFolder,
  moveDoc,
  moveFolder,
} from "@/config/actions";
import { placeDoc, moveBefore, removeFolder } from "@/config/docIndex.mjs";
import DocSidebar from "./DocSidebar";
import DocEditor from "./DocEditor";

const SAVE_DELAY = 600;

export default function DocumentsApp({ initialIndex }) {
  const [index, setIndex] = useState(initialIndex); // { folders, docs }
  const [selectedId, setSelectedId] = useState(initialIndex.docs[0]?.id ?? null);
  const [bodies, setBodies] = useState({}); // { [id]: { title, body } } — lazy cache
  const timer = useRef(null);
  const [, startTransition] = useTransition();

  // LAZY LOAD the selected doc's body the first time it's opened.
  useEffect(() => {
    if (!selectedId || bodies[selectedId] !== undefined) return;
    let cancelled = false;
    getDoc(selectedId).then((doc) => {
      if (cancelled || !doc) return;
      setBodies((b) => ({ ...b, [selectedId]: { title: doc.title, body: doc.body } }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, bodies]);

  const flushPending = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    const prev = selectedId;
    const cached = prev && bodies[prev];
    if (cached) startTransition(() => updateDoc(prev, { title: cached.title, body: cached.body }));
  };

  const selectDoc = (id) => {
    if (id === selectedId) return;
    flushPending();
    setSelectedId(id);
  };

  // ---- documents ----
  const newDocument = (folderId = null) => {
    flushPending();
    const id = crypto.randomUUID();
    const meta = { id, title: "Untitled", updatedAt: Date.now(), folderId };
    setIndex((ix) => ({ ...ix, docs: [meta, ...ix.docs] }));
    setBodies((b) => ({ ...b, [id]: { title: "Untitled", body: "" } }));
    setSelectedId(id);
    startTransition(() => createDoc(id, "Untitled", folderId));
  };

  const removeDocument = (id) => {
    setIndex((ix) => ({ ...ix, docs: ix.docs.filter((d) => d.id !== id) }));
    setBodies((b) => {
      const next = { ...b };
      delete next[id];
      return next;
    });
    if (id === selectedId) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const remaining = index.docs.filter((d) => d.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
    startTransition(() => deleteDoc(id));
  };

  const renameDocument = (id, title) => {
    setIndex((ix) => ({ ...ix, docs: ix.docs.map((d) => (d.id === id ? { ...d, title } : d)) }));
    setBodies((b) => (b[id] ? { ...b, [id]: { ...b[id], title } } : b));
    startTransition(() => updateDoc(id, { title }));
  };

  const moveDocument = (docId, folderId, beforeId) => {
    setIndex((ix) => ({ ...ix, docs: placeDoc(ix.docs, docId, folderId, beforeId) }));
    startTransition(() => moveDoc(docId, folderId, beforeId));
  };

  // ---- folders ----
  const newFolder = () => {
    const id = crypto.randomUUID();
    setIndex((ix) => ({ ...ix, folders: [{ id, name: "New folder" }, ...ix.folders] }));
    startTransition(() => createFolder(id, "New folder"));
  };

  const renameFolderLocal = (id, name) => {
    setIndex((ix) => ({ ...ix, folders: ix.folders.map((f) => (f.id === id ? { ...f, name } : f)) }));
    startTransition(() => renameFolder(id, name));
  };

  const deleteFolderLocal = (id) => {
    setIndex((ix) => removeFolder(ix, id)); // promotes its docs to root
    startTransition(() => deleteFolder(id));
  };

  const moveFolderLocal = (folderId, beforeId) => {
    setIndex((ix) => ({ ...ix, folders: moveBefore(ix.folders, folderId, beforeId) }));
    startTransition(() => moveFolder(folderId, beforeId));
  };

  // EDIT from the editor — { title } or { body } for the selected doc.
  const onEdit = (patch) => {
    const id = selectedId;
    const merged = { ...bodies[id], ...patch };
    setBodies((b) => ({ ...b, [id]: merged }));
    if (patch.title !== undefined) {
      setIndex((ix) => ({
        ...ix,
        docs: ix.docs.map((d) => (d.id === id ? { ...d, title: patch.title } : d)),
      }));
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      startTransition(() => updateDoc(id, { title: merged.title, body: merged.body }));
    }, SAVE_DELAY);
  };

  return (
    <div className="flex gap-5 max-md:flex-col items-start">
      <div className="w-[240px] max-md:w-full shrink-0 sticky top-[74px] max-md:static">
        <DocSidebar
          index={index}
          selectedId={selectedId}
          onSelect={selectDoc}
          onNewDoc={newDocument}
          onNewFolder={newFolder}
          onRenameDoc={renameDocument}
          onDeleteDoc={removeDocument}
          onRenameFolder={renameFolderLocal}
          onDeleteFolder={deleteFolderLocal}
          onNewDocInFolder={newDocument}
          onMoveDoc={moveDocument}
          onMoveFolder={moveFolderLocal}
        />
      </div>
      <div className="flex-1 min-w-0">
        {selectedId && bodies[selectedId] ? (
          <DocEditor key={selectedId} doc={bodies[selectedId]} onChange={onEdit} />
        ) : (
          <div className="bg-cream-card border-2 border-forest rounded-card min-h-[64vh] grid place-items-center p-8 text-center font-mono text-[.7rem] text-brown-soft">
            {selectedId ? "Loading…" : "No document selected — create one →"}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/documents/page.js`**

Replace the `listDocs` import + usage:
```js
import SectionHeader from "@/components/SectionHeader";
import DocumentsApp from "@/features/documents/DocumentsApp";
import { listIndex } from "@/config/documents";

export const dynamic = "force-dynamic"; // shared docs, read fresh per request

export default async function DocumentsPage() {
  const index = await listIndex();
  return (
    <section>
      <SectionHeader
        num="07"
        kicker="documents"
        title="Notes & docs"
        sub="simple shared markdown docs — checklists, SOPs & ideas · everyone sees the same"
      />
      <DocumentsApp initialIndex={index} />
    </section>
  );
}
```

- [ ] **Step 3: Verify the pure tests, lint, and full build**

Run: CHECKDOCS, then LINT, then BUILD.
Expected: `8 checks passed.`; no lint errors; `✓ Compiled successfully` with `/documents` listed as `ƒ`.

- [ ] **Step 4: Runtime-smoke the dynamic route**

Run: SMOKE /documents (the one-command recipe in Global Constraints).
Expected: `STATUS 200 MARKUP_OK True`.

- [ ] **Step 5: Commit**

```bash
git add src/features/documents/DocumentsApp.jsx src/app/documents/page.js
git commit -m "Documents: wire folders + DnD into the app + page (initialIndex)"
```

---

### Task 8: Update `CLAUDE.md` Documents section

**Files:**
- Modify: `CLAUDE.md` (Documents bullet under Conventions + the `docs:*` store mention)

**Interfaces:** none (docs only).

- [ ] **Step 1: Update the Documents description in `CLAUDE.md`**

Find the `**Documents** (features/documents/…)` bullet and replace it with:

```markdown
- **Documents** (`features/documents/`, `/documents`): an in-app collaborative note editor with a **folder-organized, drag-and-drop sidebar**. `DocumentsApp` owns optimistic `index` state and wires the actions; `DocSidebar` (＋ Document / ＋ Folder buttons, owns per-browser collapse state via `useLocalState` key `docs:collapsed`) hosts `DocTree` (the single `@dnd-kit` `DndContext`), which renders `FolderRow` (collapsible, droppable, sortable header) and `DocRow` (sortable); `RowMenu` is the shared cursor-portaled right-click menu (Rename / Delete — there is **no** visible per-row delete button). `DocEditor` is the TipTap surface. **One-level folders only:** each doc has a nullable `folderId` (null = root). Persisted in its **own** Redis store (`src/config/documents.js`): the sidebar tree is ONE key `docs:index` = `{ folders:[{id,name}], docs:[{id,title,updatedAt,folderId}] }` (array position = order), each doc BODY is a `doc:<id>` key. **Pure migration/reorder logic lives in `src/config/docIndex.mjs`** (`normalizeIndex` — migrates the legacy flat array; `moveBefore`, `placeDoc`, `removeFolder`) — dependency-free, **shared verbatim by the server DAL, the client's optimistic updates, and the Node test `scripts/check-docs.mjs` (`npm run check:docs`)**. Deleting a folder **promotes its docs to root** (never deletes them). Actions: `createFolder/renameFolder/deleteFolder/moveDoc/moveFolder` + `createDoc(id,title,folderId)`, each `revalidatePath('/documents')`. *(Distinct from the external Google business-plan doc below.)*
```

- [ ] **Step 2: Update the `check:*` scripts mention**

Find `Scripts: \`dev\`, \`build\`, \`start\`, \`lint\`, \`lint:fix\`, \`format\`, \`format:check\`, \`check:redis\`.` and append `check:docs` → `…, \`check:redis\`, \`check:docs\`.`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Docs: CLAUDE.md — Documents folders + DnD + docIndex + check:docs"
```

---

## Final verification (run after all tasks)

- [ ] CHECKDOCS → `8 checks passed.`
- [ ] LINT → clean.
- [ ] BUILD → `✓ Compiled successfully`, `/documents` is `ƒ`.
- [ ] SMOKE /documents → `STATUS 200 MARKUP_OK True`.
- [ ] **Interactive dev check** (the human runs `npm run dev` in their own terminal — background servers are reaped here — and confirms):
  - Create a folder and a document from the header buttons.
  - Drag a root doc into a folder; drag it back out to root; reorder two docs within a list.
  - Reorder two folders by dragging their headers.
  - Drop a doc onto a collapsed folder header → it files into that folder.
  - Collapse/expand a folder; reload → collapse state persists (localStorage `docs:collapsed`).
  - Right-click a doc → Rename (inline) and Delete both work; right-click a folder → Rename + Delete folder (its docs pop to root).
  - A plain click still *selects* a doc (doesn't start a drag).
  - Editing a doc's title in the editor still updates its sidebar row live and saves.
  - Legacy check: existing docs appear at root after deploy (migration), unchanged.

## Self-review notes

- **Spec coverage:** folders (Tasks 2/6/7) · drag between/within folders + to root (Tasks 5/6/7) · reorder folders (Tasks 5/6/7) · library `@dnd-kit` (Task 1) · remove per-row 🗑 → right-click menu (Tasks 4/5/6) · `{folders,docs}` migration (Tasks 1/2) · deleting a folder promotes docs (Task 1 `removeFolder`, used in 2/7) · new-folder + new-document buttons (Task 6). All spec sections map to a task.
- **Concurrency:** all server writes re-read the fresh index and apply a single-item delta (`moveBefore`/`placeDoc`/`removeFolder`/filter/map), never an absolute client array.
- **Type consistency:** sortable/droppable id + `data.type` conventions (`doc`/`folder`/`container`) are declared in Task 5's Produces block and consumed unchanged in Task 6's `onDragEnd`. Pure-fn names match across Tasks 1/2/7. Action names match across Tasks 3/7.
```
