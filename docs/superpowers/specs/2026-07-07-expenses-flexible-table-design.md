# Expenses → flexible record table — design & implementation contract

**Date:** 2026-07-07 · **Feature:** rewrite `/expenses` from a fixed 5-column sheet into an Airtable-style flexible record table.

This doc is the **single source of truth** for the parallel implementation agents. Every name, shape, and signature below is **pinned** — do not deviate. If something is ambiguous, prefer the existing repo idiom (Documents feature) over inventing.

---

## 1. Goal (approved decisions)

Turn each expense **sheet/tab** into an independent table with **user-defined columns** and **typed cells**:

- Field types: **text · number** (currency ₱ or plain, editable decimals 0–4) **· date · single-select · multi-select**.
- **Add / rename / delete columns**; **drag to rearrange** columns; **drag right edge to resize** columns (widths shared team-wide).
- **Horizontal scroll** when many columns; **sticky** left row-gutter + first data column.
- **Remove** the `%` field, the `Total ₱` (price×qty) column, and the grand total — **no totals for now**.
- **Per-sheet columns** (each tab independent). **Migrate existing data** into default columns (lossless).
- Build with **`@tanstack/react-table` v8** (headless) + **`@dnd-kit`** (already installed).

Keep everything **behavior-preserving where unchanged**: hearts n/a here; row duplicate/delete, tabs (add/rename/delete), optimistic shared state, force-dynamic — all stay.

---

## 2. Data model (PINNED)

```
Option     = { id: string, name: string, color: string }   // color = a TOKEN NAME, e.g. "clay" (never hex)
Column     = {
  id:     string,                 // "col_*" ONLY from migration; crypto.randomUUID() otherwise
  name:   string,
  type:   "text" | "number" | "date" | "select" | "multiSelect",
  width:  number,                 // px, default 160
  number?:  { style: "plain" | "currency", precision: 0..4 },  // present ONLY for type "number"
  options?: Option[],             // present ONLY for type "select" | "multiSelect"
}
ExpenseTab = { id: string, name: string, columns: Column[] }
ExpenseRow = { id: string, tabId: string, values: { [columnId]: CellValue } }
CellValue  = string | number | string[]      // text/date/select → string; number → number; multiSelect → string[]
```

**Conventions (pin in tests):**
- **Empty cell ≡ absent key.** No `null`. Text/date empty = key removed; number cleared = key removed; multiSelect empty `[]` = key removed. Uniform emptiness test: `!(colId in values)`.
- **Column `id` is immutable**; the label (`name`) is the mutable display field. Cells key off `id`.
- **Column `type` is immutable** after creation (to change type: delete + re-add). Editable per-type: number `{style,precision}`, select/multiSelect `options`.
- Option `id` is immutable; `name`/`color` mutable.
- `col_*` is a **reserved namespace** for migration-injected default columns. All runtime-created ids are `crypto.randomUUID()`.

### DEFAULT_COLUMNS (migration only — fixed ids, preserves legacy structure)
| id | name | type | number |
|----|------|------|--------|
| `col_item` | Item | text | — |
| `col_notes` | Notes | text | — |
| `col_date` | Date | date | — |
| `col_price` | Price | number | `{style:"currency", precision:2}` |
| `col_qty` | Qty | number | `{style:"plain", precision:0}` |

### defaultColumns() (a NEW user-created sheet — fresh uuids)
Two starter columns: **Item** (text) + **Amount** (number, `{style:"currency", precision:2}`). Fresh `crypto.randomUUID()` ids.

### DEFAULT_TAB
`{ id: "default", name: "Sheet 1", columns: DEFAULT_COLUMNS }`

---

## 3. `src/config/expenseModel.mjs` (NEW — pure, dependency-free)

Mirror `src/config/docIndex.mjs` exactly: **no zod, no react, no imports**. Shared verbatim by the repo DAL, the client optimistic layer, and `scripts/check-expenses.mjs`. Uses `crypto.randomUUID()` (available in Node ≥ 19 and the browser — `docIndex`/client already rely on it).

