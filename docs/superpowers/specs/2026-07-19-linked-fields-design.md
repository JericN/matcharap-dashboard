# Linked Fields (link · lookup · rollup) — design & implementation contract

**Date:** 2026-07-19 · **Feature:** add three new DataTable column types to the use-agnostic module (`src/modules/datatable/`), consumed by `/expenses`:
- **link** — a two-way symmetric "link to records in another table" field (Airtable-style linked records), with a real record-picker UI,
- **lookup** — a derived field that pulls a chosen field's values from the linked records,
- **rollup** — a derived field that aggregates a chosen numeric field across the linked records (Sum / Count / Average / Min / Max).

This doc is the **single source of truth** for implementation. Every name/shape/signature is **pinned**. Where ambiguous, prefer the existing repo idiom (`model.mjs`, `viewModel.mjs`, `expenseModel.mjs`, `repo.js`, `DataTable.jsx`).

**Guiding constraints:** ship an *Airtable feel*, not Airtable. Essential-only, but **leave clean seams for the deferred work in §12** (don't paint us into a corner). The module stays **use-agnostic** (imports nothing from `@/config` / `@/features`). Behavior-preserving for existing data.

---

## 1. Scope (approved)

| Decision | Choice |
|---|---|
| Link direction | **Two-way symmetric** — creating a link on A→B also creates a reverse link column on B→A, kept in sync. |
| Storage of the two sides | **Store both sides, sync on write** (Airtable's literal model). Each table's link column stores its own id-array cells; edits fan out to patch the paired cells. |
| Write granularity | **Single-record add/remove deltas** off fresh server state (NOT absolute arrays) — matches the repo's concurrency rule so a teammate's concurrent edit to the same cell survives. |
| Records per link cell | **Multiple by default, with a per-column `single` toggle.** Stored as an id array either way. |
| Rollup aggregations | **Sum · Count · Average · Min · Max** (no Concatenate in v1). |
| Filter/sort on link/lookup/rollup | **Display-only in v1** — render values, not filterable/sortable yet. View engine untouched. |

**Explicitly OUT of v1 (deferred — each maps to a reserved seam in §12, not a dead end):**
filter/sort on derived columns · inline "create a new record" from the picker · concatenate/unique/countUnique rollups · multi-hop (chained) lookups · self-links (A→A) · conditional rollups/formulas · changing a link's **target table** after creation.

---

## 2. Module layout (ACTUAL current structure — flat, with a `cells/` subdir)

```
src/modules/datatable/
  linkModel.mjs        // NEW — PURE write-side cores: pairing, add/remove delta + symmetric sync, cross-table cascades
  linkDerive.mjs       // NEW — PURE read-side cores: rowLabel, linkedRows, lookupValues, rollupValue (+ ctx builder)
  model.mjs            // (existing) generic cell/cascade/restore cores — gains `clampIds` + a "link" arm in coerceCell
  viewModel.mjs        // (existing) UNCHANGED behaviorally (new types inert to filter/sort/seed)
  Grid.jsx             // takes ONE new `link` prop bundle (see §5); renders/derives link fields
  Cell.jsx             // dispatcher — +3 arms
  cells/
    ValueView.jsx      // NEW — read-only "render a value as column X would" (extracted from Grid's GhostValue)
    LinkCell.jsx       // NEW — chips + portaled record picker (THE linking UI)
    LookupCell.jsx     // NEW — read-only derived values (reuses ValueView)
    RollupCell.jsx     // NEW — read-only aggregated value
    {Text,Number,Date,Select,MultiSelect,Checkbox}Cell.jsx   // existing
  LinkFieldConfig.jsx  // NEW — the target-table / link-column / field / fn pickers; reused by CREATE and EDIT
  AddColumnPopover.jsx // mounts <LinkFieldConfig> as a second step for link/lookup/rollup
  ColumnMenu.jsx       // "Edit link/lookup/rollup" → mounts the SAME <LinkFieldConfig> (edit mode)
  DataTable.jsx        // wires new adapter methods + optimistic cross-table ops + undo
  ... (unchanged: TableTabs, ViewBar, ViewToolbar, FilterEditor, SortEditor, HideFieldsMenu,
       OptionsEditor, CursorMenu, AnchoredPopover, format.js, optionColors.js, useUndo.js,
       UndoControls.jsx, Toast.jsx, index.js)
```

**Boundary rules (must hold):**
- `linkModel.mjs` + `linkDerive.mjs` are **dependency-free** (no zod/react/dnd-kit), no `"use client"`, use `globalThis.crypto.randomUUID()`. Imported by the client `DataTable` AND the server DAL (`repo.js`) via the **deep path** — never the `index.js` barrel. One physical copy → client-optimistic + server + Node test can't diverge.
- **Dependency direction points downward:** `linkModel`/`linkDerive` → `model.mjs` (for `clampIds`, `writeCell`, `coerceCell`). `model.mjs` never imports the link cores.
- Consumer (`src/config/`) owns Zod, migration, and the new server actions/adapter wiring. The module imports nothing app-specific.

**Why split write vs read cores:** the write-side (mutations/cascades) is imported by `DataTable` + `repo`; the read-side (derivation) is imported by `Grid` + the cells. Splitting keeps each file single-purpose and lets the read-side (the hot path, run per render) stay tiny and obviously pure.

---

## 3. Data model (PINNED)

```
Column (existing, EXTENDED):
  { id, name, type, width, number?, options?, link?, lookup?, rollup? }

  type ∈ "text"|"number"|"date"|"select"|"multiSelect"|"checkbox" | "link"|"lookup"|"rollup"  // +3

  link   = { tableId, pairColumnId, single }    // type==="link"
             tableId       : the OTHER table (tab id) this column links to      [immutable]
             pairColumnId  : id of the reverse link column on `tableId`         [immutable]
             single        : cap this cell to one linked record                 [editable]

  lookup = { linkColumnId, targetColumnId }      // type==="lookup"
             linkColumnId   : a link column ON THIS table                        [immutable]
             targetColumnId : a column id in the linked table                    [editable]

  rollup = { linkColumnId, targetColumnId, fn }  // type==="rollup"
             fn ∈ "sum"|"count"|"avg"|"min"|"max"                                [editable]
             fn==="count" ⇒ targetColumnId unused (= #linked records); field picker hidden.

Row (existing, UNCHANGED shape):
  { id, tabId, values }
  values[linkColumnId] = string[]   // ROW ids in link.tableId (empty ≡ absent key)
  lookup/rollup store NOTHING — fully derived at render.
```

- **`CellValue` unchanged** — link cells reuse the `z.array(z.string())` arm; distinguished from multiSelect purely by column `type`.
- **Zod stays permissive**: `link`/`lookup`/`rollup` are optional objects with string/enum fields and **no cross-reference validation**. A dangling ref (concurrent delete) must **not** throw at `StateSchema` — it's handled defensively at derive time (mirrors `viewModel` skipping dangling filter columns). `type` immutable after creation.
- **No row migration.** New types opt-in; `normalizeExpenses` / preprocess untouched.
- **Primary/label field:** a linked record shows its table's **primary column = first column**. Link/lookup/rollup can't be primary: adding one requires ≥1 existing simple column; `rowLabel` uses the first **labelable** column (text/number/date/select), else `#<id6>`, and never recurses into another link/lookup/rollup.

---

## 4. Pure cores (PINNED signatures)

All functions return **new** objects; never mutate inputs. `clampIds(ids, single) -> string[]` (in `model.mjs`) is the single source of the single/multi cap, used by every writer below.

### 4a. `linkModel.mjs` — write side

**Pairing (create)**
- `makeLinkPair({ tabA, tabB, name, single, idA, idB }) -> { colA, colB }` — builds the two paired columns (width = `DEFAULT_LINK_WIDTH` constant, not per-side). `colB.name` defaults to `tabA.name`; `colB.single=false`; `colA.link.pairColumnId=idB` and vice-versa. Ids minted by the caller (optimistic == server).
- `insertLinkPair(tabs, tabAId, colA, tabBId, colB) -> tabs` — append both columns atomically. (Distinct name from the `addLinkPair` **adapter method** in §7, which calls it.)

**Editing a link — GRANULAR delta (the concurrency-safe write path)**
- `applyLinkDelta(rows, tabs, rowId, colId, targetId, add) -> rows` — the heart, one record at a time:
  1. `add===true`: put `targetId` into `row.values[colId]` (via `clampIds` — a `single` source column first drops its existing target's reverse ref, then sets `[targetId]`); mirror by putting `rowId` into `targetRow.values[pairColumnId]` (respecting the pair's `single`).
  2. `add===false`: remove `targetId` from `row.values[colId]` (drop key if empty); mirror-remove `rowId` from `targetRow.values[pairColumnId]`.
  3. missing target row → no-op (defensive).
  Inverse for undo: the same call with `!add`. This is the ONLY link-cell mutation — "Clear all" issues one remove per current id (batched into one undo command).

**Cross-table cascades (both sides cleaned, capture for undo)**
- `stripRowEverywhere(tabs, rows, rowId, rowTabId) -> { rows, removedRefs }` — remove the row and strip `rowId` **only from link columns whose `link.tableId===rowTabId`** (a row id can only appear there — bounded scan, not a full sweep). `removedRefs=[{rowId,colId,targetId}]` for undo.
- `deleteLinkColumnPair(tabs, rows, tabId, colId) -> { tabs, rows, removed }` — delete `colA` + paired `colB`, strip both columns' cells, drop dependent lookup/rollup via `dependentsOf`, purge view refs for every removed column. `removed = { columns:[{tabId,column,index,cells,viewRefs}] }` — a list of per-column removal records, each in the exact shape the existing `restoreColumn` core already consumes (max reuse).
- `stripTableCascade(tabs, rows, tabId) -> { tabs, rows, removed }` — drop the tab + its rows; on every other table strip link columns whose `link.tableId===tabId`, their dependents, cells, and view refs. Same `removed` shape.
- `dependentsOf(tabs, colIds) -> [{tabId, colId}]` — helper: all lookup/rollup columns whose `linkColumnId ∈ colIds`. Used by both cascades (no duplication).
- `restoreLinkRemoval(tabs, rows, removed) -> { tabs, rows }` — replays the existing `restoreColumn` core for each entry in `removed.columns`; the single undo primitive for both cascades above.

### 4b. `linkDerive.mjs` — read side (display-only; defensive on every dangling ref)
- `buildCtx(tables, allRows) -> ctx` — `{ tableById, rowById, rowsByTab }`, built **once per render** (memoized in `Grid`), so every cell lookup is O(linked-count), never a scan.
- `rowLabel(table, row) -> string` — see §3.
- `linkedRows(row, linkCol, ctx) -> Row[]` — id array → rows, skipping missing ids.
- `lookupValues(row, lookupCol, ctx) -> { targetCol, values: any[] }` — linked records' `targetColumnId` values (+ the resolved target column, so `ValueView` can render each). `[]`/null-safe when link/target/table dangle.
- `rollupValue(row, rollupCol, ctx) -> number | null` — `count`=#linked rows; `sum/avg/min/max` over numeric coercion of each linked `targetColumnId` (empties skipped; `null` when nothing to aggregate or refs dangle).

`coerceCell` (`model.mjs`) gains a **`link`** arm: array of non-empty strings via `clampIds`; `undefined` when empty. `lookup`/`rollup` → `undefined` (never stored); `setExpenseCell` **guards** against writing any derived column.

**Node test:** `scripts/check-links.mjs` (`npm run check:links`, mirrors `check-views.mjs`) covers pairing, `applyLinkDelta` both directions + `single` replace, all 3 cascades incl. `removedRefs`/`removed` round-trip through `restoreLinkRemoval`, and all derivations incl. dangling-ref safety.

---

## 5. Cross-table data into `Grid` (one bundled prop, not scattered)

`DataTable` passes a **single** new prop object (keeps Grid's interface from sprawling):
```
link = {
  tables,                       // all tabs (for the picker + config target-table list)
  allRows,                      // all rows (ctx source)
  onAddRef(rowId, colId, targetId),      // → applyLinkDelta add
  onRemoveRef(rowId, colId, targetId),   // → applyLinkDelta remove
  onClearRefs(rowId, colId),             // → batched removes (one undo)
}
```
`Grid` calls `buildCtx(link.tables, link.allRows)` once (memoized on those identities) and threads `ctx` to the three cells + `LinkFieldConfig`. No new global state; still one active tab rendered.

---

## 6. UI components — including the actual "link things" UI

- **`LinkCell.jsx`** (the linking UI) — shows chips of linked records' `rowLabel` (or `—`). Click → portaled `AnchoredPopover` picker (mirrors `MultiSelectCell`): a search box filters target-table rows **by label**; each row is a toggle (checkbox for multi, radio for `single`); toggling calls `onAddRef`/`onRemoveRef` (one delta each) so it commits live; a per-chip ✕ and a "Clear all" (→ `onClearRefs`). Empty target table → "No records in <Table> yet". *(The "＋ Create record" affordance is a reserved slot — see §12.)*
- **`ValueView.jsx`** — extracted from Grid's current `GhostValue`: given `(column, value)` renders the read-only display for any type (select→chip, number→formatted, etc.). Reused by: the column-drag ghost (Grid), `LookupCell`, and — where a rollup echoes a typed value — `RollupCell`. One renderer, no re-implementation.
- **`LookupCell.jsx`** — read-only; maps `lookupValues(...).values` through `ValueView` (using the resolved **target** column) into chips/text.
- **`RollupCell.jsx`** — read-only; `rollupValue`, formatted with the target column's number format when numeric (`count`→integer).
- **`Cell.jsx`** dispatcher + Grid's `GhostValue` (now `ValueView`) get arms for all three.
- **`LinkFieldConfig.jsx`** — the ONE config panel, driven by `(type, draft, ctx)`, reused by create **and** edit:
  - link → target-table dropdown (other tabs) + single/multi toggle; disabled when no other table / this table has 0 columns.
  - lookup → link-column picker (this table) + target-field picker (linked table).
  - rollup → + aggregation picker; hides the field picker when `fn==="count"`.
- **`AddColumnPopover.jsx`** — new types open `LinkFieldConfig` as step 2; on confirm, link → `addLinkPair`, lookup/rollup → existing `addColumn` with the config.
- **`ColumnMenu.jsx`** — "Edit link/lookup/rollup" opens the same `LinkFieldConfig` in edit mode → an `updateColumn` patch (single toggle / target field / rollup fn). Target **table** + `type` immutable. Delete on a link column routes to the pair-delete cascade.

**View menus:** `FilterEditor`/`SortEditor` **exclude** the 3 new types from their field pickers; `HideFieldsMenu` **includes** them. `viewModel.mjs` unchanged (stray refs already ignored by `default` arms; `seedValuesFromView` never seeds them).

---

## 7. Server actions / adapter / repo (`src/config/`)

New adapter methods (module callback → server action), each `revalidatePath('/expenses')`:
- `addLinkPair(tabAId, colA, tabBId, colB)` → `repo.insertLinkPair`.
- `addRef(rowId, colId, targetId)` / `removeRef(rowId, colId, targetId)` → `repo` runs `applyLinkDelta` on **fresh** state (single-record delta; concurrency-safe).
- `deleteLinkColumn(tabId, colId)` → `repo.deleteLinkColumnPair`.
- `restoreLinkColumn(removed)` → `repo.restoreLinkRemoval` (undo of the pair delete).

Reused/upgraded (signatures unchanged):
- `removeExpense(id)` → `stripRowEverywhere` (bounded cross-table ref strip).
- `removeExpenseTab(id)` → `stripTableCascade`.
- lookup/rollup created via existing `addColumn` (config-only), deleted via existing `deleteColumn`; config edits via existing `updateColumn`.
- `setExpenseCell` guards derived + link columns (they use the delta path).

Client optimistic `setData` calls the **same** pure cores → optimistic == server.

---

## 8. Undo / redo (reuses existing primitives)

- add link pair ↔ delete link pair.
- `addRef` ↔ `removeRef` (single, self-inverse); "Clear all" records one command whose undo re-adds all captured ids.
- delete link column pair ↔ `restoreLinkRemoval(removed)` (columns + cells + dependents + view refs — each entry replays the proven `restoreColumn` core).
- row/table delete undo also restores stripped link refs (`removedRefs` re-added).

---

## 9. Scalability & modularity notes (the review's conclusions)
- **Reads are O(linked-count), never scans** — `buildCtx` makes one Map pass per render; cells resolve by id. (§4b, §5)
- **Bounded cascade scans** — row delete touches only columns targeting that row's table; column/table delete touch only paired + dependent columns. (§4a)
- **Concurrency-safe writes** — single-record deltas off fresh state, never absolute arrays. (§1, §4a, §7)
- **No duplication** — one `clampIds` (single/multi), one `dependentsOf`, one `restoreColumn`-based restore, one `ValueView` renderer, one `LinkFieldConfig` panel for create+edit.
- **Interface stays small** — Grid gets one `link={}` bundle, not five loose props.
- **Layered purity** — write core / read core / model, deps pointing downward; UI on top.

---

## 10. Staged implementation
1. **Schema + `linkModel.mjs` + `linkDerive.mjs` + `clampIds` + `scripts/check-links.mjs`** — no UI. Headless-verifiable.
2. **Link column end-to-end (incl. the picker UI)** — `ValueView` extraction, `LinkFieldConfig` (link mode), `LinkCell` picker + chips + single/multi, add/remove/clear deltas, cascades wired into `repo` + optimistic + undo, Grid `link` bundle, `ColumnMenu` edit/delete.
3. **Lookup column** — `LinkFieldConfig` lookup mode + `LookupCell`.
4. **Rollup column** — `LinkFieldConfig` rollup mode + `RollupCell` + aggregations.

Each stage ends with authoritative checks in the **main loop** (never inside a workflow): `npm run check:links`, `npm run lint`, `npm run build`, `/expenses` runtime smoke test (background `next start`, poll, assert 200 + markup, kill, `rm -rf .next`). Shared-state E2E in a **throwaway sheet** with backstop cleanup — never real data.

## 11. Verification checklist (per stage)
- `npm run check:links` green (pairing, add/remove both ways, single-replace, 3 cascades + restore round-trip, dangling-ref derive safety).
- `npm run build` green (Zod parse with extended `ColumnSchema`).
- `/expenses` 200 with a link/lookup/rollup column present.
- Manual: create link A↔B, attach a record from A's picker → B's reverse cell updates; toggle `single`; delete a linked row → gone both sides; delete a link column → pair + dependents gone; undo each.

## 12. Reserved seams for future work (leave room — don't build now)
Each deferred item has a specific place it will slot in **without reshaping** the above:
- **Filter/sort on derived columns** → `linkDerive` already returns primitive-comparable values (rollup→number, lookup→array). When enabled, `viewModel` calls `linkDerive` with `ctx`; the FilterEditor/SortEditor exclusion list (§6) is the ONE toggle to flip. Keep derived outputs primitive.
- **Inline "create linked record"** → `LinkCell`'s picker keeps a create-affordance slot (like `MultiSelectCell`'s "＋ Create"); it will call an existing `addRow` on the target tab, then `onAddRef`. No new data shape.
- **More rollup fns (concat/unique/countUnique)** → `rollupValue` is a `switch(fn)`; add arms. `fn` is a plain string enum — widen it. Non-numeric aggregation is why `rollupValue` returns `number|null` today but the cell renders via `ValueView` (ready for string output).
- **Multi-hop / chained lookups** → derivation is `ctx`-based; resolving a lookup whose `targetColumnId` is itself a lookup becomes a bounded recursion in `linkDerive`, no schema change.
- **Self-links (A→A)** → structurally already supported (pair both columns on one table); only the config's target-table list currently excludes the current table. One filter to relax.
- **Perf at scale** → all cross-table reads go through `ctx`; a future reverse-adjacency index is a drop-in replacement for the Maps in `buildCtx`, call sites unchanged.
