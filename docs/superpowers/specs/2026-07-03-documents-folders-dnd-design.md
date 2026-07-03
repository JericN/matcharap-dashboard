# Documents: folders + drag-and-drop sidebar — design

**Date:** 2026-07-03
**Feature area:** `src/features/documents/` + `src/config/documents.js` + `src/config/actions.js`
**Status:** Approved (design) — pending spec review

## Goal

Turn the Documents left sidebar from a flat, newest-first list into an organized,
drag-and-drop tree:

- Create **folders** and **documents** from the sidebar.
- **Drag** documents between folders, out to the root, and reorder them manually.
- **Reorder folders** themselves by dragging.
- Remove the per-row 🗑 delete button; deletion moves to a **right-click context menu**.
- The sidebar is just: the tree + a **＋ New document** and **＋ New folder** button.

## Decisions

- **One-level nesting.** A document is either at the **root** (unfiled) or inside exactly
  one folder. Folders never contain other folders.
- **Delete / rename via right-click context menu** at the cursor — the pattern already used
  by `DrinkCard.jsx` and `TabBar.jsx`. No visible delete button in the sidebar.
- **Deleting a folder promotes its documents to root** (`folderId = null`). No document is
  ever lost by removing a folder; delete documents individually to actually remove them.
- **Library: `@dnd-kit`** (`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`).
  Accessible (pointer + keyboard + touch), lightweight, actively maintained; its
  "sortable + multiple containers" pattern maps directly to folders-with-docs.

### Non-goals (YAGNI)

Nested folders, multi-select drag, folder colors/custom icons (beyond 📁), sharing
collapse-state across users, a drag-to-trash target, confirm-on-delete dialogs.

## Data model

Today `docs:index` is a flat array `[{ id, title, updatedAt }]` (newest-first), and each
document body lives under its own `doc:<id>` key. The body keys are unchanged. The index
grows into a single object:

```js
// src/config/documents.js
const FolderSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
});

const DocMetaSchema = z.object({
  id: z.string(),
  title: z.string().default("Untitled"),
  updatedAt: z.number().default(0),
  folderId: z.string().nullable().default(null), // null = root / unfiled
});

// Legacy value was a bare array; wrap it so existing stores migrate on first read.
const IndexSchema = z.preprocess(
  (v) => (Array.isArray(v) ? { folders: [], docs: v } : v),
  z.object({
    folders: z.array(FolderSchema).default([]),
    docs: z.array(DocMetaSchema).default([]),
  }),
);
```

- **Order = array position** in `folders` and in `docs`, mirroring how expense rows already
  work. Dragging reorders the arrays.
- **Rendering:** folders in `folders` order; within a folder, the `docs` whose
  `folderId === folder.id` in `docs` order; then root docs (`folderId === null`) in `docs`
  order.
- **Migration is automatic.** A legacy flat array is wrapped as `{ folders: [], docs: [...] }`
  by the `preprocess`, and `folderId` defaults to `null`, so every existing document appears
  at the root, unchanged. The new shape is persisted on the first write.
- The full-document schema stays `DocSchema = DocMetaSchema.extend({ body })`, so a stored
  `doc:<id>` now also carries `folderId` (harmless; the index is the source of truth for
  placement, and `getDoc` is used only for the body/title).

`DocSchema` (body key) already spreads meta; adding `folderId` there is backward compatible
because it defaults to `null`.

## Data layer — `src/config/documents.js`

