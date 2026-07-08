# DataTable module + Grid Views — design & implementation contract

**Date:** 2026-07-08 · **Feature:** (a) extract the expenses table engine into a use-agnostic module `src/modules/datatable/`, and (b) add Airtable-style **Tables → Views** (multiple named **Grid views** per table, each with its own filters, sorts, and hidden fields).

This doc is the **single source of truth** for implementation. Every name/shape/signature is **pinned**. Where ambiguous, prefer the existing repo idiom (`expenseModel.mjs`, `docIndex.mjs`, `ExpensesPlanner`). Reviewed by 3 parallel lens-agents (Airtable-feel · architecture · view-engine correctness); this spec incorporates their **essential** findings and explicitly excludes the gold-plating they flagged.

**Guiding constraint:** ship an *Airtable feel*, not Airtable. Essential-only. Behavior-preserving for existing data.

---

## 1. Scope (approved)

**Build now:** the module extraction **and** Grid Views (filter / sort / hidden fields), in one push.

**A view (v1)** = a named lens over its table's records: `type:"grid"` + its own `filters` (flat AND list), `sorts` (multi-key), `hiddenColumnIds`. Field **order + width stay shared on the table** (not per-view). Every table has ≥1 view (a default "All" grid view = no filters/sorts/hidden ⇒ identical to today).

**Explicitly OUT (do not add):** per-view field order/width · undo of filter/sort/hide *edits* · nested AND/OR filter groups · Kanban/Calendar/Gallery/grouping/formulas/row-height/conditional coloring · duplicate-view / view lock / descriptions / view search · per-user or server-side active-view persistence · owners/permissions · field-type change · plugin or column-type registry · generic filter DSL · virtualization · generic StorageProvider beyond the adapter callbacks · injectable id/uuid strategy · injectable theme engine · Zod inside the module · realtime/CRDT · server-side sort/filter/pagination · persisting the derived/filtered subset.

---

## 2. Module layout & boundary rules

```
src/modules/datatable/
  index.js                 // barrel: export { DataTable } ONLY (the client entry). NEVER re-export model.mjs/viewModel.mjs here.
  DataTable.jsx            // "use client" container (was ExpensesPlanner): optimistic {tables, rows}, undo, active table/view (per-browser via storageKey), wires the adapter → child callbacks
  model.mjs               // PURE, zero-import generic cores (moved out of expenseModel.mjs)
  viewModel.mjs           // PURE, zero-import filter/sort/visibility engine (NEW)
  format.js               // number display (moved)
  optionColors.js         // option tints (moved) — ships the matcha-theme default palette
  grid/
    Grid.jsx              // was ExpensesGrid (renamed) — TanStack v8 + dnd-kit + the column-drag ghost
    cells/{Cell,TextCell,NumberCell,DateCell,SelectCell,MultiSelectCell,CheckboxCell}.jsx
  fields/
    ColumnMenu.jsx  AddColumnPopover.jsx  OptionsEditor.jsx
  views/
    ViewBar.jsx           // the views strip (add/switch/rename/delete/reorder) — reuses the TabBar idiom
    ViewToolbar.jsx       // Filter · Sort · Hide-fields buttons (active-count badges) for the active view
    FilterEditor.jsx  SortEditor.jsx  HideFieldsMenu.jsx   // portaled popovers editing the active view
  nav/
    TableTabs.jsx          // was TabBar (renamed) — the tables strip
  overlays/
    CursorMenu.jsx  AnchoredPopover.jsx
  undo/
    useUndo.js  UndoControls.jsx  Toast.jsx
```

