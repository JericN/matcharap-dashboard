# Expenses undo / redo — design & implementation contract

**Date:** 2026-07-07 · **Feature:** per-browser undo + redo for the `/expenses` flexible table.

Approved decisions: **per-browser** (undo *your own* actions this session) · **everything** undoable · **undo + redo** · surface = **keyboard + toolbar button + delete toast**.

## 1. Architecture — per-browser inverse-command stack

Two in-memory stacks in the client (session-scoped; cleared on reload — standard for undo). Every mutating handler is factored into an `apply*(…)` primitive (optimistic `setData` + the server action) and a public handler that: (a) captures the "before" state it needs, (b) calls `apply*`, (c) pushes a command `{ undo, redo, label }` whose closures call `apply*` functions.

- `undo()` → pop undo stack, run `cmd.undo()`, push to redo stack.
- `redo()` → pop redo stack, run `cmd.redo()`, push to undo stack.
- Any *new* action clears the redo stack. Undo stack capped at **50**.
- Inverses go through the **existing single-item / atomic-restore server actions**, so undoing your edit never clobbers a teammate's concurrent edit to a *different* cell/column (same-cell = last-write-wins, rare).

### State refactor (enables clean cross-field undo)
`ExpensesPlanner` currently holds `tabs` and `rows` in two `useState`s. Combine into **one** `const [data, setData] = useState({ tabs, rows })` so cross-field ops (delete/restore column, delete/restore sheet) mutate both atomically via a single **functional** `setData(d => …)`. `activeTabId` stays separate. All `apply*` use functional `setData` updaters so replayed undo closures operate on fresh state. Derive `const { tabs, rows } = data;`.

## 2. `useUndo` hook — `src/features/expenses/useUndo.js`
Refs (not state) hold the stacks so `cmd.undo()/redo()` side-effects never run inside a React state-updater (StrictMode double-invoke safety); a `useReducer` counter forces re-render for button state.
```
useUndo() → { push(cmd), undo(), redo(), canUndo, canRedo, undoLabel, redoLabel }
```
`push/undo/redo` are `useCallback([])`-stable (they only touch refs + the force dispatcher). `cmd = { undo: ()=>void, redo: ()=>void, label: string }`.

## 3. `apply*` primitives + command per op (in `ExpensesPlanner`)

| Op | apply* | undo | redo | captured before |
|----|--------|------|------|-----------------|
| cell edit | `applySetCell(rowId,colId,v)` | set back to old | re-apply | old value (`values[colId]`, may be undefined→"") |
| add row | `applyAddRow(row)` | `applyRemoveRow(row.id)` | re-add | — |
| duplicate row | `applyInsertRow(copy, afterId)` | `applyRemoveRow(copy.id)` | re-insert | — |
| delete row | `applyRemoveRow(id)` | `applyInsertRow(row, afterId)` | remove | full row + predecessor id (afterId) |
| reorder rows | `applyReorderRows(ids)` | reorder to old ids | reorder to new | old order |
| add column | `applyAddColumn(col)` | `applyDeleteColumn(col.id)` | re-add | — |
| rename/resize/format col | `applyUpdateColumn(colId,patch)` | update to old patch | update to new | old values of patched keys |
| reorder columns | `applyReorderColumns(ids)` | reorder to old | reorder to new | old order |
| **delete column** | `applyDeleteColumn(colId)` | `applyRestoreColumn(col,index,cells)` | delete | col def + index + `cells=[{rowId,value}]` (non-empty cells of that col) |
| add option | `applyAddOption(colId,opt)` | `applyDeleteOption(colId,opt.id)` | re-add | — |
| update option | `applyUpdateOption(colId,optId,patch)` | update to old | update to new | old {name,color} |
| **delete option** | `applyDeleteOption(colId,optId)` | `applyRestoreOption(colId,opt,index,cells)` | delete | option + index + `cells=[{rowId,value}]` (cells that referenced it, full prior value) |
| add sheet | `applyAddTab(tab)` | `applyRemoveTab(tab.id)` | re-add | — |
| rename sheet | `applyRenameTab(id,name)` | rename to old | rename to new | old name |
| **delete sheet** | `applyRemoveTab(id)` | `applyRestoreTab(tab,index,rows)` | remove | tab def + index + its rows |