All index writers **read-modify-write the fresh index** so a teammate's concurrent edit to a
different doc/folder survives (the app's established single-item-delta pattern).

- `listIndex()` → `{ folders, docs }`. Replaces `listDocs()`.
- `getDoc(id)` — unchanged (reads `doc:<id>`, returns `null` if absent).
- `createDoc(id, title, folderId = null)` — write the `doc:<id>` body; prepend a meta
  `{ id, title, updatedAt, folderId }` to `index.docs` (new docs land at the **top of their
  target list**, matching today's newest-first feel).
- `updateDoc(id, patch)` — unchanged body/title write; keep the matching `index.docs` title
  in sync; never touches `folderId` or order.
- `deleteDoc(id)` — `del doc:<id>`; remove its meta from `index.docs`.
- `createFolder(id, name)` — prepend `{ id, name }` to `index.folders`.
- `renameFolder(id, name)` — rename in place in `index.folders`.
- `deleteFolder(id)` — remove the folder from `index.folders`; set `folderId = null` on every
  doc whose `folderId === id` (promote to root). Bodies are untouched.
- `moveDoc(docId, folderId, beforeId = null)` — single-item delta: remove `docId` from the
  fresh `index.docs`, set its `folderId`, and splice it back in **immediately before** the doc
  whose id is `beforeId` (or at the **end of that folder's group** when `beforeId` is null).
  Only the moved doc changes; all other relative order is preserved.
- `moveFolder(folderId, beforeId = null)` — same splice logic on `index.folders`.

Each writer parses `IndexSchema` on read and write (validate at the boundary; consumers trust
the result).

## Server actions — `src/config/actions.js`

Add thin `"use server"` wrappers, each calling the DAL then `revalidatePath("/documents")`:

- `createFolder(id, name)`, `renameFolder(id, name)`, `deleteFolder(id)`
- `moveDoc(docId, folderId, beforeId)`, `moveFolder(folderId, beforeId)`
- Extend `createDoc(id, title, folderId)` with the optional `folderId`.

`getDoc` remains a read (no revalidate). `updateDoc` / `deleteDoc` unchanged in signature.

## Client state — `DocumentsApp.jsx`

- Prop/state changes from a flat `docs` list to `index = { folders, docs }`
  (`initialDocs` → `initialIndex`; the page passes `listIndex()`).
- All structural ops are **optimistic**: update local `index` immediately, fire the server
  action inside `startTransition`. Mirrors the current create/delete flow.
- `selectedId`, the lazy `bodies` cache, `flushPending`, and the debounced editor save are
  unchanged. `createDocument` gains an optional target `folderId`; delete/move/folder ops are
  new local reducers over `index`.
- When the selected doc is deleted, selection falls back to the first remaining doc in render
  order (same as today).

## Sidebar components (`src/features/documents/`)

The sidebar is split into focused units so no single file owns list + DnD + folders + menus:

- **`DocTree.jsx`** — owns the single `<DndContext>`:
  - Sensors: `PointerSensor` with an activation distance (~5px) so a plain click still
    **selects** rather than starting a drag; `KeyboardSensor` for accessibility. Pointer
    activation constraint keeps touch scrolling working.
  - `SortableContext` over the flattened visible order (folders + their docs + root docs).
  - `onDragEnd` resolves the drop into `(targetFolderId, beforeId)` and calls the optimistic
    `moveDoc` / `moveFolder`.
  - Renders a `<DragOverlay>` floating chip of the row being dragged.
- **`FolderRow.jsx`** — a collapsible folder header (📁 + chevron), styled with the existing
  `bg-cream-card` / `border-forest` tokens. It is a **droppable** that accepts docs; an empty
  folder shows a subtle "drop here" zone. Right-click → context menu (Rename / Delete).
  Collapse/expand toggles a per-browser flag.
- **`DocRow.jsx`** — a **sortable** document row: click selects (`bg-matcha-fill` when active),
  right-click → context menu (Rename / Delete), indented when inside a folder.
- **`RowMenu.jsx`** — one small cursor-portaled context menu (`createPortal` to
  `document.body`, positioned at the click), shared by `FolderRow` and `DocRow`, matching the
  `DrinkCard` / `TabBar` pattern. Escape / outside-click closes.
- **`DocSidebar.jsx`** — the card shell + header buttons **＋ New document** and
  **＋ New folder**, rendering `DocTree`. The per-row 🗑 button is removed.

**Rename** uses inline editing on the row (like `TabBar`'s rename): the label becomes a
`TextField`, Enter/blur commits via `renameFolder` / `updateDoc`, Escape cancels.

**Per-browser state:** folder collapse/expand is stored in `localStorage` (a view preference,
like the existing `calc:*` / `df:*` keys), not in shared Redis.

## Styling

Reuse existing tokens only — `bg-cream-card`, `border-2 border-forest`, `rounded-card` /
`rounded-cell`, `font-doodle` rows, `bg-matcha-fill` active, `chip chip--active` for the
header buttons, `text-brown-soft` muted. Folders carry a 📁 + chevron; docs inside a folder
are indented. No new hex; theming stays CSS-variable driven.

## Concurrency & persistence

- Structural ops (create/rename/delete folder, create/delete doc) and moves are
  **single-item deltas computed server-side off the fresh index**, so a teammate editing a
  different row concurrently is preserved. Reorder sends an *anchor* (`beforeId`), not an
  absolute array, so the server re-splices against current data.
- `/documents` stays `force-dynamic`; a fresh load reads the current index. The client is
  optimistic between loads.

## Verification

- `npm run build` — static generation runs the Zod parse, catching a bad index shape.
- `npm run lint` — lint does not run during build (`eslint.ignoreDuringBuilds`), so run it
  separately.
- Runtime smoke `/documents` — background `next start` on a free port, poll with `python3`
  urllib until up, assert **200 + expected markup**, then kill. Fresh `npm run build` first;
  `rm -rf .next` after.
- **Interactive DnD check (must be done in dev):** the user runs `npm run dev` in their own
  terminal (background servers are reaped here). Confirm: create folder + doc; drag a doc into
  a folder, out to root, and reorder within a list; reorder folders; collapse/expand persists
  across reload; right-click Rename and Delete on both a doc and a folder; deleting a folder
  promotes its docs to root; a plain click still selects (doesn't drag); legacy docs load at
  root after the migration.

## Files touched

- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- `src/config/documents.js` — new index schema + folder/move functions.
- `src/config/actions.js` — new folder/move action wrappers; `createDoc` folderId.
- `src/app/documents/page.js` — `listDocs()` → `listIndex()`, pass `initialIndex`.
- `src/features/documents/DocumentsApp.jsx` — index-shaped state + optimistic ops.
- `src/features/documents/DocSidebar.jsx` — header buttons + hosts `DocTree`; drop 🗑.
- **New:** `DocTree.jsx`, `FolderRow.jsx`, `DocRow.jsx`, `RowMenu.jsx`.
- `CLAUDE.md` — update the Documents section (folders, DnD, context-menu delete, new index
  shape) as part of the change.