**Hard boundary rules:**
- The module imports **NOTHING** from `@/config` or `@/features`. All app-specifics arrive as props (`initialTables`, `initialRows`, `adapter`, `storageKey`, `makeDefaultColumns`). Final audit: zero `@/config` / `@/features` imports anywhere under `src/modules/datatable/`.
- `model.mjs` and `viewModel.mjs` are **dependency-free** (no zod, no react, no dnd-kit) and carry **no `"use client"`**. They use `globalThis.crypto.randomUUID()` (Node ≥19 + browser).
- **The server DAL imports the pure cores via the DEEP PATH** `@/modules/datatable/model.mjs` / `@/modules/datatable/viewModel.mjs` — **never** through `index.js` (which pulls in the React `<DataTable>` and would leak react/tanstack/dnd-kit into the server bundle + risk a client/server boundary error). One physical copy, many importers (client, server repo, server schemas, Node test).
- **Consumer owns:** Zod validation (`StateSchema`), the migration (`normalizeExpenses`), the legacy `DEFAULT_COLUMNS` (`col_*`), and the "new table" starter columns (passed to the module as `makeDefaultColumns()` — else another page's "add table" sprouts expense columns).

---

## 3. Data model (PINNED)

```
Option = { id, name, color }                                  // color = token NAME (e.g. "clay"), never hex
Column = { id, name, type, width, number?, options? }          // UNCHANGED from today
  type ∈ "text" | "number" | "date" | "select" | "multiSelect" | "checkbox"
Filter = { id, columnId, op, value? }                          // value absent for empty/not-empty ops
Sort   = { columnId, dir: "asc" | "desc" }
View   = { id, name, type: "grid", filters: Filter[], sorts: Sort[], hiddenColumnIds: string[] }
Table  = { id, name, columns: Column[], views: View[] }        // "tab" in storage (see §5)
Row    = { id, tableId, values: { [columnId]: CellValue } }    // "tabId" in storage
CellValue = string | number | boolean | string[]              // empty cell ≡ ABSENT key (never null)
```

**Operators by column type** (`op` enum = the exact union of all six lists):
- **text:** `is · isNot · contains · notContains · isEmpty · isNotEmpty`  (value = string; case-insensitive)
- **number:** `eq · neq · gt · gte · lt · lte · isEmpty · isNotEmpty`  (value = number)
- **date:** `is · before · after · isEmpty · isNotEmpty`  (value = "yyyy-mm-dd")
- **select:** `is · isNot · isAnyOf · isEmpty · isNotEmpty`  (value = optionId | optionId[])
- **multiSelect:** `hasAnyOf · hasAllOf · hasNoneOf · isEmpty · isNotEmpty`  (value = optionId[])
- **checkbox:** `isChecked · isUnchecked`  (no value; unchecked ≡ absent)

Filter `value` for select/multiSelect stores **optionId(s)** (ids are immutable; names are renameable). The FilterEditor renders option **names** + `optionChip(color)` via a picker mirroring `SelectCell`.

---

## 4. Pure cores

### 4a. `model.mjs` (MOVED from `expenseModel.mjs`, generic parts only)
Move these **verbatim**: `isEmptyValue`, `coerceCell`, `writeCell`, `cloneValues`, `numberFmt`, `insertAt`, plus the cascade/restore cores **extended for views** (§4c). **Leave behind in `@/config/expenseModel.mjs`** (consumer-owned, they import generic cores from the module): `DEFAULT_COLUMNS`, `DEFAULT_TAB`, `defaultColumns`, `normalizeExpenses` (+ the new default-view injection, §5).

### 4b. `viewModel.mjs` (NEW — pure, shared verbatim by DAL + client + Node test)
```js
export function applyView(rows, columns, view);   // rows already scoped to the table → filtered THEN sorted
export function visibleColumns(columns, view);    // columns minus hiddenColumnIds, preserving table order
export function matchesFilters(row, columns, filters); // AND across conditions
export function filterValues(rows, columns, view);      // (optional helper) equality-filter map for add-row seeding
```

**Semantics (pin every one in the test):**
- **Empty ≡ absent** everywhere: predicate via `isEmptyValue(values[colId])`. `isChecked` = `v === true`; `isUnchecked` = `v !== true`.
- **Positive ops exclude empties** (`is`, `gt`, `contains`, `hasAnyOf`, `hasAllOf`, `before`…). **Negative/inequality ops include empties** (`isNot`, `neq`, `notContains`, `hasNoneOf`) — Airtable-correct; an empty cell "is not X".
- **text** `contains`/`is`: lowercase both sides (case-insensitive), matching the SelectCell picker.
- **number** thresholds: coerce filter value with `parseNumber`; compare numerically.
- **date:** ISO `yyyy-mm-dd` string compare is chronological — **use lexical compare on purpose** (native date input guarantees zero-padded ISO). Do NOT parse to Date.
- **multiSelect:** `hasAnyOf` = intersection≠∅ (empty cell→false); `hasAllOf` = filterSet ⊆ cellSet (empty→false); `hasNoneOf` = intersection=∅ (empty cell→**true**).
- **Unknown col/option ids are skipped defensively at read** (a filter/sort referencing a concurrently-deleted column is ignored, not a crash) — mirrors `repo.drinks()` dangling-ref filtering.
- **Sort:** empties always **sink to the bottom** (both directions). Non-empty compare **branches by type**: number `a-b`; text `localeCompare`; date lexical; **select by the option's index in `column.options`** (fallback name); checkbox two buckets (checked first on asc). Multi-key = chained comparators (JS sort is stable ≥ES2019). Returns a new array; never mutates.

### 4c. Cascade + restore cores (EXTENDED for views)
`stripColumn(tabs, rows, tabId, colId)` and `stripOption(tabs, rows, tabId, colId, optionId)` must now ALSO clean the **views on that tab**:
- `stripColumn`: from each view drop `sorts`/`filters` whose `columnId===colId` and remove `colId` from `hiddenColumnIds`.
- `stripOption`: from each view's select/multiSelect filters, remove `optionId` from array `value`s (drop the condition if its value becomes empty) and drop a single-value condition whose `value===optionId`.
- Both return the removed **view-ref fragments** (per view) alongside the existing removed `cells`, so undo can restore them.
- `restoreColumn(...)` / `restoreOption(...)` take the captured view-ref fragments and re-insert them into the matching views.
- **New:** `restoreView(tabs, tabId, view, index)` — re-insert a deleted view at its index (views are a tab field; no cell capture needed). Deleting a **tab** already restores its views for free via `restoreTab` (views live on the tab object).

---

## 5. Schema + migration (`src/config/schemas.js`, `@/config/expenseModel.mjs`)

Add:
```js
const FilterSchema = z.object({ id: z.string(), columnId: z.string(),
  // the COMPLETE de-duped union of all six types' ops (§3) — omitting any bricks shared getState:
  op: z.enum([
    "is","isNot","contains","notContains","isEmpty","isNotEmpty",   // text (+ is/isNot shared)
    "eq","neq","gt","gte","lt","lte",                               // number
    "before","after",                                               // date (+ is/isEmpty/isNotEmpty shared)
    "isAnyOf",                                                       // select (+ is/isNot/isEmpty/isNotEmpty shared)
    "hasAnyOf","hasAllOf","hasNoneOf",                              // multiSelect (+ isEmpty/isNotEmpty shared)
    "isChecked","isUnchecked",                                      // checkbox
  ]),
  value: CellValue.optional() });                             // absent for empty/not-empty ops
const SortSchema = z.object({ columnId: z.string(), dir: z.enum(["asc","desc"]).default("asc") });
const ViewSchema = z.object({ id: z.string(), name: z.string().default(""),
  type: z.literal("grid").default("grid"),
  filters: z.array(FilterSchema).default([]),
  sorts: z.array(SortSchema).default([]),
  hiddenColumnIds: z.array(z.string()).default([]) });
// ExpenseTabSchema gains:  views: z.array(ViewSchema).default([])
```
- Keep `StateSchema` **strict** (no `.catch`) — a bad stored view must be caught, but the op enum MUST be the complete union so valid views never brick shared `getState`.
- `value` reuses the permissive `CellValue` union (heterogeneous).

**Migration (`normalizeExpenses`) — TWO INDEPENDENT idempotent steps per tab:**
```js
let out = "columns" in t ? t : { ...t, columns: cloneColumns(DEFAULT_COLUMNS) };
out = "views" in out ? out : { ...out, views: [defaultView()] };
```
- Keyed on `"views" in tab` **independent of** the columns check (every production tab already has `columns`, so folding into that branch would mean no existing tab ever gets a view — the sharpest bug).
- **`defaultView()` uses a FIXED deterministic id** `"view_all"`, name `"All"`, empty filters/sorts/hidden. **Not** a uuid: `getState` re-runs the preprocess each request without persisting, so a random id would change every read and break per-browser active-view selection. Idempotent via key-presence.
- **View ids are unique only WITHIN a table** (`view_all` repeats across tables; runtime-created views are `crypto.randomUUID()`). Every view lookup is table-scoped (via `activeViewByTable[tableId]` → the table's `views` array) — never a flat global lookup, so the repeated `view_all` is safe.
- Storage keeps keys **`expenseTabs` / `expenses` / `tabId`** (no risky live-Redis rename). The module speaks "tables/views/tableId"; the adapter maps `expenseTabs↔tables`, `tabId↔tableId`.
- Extend `check-expenses.mjs` + a new/extended pure test for `viewModel` (§10).

---

## 6. Adapter contract (the consumer↔module seam)

`<DataTable adapter={...} />`. The module owns optimistic `setData` + the undo inverse-command stack; the adapter owns **only persistence**. Every callback is a **granular single-item / atomic delta off fresh server state** (never "save the whole table") — this preserves the concurrency-safety that keeps shared state correct; undo inverses call the **same** callbacks as forward ops. The module **mints all ids** and hands pre-built objects/ids to the adapter (adapter never re-mints).

```
Rows:    setCell(rowId,colId,value) · addRow(row,afterId?) · removeRow(id) · duplicateRow(rowId,newId,afterId) · reorderRows(tableId,orderedIds)
Columns: addColumn(tableId,column) · updateColumn(tableId,colId,patch) · reorderColumns(tableId,orderedIds) · deleteColumn(tableId,colId) · restoreColumn(tableId,column,index,cells,viewRefs)
Options: addOption(tableId,colId,option) · updateOption(tableId,colId,optionId,patch) · deleteOption(tableId,colId,optionId) · restoreOption(tableId,colId,option,index,cells,viewRefs)
Tables:  addTable(table) · renameTable(id,name) · removeTable(id) · reorderTables(orderedIds) · restoreTable(table,index,tableRows)
Views:   addView(tableId,view) · updateView(tableId,viewId,patch) · removeView(tableId,viewId) · reorderViews(tableId,orderedIds) · restoreView(tableId,view,index)
```
- `updateView` patch = `{ name? , filters? , sorts? , hiddenColumnIds? }` (config edits are **not** undoable; a whole filters/sorts/hidden array replaces).
- The **expenses adapter** is one factory `makeExpenseAdapter()` mapping each callback to the existing/new server action (keep action names aligned with today's to avoid drift), so `page.js` isn't 27 hand-rolled wrappers. Grouped/optional sub-interfaces are fine; a future no-views consumer may omit the `Views` group.

---

## 7. Persistence — `repo.js` / `actions.js` (consumer)

- **Rename-align** existing expense ops to the adapter names where trivial (or wrap): `setExpenseCell→setCell`, `addExpenseTab→addTable`, etc. Keep the Redis read-modify-write-fresh pattern and `revalidatePath("/expenses")`.
- **New view ops** on `repo`: `addView/updateView/removeView/reorderViews/restoreView` (each mutates the target tab's `views`), + `'use server'` wrappers.
- **Extend** `deleteColumn`/`deleteOption` repo ops to use the view-aware `stripColumn`/`stripOption` (§4c); extend `restoreColumn`/`restoreOption` to take + apply `viewRefs`.
- Update the CLAUDE.md action/revalidate inventory.

---

## 8. UI

### 8a. `DataTable.jsx` (container)
- Owns `data = {tables, rows}` (one object, atomic cross-field ops), `activeTableId`, and **`activeViewByTable` = { [tableId]: viewId }** (active view is **per-table**; a global id would point at another table's view after switching). Per-browser via `storageKey` — **read localStorage in an effect, not during render** (hydration); namespaced by `storageKey`; fall back to the table's first view when the stored id was deleted (extend today's `tabs.some(...)?id:tabs[0]?.id` guard to views).
- **Sticky visible-set** (this is the Airtable feel for filters): the displayed row-id set for a view is computed from `applyView` **on view/table switch and on add-row**, and stays stable while you edit — so a row you're editing **never vanishes on commit**, and a freshly-added row stays put. Sort order may update live on render; filter *membership* is sticky until you leave/re-enter the view (`key={tableId+":"+viewId}` remount recomputes it).
- **＋ Add row in a filtered view:** seed the new row's `values` from that view's **equality** filter conditions (`is`/`eq`/`isChecked` → set that column) so it lands visibly; add its id to the sticky set regardless.
- Undo: **view CRUD (add/remove/rename/reorder) IS undoable** (structural, like tabs — with `restoreView`); **view-config edits (filter/sort/hide) are NOT** pushed to the undo stack (Airtable doesn't Cmd+Z view config; keeps the "…deleted · Undo" toast clean).

### 8b. `nav/TableTabs.jsx` (tables strip) — today's TabBar, renamed. Behavior unchanged.

### 8c. `views/ViewBar.jsx` + `ViewToolbar.jsx`
- **ViewBar reuses the TabBar idiom exactly:** `chip--active` highlight + `aria-pressed`, right-click cursor menu (Rename / Delete), drag-reorder, trailing ＋. **Guard deleting a table's last view** (`canDelete = views.length > 1`); ≥1 view per table always.
- **ViewToolbar:** `Filter`, `Sort`, `Hide fields` buttons. Each shows an **active count + active (filled/colored) styling** when non-empty (e.g. "Filter 2", "Hidden 4") — state must not be invisible, especially since views are **shared team-wide**.
- `FilterEditor` / `SortEditor` / `HideFieldsMenu` are `AnchoredPopover`-portaled editors that read the active view and call `updateView`. Filter rows: column picker → op picker (type-aware) → value input (select/multiSelect show the option checklist by name). Sort rows: column + asc/desc, add/remove, multi. Hide: a checklist of columns.

### 8d. `grid/Grid.jsx` (today's ExpensesGrid)
- Render `visibleColumns(columns, activeView)` and the sticky-filtered+sorted rows (from the container).
- **Primary (first) column is un-hideable** — enforce ≥1 visible field (HideFieldsMenu disables the primary's toggle); prevents the "no columns" empty state firing on a table that *has* fields.
- **When the active view has a sort:** hide/grey the row ⠿ drag handle with a tooltip "Sorted — clear sort to reorder" (a live handle that no-ops reads as a bug). `duplicateRow` inserts by the **underlying array index**, not the sorted-view position.
- **Two distinct empty states:** "table has 0 rows" → today's "Add your first line" copy; "view filtered to 0 of N rows" → **"No records match this view's filter"** + a Clear/Edit-filter affordance. Don't show the add-row lie under a filter.
- Column drag-ghost, resize, cell editors: unchanged.

---

## 9. Undo integration
Extend the existing `useUndo` command pattern: `addView/removeView/renameView/reorderViews` push `{undo,redo,label}` (delete captures the view + index → `restoreView`). Column/option deletes now also capture `viewRefs` (§4c) so undo fully restores view state. Filter/sort/hide edits do **not** record.

---

## 10. Verification (main loop only — implementer agents do NOT build/lint/dev)
1. `npm run check:expenses` — extend with: view migration (two-step, fixed `view_all` id, idempotent), and `stripColumn`/`stripOption` cleaning views + `restore*` re-applying `viewRefs`.
2. **New pure `viewModel` tests** (own script `scripts/check-views.mjs` + `npm run check:views`, mirroring `check-docs`): empty≡absent per type · checkbox unchecked matches absent · negative-op-includes-empty · positive-op-excludes-empty · empties-last + numeric-vs-string vs date sort · select sort by option index · multiSelect hasAny/All/None incl. empty · unknown-id skipped defensively.
3. `npm run build` (runs the Zod parse on static gen — catches a bad migration/schema).
4. `npm run lint`.
5. Runtime smoke: exercise `/expenses` (dev server or clean prod build) — 200 + grid markup, then manually: add a view, filter/sort/hide, add-row-under-filter appears, edit-doesn't-vanish, delete a filtered column → view survives, undo restores it.
6. Update CLAUDE.md (module section + actions inventory + state shape) and MEMORY if warranted.

---

## 12. Red-team corrections (AUTHORITATIVE — override earlier sections on any conflict)

Two more red-team passes (implementability + correctness/concurrency) found the following; all folded in and PINNED. On any conflict with §1–§10, this section wins.

### Module boundary / files
- **Consumer client shim (NEW file) `src/features/expenses/ExpensesDataTable.jsx` (`"use client"`)** imports the `'use server'` actions directly (legal — as today's `ExpensesPlanner` does), builds `makeExpenseAdapter()`, and renders `<DataTable adapter initialTables initialRows makeDefaultColumns={defaultColumns} storageKey="expenses" />`. `app/expenses/page.js` (server, force-dynamic) renders `<ExpensesDataTable initialTables initialRows />` and passes ONLY data — a closure-object adapter can't cross the server→client boundary.
- **Row owner field stays `tabId` end-to-end** (module `Row = {id, tabId, values}`, `tabId`→`Table.id`). NO `tabId↔tableId` remap anywhere (prevents rows silently landing in the wrong sheet). "tableId" in prose = the `tabId` field. Amends §3/§5.
- **Import re-pointing (else the build breaks):** `scripts/check-expenses.mjs` imports the moved cores from `../src/modules/datatable/model.mjs`; `Grid.jsx`/`ColumnMenu.jsx`/`cells/NumberCell.jsx` import `numberFmt` from the module-internal relative `../model.mjs` (they now LIVE in the module). `DEFAULT_COLUMNS`/`DEFAULT_TAB`/`defaultColumns`/`normalizeExpenses` stay in `@/config/expenseModel.mjs`.
- **`model.mjs` exports `defaultView()`** → `{id:"view_all", name:"All", type:"grid", filters:[], sorts:[], hiddenColumnIds:[]}`. Used by BOTH the module's runtime add-table handler AND the consumer migration (`normalizeExpenses` imports it) — single source.
- **`viewModel.mjs` MAY import from `./model.mjs`** (`isEmptyValue`, `coerceCell`); "dependency-free" = no EXTERNAL deps (no zod/react), not no-local-import. Use `Number(...)` for numeric thresholds (no `parseNumber` in model).

### Persistence — drop churn
- **DO NOT rename existing actions/repo methods.** Only the (deleted) `ExpensesPlanner` imports them; renaming is churn on teammate-modified files. Keep `setExpenseCell`/`addExpenseTab`/`reorderExpenseTabs`/… names; translate to adapter names ONLY inside `makeExpenseAdapter`. ADD only the new view ops + `viewRefs` params. Supersedes §7's "rename-align."
- **`viewRefs` is one atomic thread:** `stripColumn`/`stripOption` cores RETURN `viewRefs`; `restoreColumn`/`restoreOption` cores + the repo methods + the `'use server'` wrappers ALL grow the `viewRefs` param; client delete handlers capture it alongside `cells`; tests cover it.

### View-engine semantics (`viewModel.mjs`) — PIN ALL
- **Incomplete filter = skip (no-op, matches all rows).** Any positive, value-carrying condition whose `value` is empty (`isEmptyValue`) is IGNORED: `isAnyOf []`, `hasAnyOf []`, `hasAllOf []`, text `is ""`/`contains ""`, number/date thresholds with no value. (Else clearing all options in the FilterEditor blanks the view.)
- **select value shape BY OP:** `is`/`isNot` → single `optionId` string (`v===value` / `v!==value`); `isAnyOf` → `optionId[]` (`value.includes(v)`). FilterEditor: single-pick for is/isNot, multi-pick for isAnyOf. multiSelect ops always `optionId[]`.
- **Full 20-op empty behavior** (empty ≡ absent via `isEmptyValue`):
  - **EXCLUDE empty** (empty cell does NOT match): `is, contains, eq, gt, gte, lt, lte, before, after, isAnyOf, hasAnyOf, hasAllOf, isChecked`
  - **INCLUDE empty** (empty cell DOES match): `isNot, notContains, neq, hasNoneOf, isUnchecked`
  - **explicit:** `isEmpty` (match empty), `isNotEmpty` (match non-empty)
  - (`lt/lte/gte` are POSITIVE — an empty cell must NOT match `lt 5`.)
- **Sort:**
  - Empties sink to the bottom — resolve the empty/non-empty bucket **OUTSIDE** the asc/desc flip (empties return "after" regardless of `dir`; only the non-empty type-compare is negated for desc). Test BOTH directions.
  - **Checkbox is EXEMPT from empties-sink** — unchecked = real `false`, two buckets that swap with `dir` (else asc==desc).
  - **select** sorts by option index in `column.options`; a dangling optionId (`findIndex===-1`) sinks like empty (`+Infinity`), never to the top.
  - number numeric · text `localeCompare` · date ISO-lexical · multi-key chained (stable).

### Cascade capture/restore (`viewRefs`) — PIN
- Restore re-applies captured fragments **by `viewId`** (views may be reordered/deleted), never by array position.
- **sorts** re-insert at their **captured index** (order = key priority); **filters** re-append (flat AND); **hiddenColumnIds** re-add the id.
- Restore reads the **FRESH** view and MERGES the fragment — never replaces the whole `filters`/`sorts` array from a stale snapshot (else it clobbers a concurrent `updateView` edit).
- `stripOption` viewRef granularity: capture, per affected filter, whether the option was (a) removed from an array value → restore re-adds the id into that filter's array by filter-id; or (b) the whole condition dropped because its value emptied → restore re-inserts the whole condition.

### Migration hardening
- **Length-guard** the view injection: `out = out.views?.length ? out : {...out, views:[defaultView()]}` (an empty `views` array is NEVER legitimate — last-view guarded — unlike empty `columns`). Idempotent/deterministic with the fixed `view_all` id.
- **Module add-table builds `views:[defaultView()]` explicitly** (never rely on the Zod `.default([])` — a viewless optimistic table has no active view → blank Grid).

### UI props / behaviors
- **`Grid.jsx` added props (PIN):** `visibleColumns` (already filtered), `sortActive` (bool → grey/hide the row ⠿ handle + tooltip), `filteredCount`/`totalCount` + `onClearFilter` (drives the two empty states: "0 rows" vs "No records match — Clear filter").
- **Add-row / duplicate-row under a filter:** seed a new row ONLY from equality-seedable conditions — `text is · number eq · date is · select is · checkbox isChecked` (isChecked → literal `true`), via `coerceCell`+`writeCell` (preserve empty≡absent). BOTH add-row and duplicate-row add the new id to the sticky visible-set regardless.
- Active table + active view localStorage is NET-NEW code (today's active tab is plain `useState`) — read in an effect, namespaced by `storageKey`, with the `views.some(...)?id:views[0]?.id` fallback.

### Sequencing / git (process)
- The whole expenses surface is uncommitted (teammate WIP + the checkbox/drag work). Do the extraction as **one atomic sequence, NOT parallel** with the teammate. `git mv` only works on tracked files — most are untracked → create-new + delete-old (plain `rm`), preserving the current `ExpensesPlanner`'s `reorderExpenseTabs`/`applyReorderTabs` into `DataTable.jsx` (don't regress tab drag-reorder).
- `package.json`: add `"check:views": "node scripts/check-views.mjs"`.

---

## 11. Open decisions (defaulted — veto any)
- Module dir name **`datatable`** (vs datagrid). · Storage keeps `expenseTabs`/`tabId` (no rename). · Default view id `view_all`, name **"All"**. · Sort ⇒ row-drag hidden. · Filter membership **sticky** during edit (recompute on view switch/add). · View-config edits not undoable; view CRUD undoable. · `optionColors` ships the matcha palette as the module default (theme-override seam deferred).
