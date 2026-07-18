# Linked Fields (link · lookup · rollup) — design & implementation contract

**Date:** 2026-07-19 · **Feature:** add three new DataTable column types to the use-agnostic module (`src/modules/datatable/`), consumed by `/expenses`:
- **link** — a two-way symmetric "link to records in another table" field (Airtable-style linked records),
- **lookup** — a derived field that pulls a chosen field's values from the linked records,
- **rollup** — a derived field that aggregates a chosen numeric field across the linked records (Sum / Count / Average / Min / Max).

This doc is the **single source of truth** for implementation. Every name/shape/signature is **pinned**. Where ambiguous, prefer the existing repo idiom (`model.mjs`, `viewModel.mjs`, `expenseModel.mjs`, `repo.js`, `DataTable.jsx`).

**Guiding constraint:** ship an *Airtable feel*, not Airtable. Essential-only. Behavior-preserving for existing data. The module stays **use-agnostic** (imports nothing from `@/config` / `@/features`).

---

## 1. Scope (approved)

Decisions locked with the user:

| Decision | Choice |
|---|---|
| Link direction | **Two-way symmetric** — creating a link on A→B also creates a reverse link column on B→A, kept in sync. |
| Storage of the two sides | **Store both sides, sync on write** (Airtable's literal model). Each table's link column stores its own id-array cells; edits fan out to patch the paired cells. |
| Records per link cell | **Multiple by default, with a per-column `single` toggle.** Stored as an id array either way. |
| Rollup aggregations | **Sum · Count · Average · Min · Max** (no Concatenate in v1). |
| Filter/sort on link/lookup/rollup | **Display-only in v1** — these columns render values but are not filterable/sortable. The view engine is left essentially untouched. |

**Explicitly OUT (do not add in v1), called out rather than silently dropped:**
- Filtering & sorting on link / lookup / rollup columns (view engine stays as-is; new types are inert to filter/sort/seed).
- Inline "create a new record in the target table" from the link picker (you add rows in the target sheet directly).
- Concatenate / unique / countUnique / any non-numeric rollup.
- Lookup/rollup across more than one hop (no chained links).
- Conditional rollups, rollup over lookups, formulas.
- Changing a link column's **target table** after creation (immutable, like `type`).

---

## 2. Where the code lives (module layout — ACTUAL current structure, flat)

```
src/modules/datatable/
  linkModel.mjs        // NEW — PURE, zero-import cores: pairing, sync, cross-table cascades, derivation (lookup/rollup), row-label
  model.mjs            // (existing) generic cell/cascade/restore cores — coerceCell gains a "link" arm
  viewModel.mjs        // (existing) UNCHANGED behaviorally — new types are inert to filter/sort
  Grid.jsx             // receives cross-table data (tables + allRows) to render/derive link fields
  Cell.jsx             // dispatcher — +3 arms
  cells/
    LinkCell.jsx       // NEW — chips + portaled record picker
    LookupCell.jsx     // NEW — read-only derived values
    RollupCell.jsx     // NEW — read-only aggregated value
    {Text,Number,Date,Select,MultiSelect,Checkbox}Cell.jsx   // existing
  AddColumnPopover.jsx // gains a config step for link/lookup/rollup
  ColumnMenu.jsx       // gains "Edit link / lookup / rollup" for mutable config
  DataTable.jsx        // wires new adapter methods + optimistic cross-table ops + undo
  ... (unchanged: TableTabs, ViewBar, ViewToolbar, FilterEditor, SortEditor, HideFieldsMenu,
       OptionsEditor, CursorMenu, AnchoredPopover, format.js, optionColors.js, useUndo.js,
       UndoControls.jsx, Toast.jsx, index.js)
```

**Hard boundary rules (unchanged, must hold):**
- `linkModel.mjs` is **dependency-free** (no zod/react/dnd-kit), carries no `"use client"`, uses `globalThis.crypto.randomUUID()`. It is imported by the client `DataTable` AND the server DAL (`repo.js`) via the **deep path** `@/modules/datatable/linkModel.mjs` — never the `index.js` barrel. One physical copy → client optimistic + server + Node test can never diverge in logic.
- The consumer (`src/config/`) owns Zod (`schemas.js`), migration, and the new server actions/adapter wiring. The module imports nothing app-specific.

---

## 3. Data model (PINNED)

```
Column (existing, EXTENDED):
  { id, name, type, width, number?, options?, link?, lookup?, rollup? }

  type ∈ "text" | "number" | "date" | "select" | "multiSelect" | "checkbox"
        | "link" | "lookup" | "rollup"        // NEW

  link   = { tableId, pairColumnId, single }   // present only when type==="link"
             tableId       : the OTHER table (tab id) this column links to      [immutable]
             pairColumnId  : id of the reverse link column on `tableId`         [immutable]
             single        : boolean — cap this cell to one linked record       [editable]

  lookup = { linkColumnId, targetColumnId }     // present only when type==="lookup"
             linkColumnId   : a link column ON THIS table                        [immutable]
             targetColumnId : a column id in the linked table (link.tableId)      [editable]

  rollup = { linkColumnId, targetColumnId, fn } // present only when type==="rollup"
             fn ∈ "sum" | "count" | "avg" | "min" | "max"                        [editable]
             fn==="count" ⇒ targetColumnId is unused (= number of linked records);
                            its field picker is hidden in the config UI.

Row (existing, UNCHANGED shape):
  { id, tabId, values }
  values[linkColumnId] = string[]   // array of ROW ids in link.tableId (empty ≡ absent key)
  lookup/rollup columns store NOTHING in `values` — fully derived at render.
```

- **`CellValue` is unchanged** — link cells reuse the existing `z.array(z.string())` arm. A link cell's `string[]` is distinguished from a multiSelect's `string[]` purely by the column `type`.
- **Zod stays permissive**: `link`/`lookup`/`rollup` are optional plain objects with string/enum fields and **no cross-reference validation**. A dangling `tableId`/`pairColumnId`/`linkColumnId`/`targetColumnId` (e.g. a concurrent delete) must **not** throw at the `StateSchema` boundary — it is handled defensively at derive time (mirrors `viewModel` skipping dangling filter columns). `type` remains **immutable** after creation.
- **No row migration.** New types are opt-in; `normalizeExpenses` / the `StateSchema` preprocess are untouched. Existing tabs have zero link columns.
- **Primary/label field:** a linked record is displayed by its table's **primary column = the first column**. Link/lookup/rollup columns may **not** be the primary column:
  - Adding a link/lookup/rollup requires the table to already have ≥1 simple column.
  - `rowLabel` uses the first column whose type is labelable (text/number/date/select/checkbox); if none, falls back to a short row-id token (`#abcdef`). It never recurses into another link/lookup/rollup.

---

## 4. Pure core — `src/modules/datatable/linkModel.mjs` (PINNED signatures)

All logic that touches links lives here (dependency-free, Node-testable, shared client+server). Functions return **new** `{tabs, rows}` (or scalars); never mutate inputs.

**Identity / labels**
- `primaryColumn(table) -> Column | null` — first labelable column.
- `rowLabel(table, row) -> string` — display label for a linked record: the primary (first) column's value coerced to string; if the first column is itself a link/lookup/rollup, fall back to the first **labelable** column (text/number/date/select); if none, `#<id6>`.

**Pairing (create)**
- `makeLinkPair({ tabA, tabB, name, single, idA, idB, widthA, widthB }) -> { colA, colB }` — builds the two paired column objects. `colB.name` defaults to `tabA.name`; `colB.single=false`; `colA.link.pairColumnId=idB` and vice-versa. (Ids minted by the caller so optimistic + server match.)
- `insertLinkPair(tabs, tabAId, colA, tabBId, colB) -> tabs` — insert both columns (append) atomically. (Named distinctly from the `addLinkPair` **adapter method** in §7, which calls this.)

**Editing a link cell (symmetric sync)**
- `syncLinkCell(rows, tabs, rowId, colId, nextIds) -> rows` — the heart:
  1. clamp `nextIds` per `colA.single` (keep last if >1);
  2. write `row.values[colId] = nextIds` (drop key if empty);
  3. diff old vs next → for each **added** target row `rT`: add `rowId` to `rT.values[pairColumnId]` (respect the pair column's `single`); for each **removed** `rT`: remove `rowId` from `rT.values[pairColumnId]` (drop key if it empties);
  4. ignore target rows that no longer exist (defensive).
  Inverse for undo = `syncLinkCell(rows, tabs, rowId, colId, oldIds)`.

**Cross-table cascades (both sides cleaned)**
- `stripRowEverywhere(tabs, rows, rowId) -> rows` — remove the row AND strip `rowId` from every link cell in every table (a row id is globally unique, so it only appears in link cells of columns targeting its table). Powers row-delete.
- `deleteLinkColumnPair(tabs, rows, tabId, colId) -> { tabs, rows, removed }` — delete `colA`, its paired `colB`, strip both columns' cells, drop dependent **lookup/rollup** columns on either table whose `linkColumnId` is `colA`/`colB`, and purge every view ref for all removed columns (reuse the `cleanViewOfColumn` idiom). `removed` captures everything (columns + their cells + view refs) for undo.
- `stripTableCascade(tabs, rows, tabId) -> { tabs, rows, removed }` — drop the tab + its rows; on every other table strip link columns whose `link.tableId===tabId`, their dependent lookup/rollup, those columns' cells, and view refs. `removed` captures for undo.

**Derivation (display-only; defensive on every dangling ref)**
- `linkedRows(row, linkCol, ctx) -> Row[]` — resolve id array → rows in `linkCol.link.tableId`, skipping missing ids. `ctx = { tableById, rowById, rowsByTab }` built once per render.
- `lookupValues(row, lookupCol, ctx) -> { row, value }[]` — for each linked record, read `targetColumnId`. Returns `[]` if the link/target/table is dangling.
- `rollupValue(row, rollupCol, ctx) -> number | null` — `count` = number of linked rows; `sum/avg/min/max` = aggregate the numeric coercion of each linked record's `targetColumnId` (empty cells skipped; `avg` over non-empty; returns `null` when nothing to aggregate or refs dangle).

**Node test:** `scripts/check-links.mjs` (mirrors `scripts/check-views.mjs`, `npm run check:links`) exercises: pair create, `syncLinkCell` both directions + `single` clamp, `stripRowEverywhere`, `deleteLinkColumnPair`, `stripTableCascade`, and all three derivations incl. dangling-ref safety. Pure imports via the deep path.

`coerceCell` (in `model.mjs`) gains a **`link`** arm: array of non-empty strings, clamped to length 1 when the column is `single`; `undefined` when empty. `lookup`/`rollup` → `coerceCell` returns `undefined` (never stored) and the generic `setExpenseCell` **guards** against writing to any derived column.

---

## 5. Cross-table data into `Grid`

`DataTable` already owns all `{tabs, rows}`. It passes two new props to `Grid`: `tables` (all tabs) and `allRows` (all rows). `Grid` builds the render-time `ctx` (`tableById`, `rowById`, `rowsByTab`) once (memoized) and hands it to link/lookup/rollup cells + the column-config UI. No new global state; still one active tab rendered. The module stays use-agnostic — this is all within its own table model.

---

## 6. UI components

- **`LinkCell.jsx`** — chips of linked records' `rowLabel` (or `—`). Click → portaled `AnchoredPopover` picker (mirrors `MultiSelectCell`): search target-table rows by label, toggle selection (checklist), enforce `single` (radio-like). Commits via the new `onSetLink(rowId, colId, nextIds)` path (→ `setLinkCell` sync), NOT the generic `onCommit`. Empty state and "Clear all" as in MultiSelect.
- **`LookupCell.jsx`** — read-only. Renders `lookupValues` as small chips/text (respects the target column's display: select → option chip, number → formatted, etc.). No editor.
- **`RollupCell.jsx`** — read-only. Renders `rollupValue`, formatted with the **target** column's number format when numeric (`count` → integer). No editor.
- **`Cell.jsx`** dispatcher + the column-drag **`GhostValue`** (in `Grid.jsx`) get arms for all three (read-only render in the ghost).
- **`AddColumnPopover.jsx`** — adds Link / Lookup / Rollup to the type list; picking one opens a **config step** in the same popover:
  - Link → choose target table (dropdown of other tabs) + single/multi toggle. Name defaults to the target table's name. Disabled when there is no other table, or when this table has 0 columns (needs a primary first).
  - Lookup → choose a link column on this table + a target field in its linked table.
  - Rollup → same + an aggregation (Sum/Count/Avg/Min/Max).
- **`ColumnMenu.jsx`** — link columns: "Edit link" (toggle single/multi). Lookup/rollup: "Edit lookup/rollup" (change target field; rollup fn). Target **table** and `type` stay immutable. Delete on a link column routes to the pair-delete cascade.

**View menus (display-only consequence):** because link/lookup/rollup are not filterable/sortable in v1, `FilterEditor.jsx` and `SortEditor.jsx` **exclude** these three types from their field pickers, while `HideFieldsMenu.jsx` **includes** them (you can still hide/show a derived column). `viewModel.mjs` needs no behavioral change: any stray filter/sort referencing one of these types is already ignored by its `default` arms, and `seedValuesFromView` never seeds them.

---

## 7. Server actions / adapter / repo (`src/config/`)

New adapter methods on the expense adapter (module callbacks → server actions), each `revalidatePath('/expenses')`:
- `addLinkPair(tabAId, colA, tabBId, colB)` → `repo` inserts both columns (`addLinkPair` core).
- `setLinkCell(rowId, colId, nextIds)` → `repo` runs `syncLinkCell` (one RMW of `state`; as atomic/concurrency-safe as every other write here).
- `deleteLinkColumn(tabId, colId)` → `repo` runs `deleteLinkColumnPair`.
- `restoreLinkColumn(tabId, removed)` → undo: re-insert both columns + their cells + dependents + view refs from the captured `removed`.

Reused/upgraded (signatures unchanged):
- `removeExpense(id)` → now `stripRowEverywhere` (strips link refs across tables).
- `removeExpenseTab(id)` → now `stripTableCascade`.
- Lookup/rollup columns are created through the **existing** `addColumn` (config-only, no cells) and deleted through the existing `deleteColumn` (no cells; still purges views).
- `setExpenseCell` guards: no write to `lookup`/`rollup` columns; `link` columns go through `setLinkCell`, not `setExpenseCell`.

The client's optimistic `setData` in `DataTable.jsx` calls the **same** pure cores, so optimistic and server results are identical.

---

## 8. Undo / redo

Each new mutation records an inverse command (same `apply*` + `record` pattern as today):
- add link pair ↔ delete link pair.
- `setLinkCell(row,col,next)` ↔ `setLinkCell(row,col,old)` (re-sync restores both sides).
- delete link column pair ↔ restore from captured `removed` (columns + cells + dependent lookup/rollup + view refs).
- **row delete** / **table delete** undo must also restore the stripped link refs — the delete handler captures the removed refs (which rows lost which ids) alongside today's capture, and the inverse re-adds them.

---

## 9. Staged implementation

1. **Schema + `linkModel.mjs` cores + `scripts/check-links.mjs`** — no UI. Fully verifiable headless (`npm run check:links` + `npm run build`).
2. **Link column end-to-end** — `AddColumnPopover` link step, `LinkCell` picker + chips, `setLinkCell` sync, cross-table cascades wired into `repo` + optimistic + undo, `Grid` cross-table props, `ColumnMenu` edit/delete, `GhostValue` arm.
3. **Lookup column** — config UI + `LookupCell` (derive/display).
4. **Rollup column** — config UI + `RollupCell` + aggregations.

Each stage ends with the authoritative checks (main loop, not inside any workflow): `npm run check:links`, `npm run lint`, `npm run build`, and the `/expenses` runtime smoke test (background `next start`, poll, assert 200 + markup, kill, `rm -rf .next`). Shared-state E2E is done in a **throwaway sheet** with backstop cleanup — never against real data.

## 10. Verification checklist (per stage)
- `npm run check:links` green (pairing, sync both ways, single-clamp, all 3 cascades, dangling-ref derive safety).
- `npm run build` green (Zod parse of `StateSchema` with the extended `ColumnSchema`).
- `/expenses` renders 200 with a link/lookup/rollup column present.
- Manual: create link A↔B, add refs from A, confirm B's reverse cell updates; delete a linked row → gone from both sides; delete a link column → pair + dependents gone; undo each.