Exports:
```js
export const DEFAULT_COLUMNS;              // the 5 fixed col_* columns (table above)
export function defaultColumns();          // 2 STARTER columns with fresh uuids (Item text, Amount currency/2)
export const DEFAULT_TAB;                  // { id:"default", name:"Sheet 1", columns: DEFAULT_COLUMNS }

// Cross-field migration — the whole-state preprocess calls this. IDEMPOTENT.
export function normalizeExpenses(raw);    // raw: {expenseTabs?, expenses?} (or junk) -> {expenseTabs, expenses}

// Cell helpers
export function coerceCell(column, value); // coerce value to column.type; number: Number(value) else drop; text/date: String; select: String; multiSelect: array of String. Returns undefined for empty.
export function isEmptyValue(value);       // "" | [] | undefined | (number NaN) -> true
export function writeCell(values, colId, v); // returns NEW object: sets key, or DELETES key when isEmptyValue(v)
export function cloneValues(values);       // deep copy (arrays!) for duplication
export function numberFmt(column);         // column.number ?? { style:"plain", precision:0 }

// Cascade cores (repo mutates + client optimistic both wrap these)
export function stripColumn(tabs, rows, tabId, colId);           // -> { tabs, rows }  removes col from tab + key from in-tab rows
export function stripOption(tabs, rows, tabId, colId, optionId); // -> { tabs, rows }  removes option + strips from in-tab cells (single→delete key, array→filter)
```

**`normalizeExpenses` rules (CRITICAL):**
1. Coerce junk: if `raw` is not an object → treat as `{}`.
2. `tabs = raw.expenseTabs` (array) else `[]`; `rows = raw.expenses` (array) else `[]`.
3. **Legacy tab** = `!("columns" in tab)` → give it `columns: DEFAULT_COLUMNS` (a fresh copy). A tab **with** a `columns` key (even `[]`) passes through untouched.
4. **Legacy row** = `!("values" in row)` → build `values` by folding legacy fields under the fixed ids: `col_item←item`, `col_notes←notes`, `col_date←date`, `col_price←price`, `col_qty←qty`. Fold **price & qty always** (0 and 1 are real values via `writeCell`, but note: `writeCell` deletes 0? — NO: `isEmptyValue(0)` MUST be false; only `""`/`[]`/`undefined`/`NaN` are empty). Fold item/notes/date only when non-empty. A row **with** a `values` key passes through untouched. Drop the legacy top-level fields on migrated rows.
5. **Guarantee ≥ 1 tab:** if `tabs` ends up empty → `[DEFAULT_TAB]` (fresh copy).
6. Return `{ expenseTabs, expenses }`. Running twice = a no-op (idempotent), because migrated tabs/rows now have the `columns`/`values` keys.

`isEmptyValue`: `value === undefined` OR `value === ""` OR (`Array.isArray(value)` AND `value.length === 0`) OR (`typeof value === "number"` AND `Number.isNaN(value)`). **`0` and `false`-ish numbers are NOT empty.**

---

## 4. `src/config/schemas.js` (EDIT — expense parts + StateSchema preprocess)

Zod is **v4** (`z.record(key, value)` two-arg form). Replace the current `expenseTabs`/`expenses` field defs (lines ~220-239) and wrap `StateSchema` in a preprocess.

```js
import { normalizeExpenses } from "@/config/expenseModel.mjs";   // or relative "./expenseModel.mjs"

const CellValue = z.union([z.string(), z.number(), z.array(z.string())]); // NO null

const OptionSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  color: z.string().default(""),
});

const ColumnSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  type: z.enum(["text", "number", "date", "select", "multiSelect"]).default("text"),
  width: z.number().default(160),
  number: z.object({
    style: z.enum(["plain", "currency"]).default("plain"),
    precision: z.number().int().min(0).max(4).default(0),
  }).optional(),
  options: z.array(OptionSchema).optional(),
});

const ExpenseTabSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  columns: z.array(ColumnSchema).default([]),   // preprocess guarantees this is present
});

const ExpenseRowSchema = z.object({
  id: z.string(),
  tabId: z.string().default("default"),
  values: z.record(z.string(), CellValue).default({}),
});
```