`applyRemoveRow(id)` optimistic-filters + `removeExpense(id)`. `applyInsertRow(row, afterId)` optimistic-splices-after-afterId (afterId null → front for undo restore) + `addExpense(row, afterId)`. Deleting the last sheet stays blocked (no command pushed). On undo of a sheet delete, set `activeTabId` to the restored tab.

## 4. New server ops (mirror `stripColumn`/`stripOption` shape; RMW off fresh state)

**Pure (`expenseModel.mjs`, shared by repo + client optimistic + tests):**
```
insertAt(arr, item, index)                                  // new array, index clamped to [0,len]
restoreColumn(tabs, rows, tabId, column, index, cells)      // → {tabs,rows}: insert col at index; writeCell each {rowId,value} for column.id
restoreOption(tabs, rows, tabId, colId, option, index, cells) // → {tabs,rows}: insert option at index in the column; writeCell each {rowId,value} for colId
restoreTab(tabs, rows, tab, index, tabRows)                 // → {tabs,rows}: insert tab at index; append tabRows to rows
```
`cells` entries carry the value to `writeCell` (which drops empties, so a restored cell equal to "" clears — but we only capture non-empty cells anyway).

**`repo.js`:** `restoreColumn(tabId, column, index, cells)`, `restoreOption(tabId, colId, option, index, cells)`, `restoreTab(tab, index, rows)` — each one `mutate(s => {const {tabs,rows}=<pure>(s.expenseTabs,s.expenses,…); return {...s, expenseTabs:tabs, expenses:rows};})`.

**`actions.js`:** three `'use server'` wrappers, each `revalidatePath("/expenses")`.

## 5. UI surface

- **`useUndo` keyboard** (effect in `ExpensesPlanner`): `window` keydown; `(metaKey||ctrlKey) && key==='z'` → `shiftKey ? redo() : undo()`; **skip when `document.activeElement` is INPUT/TEXTAREA/contentEditable** (let native text-undo win while editing a cell); `preventDefault` otherwise.
- **`UndoControls.jsx`** — `{ canUndo, canRedo, undoLabel, redoLabel, onUndo, onRedo }`: two small buttons **↶ / ↷** styled like the existing `.chip`/icon buttons, `disabled` + dimmed when their stack is empty, `title` = `Undo <label>` / `Redo <label>`. Rendered next to `TabBar` (same row, right-aligned).
- **`Toast.jsx`** — portaled to `document.body`, bottom-center, `z-[60]` (above menus): `{ message, onUndo, onClose }`, a compact card (paper skin) "**<message> · Undo**", auto-dismiss after **5s** (`setTimeout`, cleared on unmount/replace). Shown only after **delete** ops (row/column/option/sheet). Any new pushed command clears the current toast (so its Undo always maps to the latest delete).

## 6. Edge cases
- Reload → stacks empty (in-memory).
- Undo a target a teammate already removed → the inverse action no-ops gracefully (`removeExpense`/`setExpenseCell`/`deleteColumn` all no-op on a missing id).
- First-row delete undo restores data with the row appended (afterId null) — data always correct, position may differ only for a first-row restore.
- Toast Undo == `undo()` (top of stack); cleared on any subsequent action so it can't undo the wrong thing.

## 7. Files
- `src/features/expenses/ExpensesPlanner.jsx` — combine state into `data`; `apply*` + handlers + command pushes; mount `useUndo`, keyboard effect, `UndoControls`, `Toast`.
- NEW `src/features/expenses/useUndo.js`, `UndoControls.jsx`, `Toast.jsx`.
- `src/config/expenseModel.mjs` — `insertAt` + 3 restore helpers.
- `src/config/repo.js` + `src/config/actions.js` — 3 restore ops/wrappers.
- `scripts/check-expenses.mjs` — restore-helper tests (insert-at-index, cell restore, cross-tab isolation).

## 8. Verify
`npm run check:expenses` · `npm run build` · `npm run lint` · Playwright E2E in a throwaway sheet: delete a row / column / option / sheet then **undo** each and assert the data returns; **redo** re-removes; cell-edit undo/redo; keyboard + button + toast paths. Delete the throwaway sheet + Redis backstop.

## 9. Out of scope (YAGNI)
No persistent (cross-reload) history · no collaborative/global undo · no undo of hearts/other pages · no coalescing of rapid keystrokes into one undo step (each committed cell edit = one step).