- Rename the existing `z.object({... 19 fields ...})` to `StateInner` (keep ALL other 17 fields exactly as-is), swapping in `expenseTabs: z.array(ExpenseTabSchema).default([...])` and `expenses: z.array(ExpenseRowSchema).default([])`. For the tabs default, use a literal equal to DEFAULT_TAB (or import DEFAULT_TAB — but keep schemas.js's default a plain literal to avoid import-order surprises; the preprocess is the real guarantee).
- Wrap and export:
```js
export const StateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") raw = {};
  return { ...raw, ...normalizeExpenses(raw) };   // migrate the two expense keys; pass the other 17 through
}, StateInner);
```
- **Keep it strict** (no `.catch`) — house style is "reject bad data." All writes are coerced at the boundary (§6 `setExpenseCell`), so malformed values never get written through the app.
- Do NOT add a `superRefine` cross-checking cells vs columns (a single bad write would brick shared `getState`).

**Verify:** `npm run build` runs `StateSchema.parse` during static gen — migration must be lossless or the build fails.

---

## 5. `src/config/repo.js` (EDIT — expense ops)

All ops go through `mutate((s) => …)` off **fresh** state (concurrency-safe, mirrors `attachIngredient`). Reads `repo.expenses()` / `repo.expenseTabs()` are unchanged (they now return the migrated shape because `getState` runs the preprocess). Import cascade cores + helpers from `expenseModel.mjs`.

**Rows** (keep `addExpense`, `removeExpense`, `reorderExpenses`; add `setExpenseCell`, `duplicateExpense`; the client now builds rows as `{id, tabId, values:{}}`):
```js
setExpenseCell: (rowId, colId, value) =>
  mutate((s) => {
    const row = s.expenses.find((r) => r.id === rowId);
    if (!row) return s;                                  // row deleted concurrently → no-op
    const tab = s.expenseTabs.find((t) => t.id === row.tabId);
    const col = tab?.columns.find((c) => c.id === colId);
    if (!col) return s;                                  // column gone → drop write (no dangling key)
    const v = coerceCell(col, value);
    return { ...s, expenses: s.expenses.map((r) =>
      r.id === rowId ? { ...r, values: writeCell(r.values, colId, v) } : r) };
  }),

duplicateExpense: (rowId, newId, afterId) =>
  mutate((s) => {
    const src = s.expenses.find((r) => r.id === rowId);
    if (!src) return s;
    const copy = { ...src, id: newId, values: cloneValues(src.values) };
    const anchor = afterId ?? rowId;
    const i = s.expenses.findIndex((r) => r.id === anchor);
    const expenses = s.expenses.slice();
    expenses.splice(i + 1, 0, copy);
    return { ...s, expenses };
  }),
```
Keep `addExpense(row, afterId)`, `removeExpense(id)`, `reorderExpenses(tabId, orderedIds)` as they are (they already refill only the target tab's slots).

**Columns** (new):
```js
addColumn: (tabId, column) =>
  mutate((s) => ({ ...s, expenseTabs: s.expenseTabs.map((t) =>
    t.id === tabId ? { ...t, columns: [...t.columns, column] } : t) })),

updateColumn: (tabId, colId, patch) =>                   // patch: { name?, width?, number? }
  mutate((s) => ({ ...s, expenseTabs: s.expenseTabs.map((t) =>
    t.id === tabId ? { ...t, columns: t.columns.map((c) =>
      c.id === colId ? { ...c, ...patch } : c) } : t) })),

reorderColumns: (tabId, orderedIds) =>
  mutate((s) => ({ ...s, expenseTabs: s.expenseTabs.map((t) => {
    if (t.id !== tabId) return t;
    const byId = new Map(t.columns.map((c) => [c.id, c]));
    const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    for (const c of t.columns) if (!seq.includes(c)) seq.push(c); // keep any not listed
    return { ...t, columns: seq };
  }) })),

deleteColumn: (tabId, colId) =>
  mutate((s) => {
    const { tabs, rows } = stripColumn(s.expenseTabs, s.expenses, tabId, colId);
    return { ...s, expenseTabs: tabs, expenses: rows };
  }),
```

**Options** (new — select/multiSelect):
```js
addOption: (tabId, colId, option) =>       // append option {id,name,color} to column.options
  mutate((s) => ({ ...s, expenseTabs: s.expenseTabs.map((t) => t.id === tabId
    ? { ...t, columns: t.columns.map((c) => c.id === colId
        ? { ...c, options: [...(c.options ?? []), option] } : c) } : t) })),

updateOption: (tabId, colId, optionId, patch) =>  // patch: { name?, color? }
  mutate((s) => ({ ...s, expenseTabs: s.expenseTabs.map((t) => t.id === tabId
    ? { ...t, columns: t.columns.map((c) => c.id === colId
        ? { ...c, options: (c.options ?? []).map((o) => o.id === optionId ? { ...o, ...patch } : o) } : c) } : t) })),

deleteOption: (tabId, colId, optionId) =>
  mutate((s) => {
    const { tabs, rows } = stripOption(s.expenseTabs, s.expenses, tabId, colId, optionId);
    return { ...s, expenseTabs: tabs, expenses: rows };
  }),
```

**Tabs** (keep `addExpenseTab`, `renameExpenseTab`, `removeExpenseTab`). `addExpenseTab(tab)` now receives a tab that **already includes `columns`** (the client builds it with `defaultColumns()`), so no repo change beyond appending. `removeExpenseTab` needs **no change** (columns live on the tab; rows carry `tabId`).

Remove the now-unused `updateExpense` op (replaced by `setExpenseCell`) — grep for callers first.

---

## 6. `src/config/actions.js` (EDIT — `'use server'` wrappers)

One thin wrapper per repo op, each ending `revalidatePath("/expenses")`. **Pinned action names + signatures** (this is the contract the UI imports):

```
addExpense(row, afterId?)                 // row = {id, tabId, values}
removeExpense(id)
reorderExpenses(tabId, orderedIds)
setExpenseCell(rowId, colId, value)       // replaces updateExpense
duplicateExpense(rowId, newId, afterId)
addColumn(tabId, column)
updateColumn(tabId, colId, patch)         // { name?, width?, number? }
reorderColumns(tabId, orderedIds)
deleteColumn(tabId, colId)
addOption(tabId, colId, option)           // option = {id, name, color}
updateOption(tabId, colId, optionId, patch)  // { name?, color? }
deleteOption(tabId, colId, optionId)
addExpenseTab(tab)                         // tab = {id, name, columns}
renameExpenseTab(id, name)
removeExpenseTab(id)
```
Delete the `updateExpense` action.

---

## 7. `scripts/check-expenses.mjs` (NEW) + `package.json`

Mirror `scripts/check-docs.mjs`: `import` pure fns from `../src/config/expenseModel.mjs`, `node:assert/strict`, an `ok(msg)` counter, final `console.log("N checks passed")`, `process.exit(0)`. Add `"check:expenses": "node scripts/check-expenses.mjs"` to `package.json` scripts.

Assertions:
1. **Migration** — a legacy `{expenseTabs:[{id:"default",name:"Sheet 1"}], expenses:[{id:"r1",tabId:"default",item:"Matcha",notes:"n",date:"2026-01-01",price:100,qty:2}]}` → tab gains exactly the 5 `DEFAULT_COLUMNS`; row → `values:{col_item:"Matcha",col_notes:"n",col_date:"2026-01-01",col_price:100,col_qty:2}` with **no** legacy keys.
2. **Idempotency** — `deepEqual(normalize(normalize(X)), normalize(X))` for: legacy X, already-new X, `{}`, `null`, `undefined`.
3. **Empty/default** — `normalize({})` and `normalize(null)` → `[DEFAULT_TAB]` (with `DEFAULT_COLUMNS`) + `expenses:[]`; ≥1 tab guaranteed even for `{expenseTabs:[]}`.
4. **Empty-vs-absent** — a tab with `columns:[]` is NOT re-injected; a row with `values:{}` is NOT re-folded.
5. **Fixed-id/format** — DEFAULT_COLUMNS ids/types/formats exactly as the table; `col_price` currency/2, `col_qty` plain/0.
6. **Cascade cores** — `stripColumn` removes col + strips key from in-tab rows; `stripOption` removes single (key deleted) + filters multi (array); `cloneValues` deep-copies (mutate clone's array ⇒ source unchanged); `coerceCell` (`"10"`→`10`, `""`→undefined, multiSelect→array); `writeCell` empty ⇒ key removed, `0` ⇒ key kept.

Run with `npm run check:expenses` (main loop, after files land).

---

## 8. UI component contract (`src/features/expenses/`)

Two groups of files. **Group B = leaf presentational** (no knowledge of actions/state; pure callback props). **Group C = container/integration** (owns optimistic state + wires actions + composes B). Both are `"use client"`.

### Shared idioms to reuse (from the codebase)
- Grid shell (NOT `.paper-card` — it clips): `bg-cream-card border-[2.2px] border-forest rounded-card shadow-hard-sm` + an inner `overflow-x-auto` scroll region.
- Cell inputs: `TextField`/`NumberField` with `variant="bare"` (from `@/components/form`). `NumberField` supports `prefix="₱"`, `inputClassName`, and owns its own focus-draft string — pass numeric `value`, parse `e.target.value` in `onChange`.
- Header recipe: `font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft`.
- **All popovers/menus MUST `createPortal` to `document.body`** (the scroll container + card clip fixed overlays). z-index: backdrop `z-[55]`, panel `z-[56]`.
- Menu/panel skin: `bg-cream-card border-2 border-forest rounded-[10px] shadow-hard-sm p-1`; items `font-mono text-[.66rem] hover:bg-cream-light`; danger = `text-clay`.
- Inline rename: swap label → autofocused `.field-box` input, `select()` on mount, Enter/blur commit, Escape cancel (TabBar/DocRow idiom).
- Active/highlight: `bg-matcha-fill text-forest`.
- dnd-kit: single `DndContext`, `PointerSensor {activationConstraint:{distance:5}}` (so a click still edits/opens-menu), `KeyboardSensor {coordinateGetter: sortableKeyboardCoordinates}`; disambiguate `active.data.current.type` (`"column"` vs `"row"`); `horizontalListSortingStrategy` for columns, `verticalListSortingStrategy` for rows; `CSS.Transform.toString(transform)` from `@dnd-kit/utilities`.

### Group B — leaf components (files it OWNS)
```
src/features/expenses/format.js
  export function formatNumber(value, fmt);  // fmt = {style,precision}; currency → "₱" prefix + grouping + fixed decimals; plain → grouping + decimals; empty → ""
  export function parseNumber(str);          // "" → undefined; else Number, drop NaN

src/features/expenses/optionColors.js
  export const OPTION_COLORS;                // 8 entries [{ name, token }]: forest,--c-forest | leaf,--c-matcha | sage,--c-olive | clay,--c-clay | caramel,--c-cat-authentic | brown,--c-brown-soft | mauve,--c-cat-unique | sand,--c-kraft
  export function nextOptionColor(count);    // cycle warm↔cool by index → a color NAME
  export function optionChip(colorName);     // -> { style } inline: fill rgb(var(--c-<token>)/0.18), border …/0.45, text solid token (forest for pale). Map name→token via OPTION_COLORS.

src/features/expenses/CursorMenu.jsx        // portaled { pos:{x,y}, onClose, children } — backdrop + panel + Escape (the RowMenu markup)
src/features/expenses/AnchoredPopover.jsx   // portaled { rect, onClose, children, width? } — anchored under a getBoundingClientRect rect, clamped to viewport (DrinkCard openAdd idiom)

src/features/expenses/cells/Cell.jsx        // dispatcher { column, value, onCommit, onCreateOption } → renders the right editor by column.type
src/features/expenses/cells/TextCell.jsx    // { value, onCommit } — TextField variant="bare"; commit on blur, revert on Escape
src/features/expenses/cells/NumberCell.jsx  // { column, value, onCommit } — formatted right-aligned span ⇄ bare NumberField on focus; ₱ via numberFmt/format.js; commit on blur
src/features/expenses/cells/DateCell.jsx    // { value, onCommit } — TextField type="date" variant="bare"
src/features/expenses/cells/SelectCell.jsx  // { column, value, onCommit, onCreateOption } — chip + portaled listbox (search, colored options, "None", "＋ Create x")
src/features/expenses/cells/MultiSelectCell.jsx // { column, value, onCommit, onCreateOption } — chips (+N overflow) + portaled checklist (toggle, "＋ Create x", clear all)

src/features/expenses/ColumnMenu.jsx        // { column, pos, onClose, onRename, onDelete, onSetFormat, onEditOptions } — uses CursorMenu. Items: ✎ Rename (→onRename()), [number: format submenu → onSetFormat({style,precision})], [select: 🏷 Edit options → onEditOptions()], 🗑 Delete column (→onDelete())
src/features/expenses/AddColumnPopover.jsx  // { rect, onClose, onCreate } — name .field-box (default "Column N", selected) + type list (Text📝/Number#/Date📅/Single select◉/Multi-select🏷). Enter/click → onCreate(name, type). Escape/backdrop close.
src/features/expenses/OptionsEditor.jsx     // { column, rect, onClose, onAddOption, onUpdateOption, onDeleteOption } — list options: swatch(recolor via palette grid)+inline name+🗑; ＋ Add option
```

**Callback contract (what B calls; C provides):**
- `Cell.onCommit(value)` — value already typed for the column (string | number | string[]). C binds `(rowId, colId)`.
- `Cell.onCreateOption(name) -> Option` — C creates the option optimistically (mints id + `nextOptionColor`), fires `addOption`, and returns the new `{id,name,color}` synchronously so the cell can select it. Select/multiSelect only.
- `ColumnMenu.onRename()` — signals C to start inline-rename in the header (Grid owns the input).
- `ColumnMenu.onSetFormat({style,precision})` — number columns.
- `ColumnMenu.onEditOptions()` — C opens `OptionsEditor` for the column.
- `ColumnMenu.onDelete()` — C fires `deleteColumn`.
- `AddColumnPopover.onCreate(name, type)` — C mints the column (uuid, width 160, default `number`/`options` for the type) + fires `addColumn`.
- `OptionsEditor.onAddOption(name)` / `onUpdateOption(optionId, patch)` / `onDeleteOption(optionId)`.

B does NOT import actions, state, or C. B components are pure given props. B may import from `@/components/form`, `expenseModel.mjs` (for `numberFmt`), its own `format.js`/`optionColors.js`, dnd-kit, react.

### Group C — container + grid (files it OWNS)
```
src/features/expenses/ExpensesPlanner.jsx   // REWORK: optimistic tabs (with columns) + rows; wires ALL §6 actions
src/features/expenses/ExpensesGrid.jsx      // NEW (replaces ExpensesTable.jsx): TanStack v8 + DndContext + scroll shell + sticky + header cells (drag handle, ▾ caret→ColumnMenu, right-edge resize) + Cell per cell + row drag gutter + row CursorMenu (Duplicate/Delete) + ＋ Add row + trailing ＋ Add column (→AddColumnPopover) + mounts ColumnMenu/OptionsEditor
DELETE src/features/expenses/ExpensesTable.jsx
DELETE src/features/expenses/calc.js
```

**ExpensesPlanner responsibilities:**
- State: `tabs` (`[{id,name,columns}]`), `rows` (`[{id,tabId,values}]`), `activeTabId`. Seed from props (`initialTabs`, `initialExpenses`) — already migrated by the server.
- `activeTab` (guard deleted), `activeColumns = activeTab.columns`, `activeRows = rows.filter(r => r.tabId === activeId)`.
- Handlers (each = optimistic `setState(...)` then `startTransition(() => action(...))`):
  - `onSetCell(rowId, colId, value)` → optimistic `writeCell` into that row's `values`; action `setExpenseCell`.
  - `onAddRow()` → `{id:uuid, tabId, values:{}}`; `addExpense`.
  - `onDeleteRow(id)` → `removeExpense`.
  - `onDuplicateRow(id)` → mint `newId`; optimistic clone with `cloneValues`; `duplicateExpense(id, newId, id)`.
  - `onReorderRows(orderedIds)` → reorder activeRows in the global list; `reorderExpenses`.
  - `onAddColumn(name, type)` → mint column (uuid, width 160, `number:{style: type==='number'?'plain':undefined, precision:0}` only for number, `options:[]` for select/multiSelect); `addColumn`.
  - `onRenameColumn(colId, name)` / `onResizeColumn(colId, width)` / `onSetColumnFormat(colId, number)` → `updateColumn`.
  - `onReorderColumns(orderedIds)` → reorder `activeTab.columns`; `reorderColumns`.
  - `onDeleteColumn(colId)` → optimistic `stripColumn`; `deleteColumn`.
  - `onAddOption(colId, name) -> Option` / `onUpdateOption(colId, optionId, patch)` / `onDeleteOption(colId, optionId)` → `addOption`/`updateOption`/`deleteOption` (delete uses optimistic `stripOption`).
  - Tabs: `addTab` builds `{id:uuid, name:"Sheet N", columns: defaultColumns()}` + `addExpenseTab`; `renameTab`; `deleteTab`.
- Use the shared pure helpers (`writeCell`, `cloneValues`, `stripColumn`, `stripOption`) from `expenseModel.mjs` for optimistic updates — same functions the server uses.

**ExpensesGrid — TanStack v8 setup (from the tech spec):**
- Install target already added: `@tanstack/react-table@^8`, `@dnd-kit/modifiers`.
- `columnDefs` built from `activeColumns`: each `{ id: col.id, accessorFn: (row) => row.values[col.id], size: col.width, meta: { col } }`. `defaultColumn: { minSize: 64, maxSize: 800 }`.
- `useReactTable({ data: activeRows, columns: columnDefs, columnResizeMode: "onChange", state: { columnSizing, columnOrder }, onColumnSizingChange, onColumnOrderChange, getCoreRowModel: getCoreRowModel() })`.
- `columnOrder` seeded `activeColumns.map(c=>c.id)`; `columnSizing` seeded `Object.fromEntries(activeColumns.map(c=>[c.id,c.width]))`. **Seed from props, never localStorage/window during render** (hydration).
- **Widths via CSS variables** + a memoized body (`React.memo`, swap in only while `columnSizingInfo.isResizingColumn`) for 60fps.
- **Persist width** on the `columnSizingInfo.isResizingColumn` → null transition (`useEffect`) → `onResizeColumn(colId, newWidth)` for the resized column.
- **Column reorder:** dnd-kit `DndContext` + `SortableContext(horizontalListSortingStrategy)` over header cells (ids = column ids), `restrictToHorizontalAxis` modifier; on drag end `arrayMove` + `onReorderColumns`. Drag `listeners` on a **dedicated ⠿/header grab element**; the **resize strip is a separate element** whose `onMouseDown`/`onTouchStart` calls `e.stopPropagation()` before `header.getResizeHandler()`.
- **Row reorder:** the same `DndContext`, a vertical `SortableContext` over row ids; a sticky left **drag gutter** per row; on drag end → `onReorderRows`. Disambiguate from column drag via `active.data.current.type`.
- **Sticky:** left drag-gutter + first data column `position:sticky; left:0`, opaque `bg-cream-card`, right seam border; header sticky cells a higher z than body sticky cells; keep menus at `z-[55/56]` (above sticky).
- Header cell: grab zone (`cursor:grab`), a `▾` caret (hover) → open `ColumnMenu` at cursor/rect, **double-click** → inline rename input (commit like TabBar), right-edge 6px resize strip (`cursor:col-resize`).
- Row: right-click **and** a visible `⋯` button → `CursorMenu` with **⧉ Duplicate row** / **🗑 Delete row**.
- `＋ Add row`: full-width dashed button **below** the scroll region (keep current styling). `＋ Add column`: trailing header cell → opens `AddColumnPopover` anchored to it.
- ARIA: `role="grid"`/`row`/`columnheader`/`gridcell`; resize strip `role="separator" aria-orientation="vertical"`; keep per-cell `aria-label`s.

C imports: `@/config/actions` (§6), `@/config/expenseModel.mjs` (pure helpers), Group B components, `@tanstack/react-table`, `@dnd-kit/*`, react.

---

## 9. `src/app/expenses/page.js` (EDIT)
Keep `force-dynamic` + the `Promise.all([repo.expenseTabs(), repo.expenses()])` → `<ExpensesPlanner initialTabs initialExpenses />`. **Update the `SectionHeader sub` copy** — drop "totals, shares & a grand total auto-calculate"; describe: add columns of any type (text/number/date/select), drag to reorder & resize, right-click rows to duplicate/delete, shared with the team.

---

## 10. Out of scope (YAGNI for v1)
No totals/sum/formula columns · no column type-change (delete+re-add) · no option drag-reorder · no per-browser width prefs · no vertical sticky header · no multi-line text · no cell-range selection/copy-paste · no undo history. `RowMenu` is **not** hoisted (expenses keeps its own `CursorMenu`) to avoid cross-feature churn.

## 11. Verification (main loop only — agents do NOT build/lint/dev)
1. `npm i @tanstack/react-table@^8 @dnd-kit/modifiers`
2. `npm run check:expenses` (pure migration/cascade tests)
3. `npm run build` (runs the Zod parse on static gen — catches bad migration)
4. `npm run lint`
5. Runtime smoke: clean prod build, `next start -p <port>`, poll, assert `/expenses` 200 + grid markup, `kill`, `rm -rf .next`.
6. Then update CLAUDE.md's Expense-planner bullet + the shared-state field shapes, and MEMORY if warranted.
