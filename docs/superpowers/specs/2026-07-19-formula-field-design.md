# Formula field — design & implementation contract

**Date:** 2026-07-19 · **Feature:** a new **formula** column type for the use-agnostic DataTable module (`src/modules/datatable/`, consumed by `/expenses`): a derived, display-only column whose value is computed from an expression over the row's other columns (e.g. `{Price} * {Qty}`), powered by a **modular, extensible expression engine**.

Single source of truth for implementation — every name/shape/signature is **pinned**. Where ambiguous, prefer the existing repo idiom (`model.mjs`, `linkDerive.mjs`, `LinkFieldConfig.jsx`, `repo.js`).

**Guiding constraints:** *simple v1, engine built for extension.* Adding a new operator or function later must be a **one-entry registry change** — never a parser/evaluator edit. Display-only in v1 (formula columns aren't filterable/sortable yet), consistent with link/lookup/rollup. Module stays use-agnostic (imports nothing from `@/config`/`@/features`).

---

## 1. Scope (approved)

| Decision | Choice |
|---|---|
| v1 capability | Arithmetic (`+ - * / %`, unary `-`, parens) + comparisons (`> < >= <= = !=`) + a starter function set (`ROUND ABS MIN MAX SUM IF`). |
| References & value types | `{Column Name}` in the editor; **typed values** (`number \| string \| boolean \| undefined`). Result auto-typed. |
| Ref storage | **By immutable column id** (`{col_id}` in the stored expr), rename-proof. Editor translates names↔ids. |
| Filter/sort | **Display-only in v1** — excluded from Filter/Sort field pickers (like link/lookup/rollup). |
| Formula → formula refs | **Allowed, with cycle detection** (`#ERR: circular reference`, never an infinite loop). |

**Explicitly OUT of v1 (each is a reserved registry/seam extension, not a dead end):** text operators (`&`, CONCAT/UPPER/LEN), logical `AND`/`OR`/`NOT` as functions, date math, more math funcs (FLOOR/CEIL/POW/…), referencing link/lookup/multiSelect columns, filter/sort on formula results, and formatting beyond the existing `number` format.

---

## 2. Where the code lives (module layout)

```
src/modules/datatable/
  formula/                 // NEW — the pure, dependency-free expression engine (Node-testable, client-consumed)
    tokenize.mjs           //   expr string → token[]
    parse.mjs              //   token[] → AST  (Pratt / precedence-climbing; reads precedence FROM registry)
    evaluate.mjs           //   AST + scope + registry → typed value
    registry.mjs           //   OPERATORS + FUNCTIONS tables  ← the ONLY file you touch to add features
    index.mjs              //   public API: compile(expr) → {ast,error};  run(ast, scope) → {value,error}
    refs.mjs               //   {Name}↔{id} translation + resolveRef (editor + eval boundary helpers)
  formulaModel.mjs         // NEW — read-side glue: evalFormula(column, row, columns, opts) → {value, error} (builds scope, runs engine, cycle guard)
  cells/FormulaCell.jsx    // NEW — read-only result render (number fmt / text / bool / #ERR / —)
  FormulaConfig.jsx        // NEW — create+edit config panel (expression editor + column-insert list + live validation)
  Cell.jsx                 // +1 dispatch arm
  Grid.jsx                 // ColumnGhost formula arm; pass columns/onEditFormula through; AddColumnPopover formula step wiring
  AddColumnPopover.jsx     // + "ƒ Formula" type + config step
  ColumnMenu.jsx           // + "Edit formula" (+ number-format controls for numeric results)
  DataTable.jsx            // addFormulaColumn (via existing addColumn path) + onEditFormula (updateColumn) + undo
  FilterEditor.jsx/SortEditor.jsx  // extend the derived-exclusion predicate to include "formula"
```

**Boundary rules:**
- The `formula/` engine + `formulaModel.mjs` are **dependency-free** (no react/zod/dnd-kit), no `"use client"`, `globalThis.crypto` only if needed. Pure and Node-testable. Deps point downward to `model.mjs` (e.g. `numberFmt`, coercion helpers) only.
- The engine is **client-consumed** (FormulaCell + config validation). Unlike `linkModel.mjs`, the **server DAL does NOT import it** — formulas are never evaluated or stored server-side; the server treats `formula.expr` as an opaque string.
- Consumer (`src/config/`) owns only the tiny schema change; no new server action.

---

## 3. Data model (PINNED)

```
Column (EXTENDED):
  { id, name, type, width, number?, options?, link?, lookup?, rollup?, formula? }
  type ∈ … | "formula"
  formula = { expr }            // present only when type==="formula"
             expr : string      // the expression, refs stored as {col_id} tokens (NOT names)   [editable]
  // formula columns MAY also carry `number` (the existing {style,precision}) for numeric results.

Row: UNCHANGED. Formula columns store NOTHING in `values` (fully derived at render).
```

- **Zod:** add `"formula"` to `ColumnSchema.type`; add `formula: z.object({ expr: z.string() }).optional()`. **Permissive** — a malformed/dangling expr never throws at `StateSchema`; caught at eval. `coerceCell` returns `undefined` for `type==="formula"` (never stored); `setExpenseCell` already guards derived columns.
- **Ref storage = column id.** The stored `expr` contains `{col_abc123}` tokens. Renaming a column does not touch stored formulas (they resolve by id). The **editor** renders `{Column Name}` and, on save, maps each `{Name}` the user typed to `{id}` (`namesToIds`); on load, maps `{id}`→`{Name}` for display (`idsToNames`). An unresolved name stays literal and surfaces as an eval error.
- **No cell storage / no migration.** Opt-in new type; existing tabs unaffected.

---

## 4. The engine (PINNED signatures)

All pure, in `src/modules/datatable/formula/`. The token/AST shapes are internal; the public surface is `index.mjs`.

**`tokenize.mjs`** — `tokenize(src) -> Token[]` (throws a typed `FormulaError` on an illegal character; `index.compile` catches it).
Tokens: `{t:"num",v}` `{t:"str",v}` `{t:"ref",id}` (the raw text inside `{…}`) `{t:"ident",v}` (function name / `true`/`false`) `{t:"op",v}` `{t:"lparen"|"rparen"|"comma"}`.

**`registry.mjs`** — the extensibility seam (two plain objects):
```
OPERATORS = {
  "+": { prec: 10, fn: (a,b)=>num(a)+num(b) },
  "-": { prec: 10, fn: (a,b)=>num(a)-num(b) },
  "*": { prec: 20, fn: (a,b)=>num(a)*num(b) },
  "/": { prec: 20, fn: (a,b)=> div(a,b) },      // div-by-zero → FormulaError
  "%": { prec: 20, fn: (a,b)=> mod(a,b) },
  ">": { prec: 5,  fn: (a,b)=> cmp(a)>cmp(b) },  … "<" ">=" "<=" "=" "!="
}
UNARY = { "-": (a)=>-num(a) }
FUNCTIONS = {
  ROUND: { min:1, max:2, fn:(n,d=0)=> … },
  ABS:   { min:1, max:1, fn:(n)=>Math.abs(num(n)) },
  MIN:   { min:1, max:Infinity, fn:(...a)=>Math.min(...a.map(num)) },
  MAX:   { min:1, max:Infinity, fn:(...a)=>Math.max(...a.map(num)) },
  SUM:   { min:1, max:Infinity, fn:(...a)=>a.reduce((s,x)=>s+num(x),0) },
  IF:    { min:3, max:3, lazy:true, fn:(cond,a,b)=> truthy(cond()) ? a() : b() },  // lazy: args are THUNKS
}
```
`num`/`cmp`/`truthy`/`div`/`mod` are typed-coercion helpers (a shared `coerce.mjs` or top of registry). A type error (e.g. `num("abc")`) throws a `FormulaError`. **Adding a function/operator = adding one entry here.** A function marked `lazy:true` receives its args as **thunks** (`()=>value`) so it can choose which to evaluate (e.g. `IF` only evaluates the taken branch — `IF({B}=0, 0, {A}/{B})` never divides by zero when `B=0`); non-lazy functions receive already-evaluated values.

**`parse.mjs`** — `parse(tokens) -> Ast` (Pratt parser; binary precedence read from `OPERATORS[sym].prec`, so a new operator needs no parser edit). AST nodes: `{k:"num"|"str"|"bool"|"ref"|"unary"|"binary"|"call", …}`. Throws `FormulaError` on a syntax error (unexpected token, unmatched paren, unknown function name checked here or at eval).

**`evaluate.mjs`** — `evaluate(ast, scope) -> value` where `scope = { getRef(id) -> value, registry }`. Walks the AST; `ref`→`scope.getRef(id)`; `binary`/`unary`→`OPERATORS`/`UNARY`; `call`→`FUNCTIONS` (validates arity against `min/max`; for a `lazy:true` function it passes each arg as a thunk `()=>evaluate(argAst, scope)` rather than an evaluated value). Throws `FormulaError` on any eval problem.

**`index.mjs`** — the ONLY thing outside the engine imports:
- `compile(expr) -> { ast: Ast|null, error: string|null }` — tokenize+parse, catching `FormulaError` → `{ast:null, error}`. Pure, memoizable per column.
- `run(ast, scope) -> { value: any, error: string|null }` — evaluate, catching `FormulaError` → `{value:undefined, error}`.
- Re-exports `OPERATORS`/`FUNCTIONS` names (for the config editor's autocomplete hint, optional).

**`refs.mjs`** — editor/eval boundary:
- `namesToIds(expr, columns) -> string` / `idsToNames(expr, columns) -> string` — rewrite `{…}` tokens between the human name and the id (pure string transforms; unmatched tokens left intact).
- `refColumnIds(expr) -> string[]` — the column ids a compiled/stored expr references (for cycle detection + dependency display).

---

## 5. Read-side glue — `formulaModel.mjs`

`evalFormula(column, row, columns, ctx = null, visiting = new Set()) -> { value, error }` (`ctx` = the cross-table link ctx, needed only to resolve rollup refs; `null` ⇒ rollup refs resolve to `undefined`):
1. `compile(column.formula.expr)` (memoize per (colId,expr) — a module-level `Map` keyed by expr string is fine; pure).
2. Build `scope.getRef(id)`:
   - find the referenced column in `columns` by id; missing → `FormulaError("unknown field")`.
   - **cycle guard:** if the ref is itself a `formula` column: if `id ∈ visiting` → `FormulaError("circular reference")`; else recurse `evalFormula(refCol, row, columns, visiting ∪ {colId})` and use its value (propagate its error).
   - otherwise resolve the cell to a **typed value** via `refValue(refCol, row.values[id])`:
     - number→number(or undefined), text/date→string, checkbox→boolean, select→option **name** string, rollup→its numeric value (compute via `linkDerive.rollupValue` if ctx available — else undefined), link/lookup/multiSelect→`FormulaError("unsupported field type")`, empty→undefined.
3. `run(ast, scope)` → `{value, error}`.

*(Rollup refs need cross-table `ctx`; if `FormulaCell` has it, pass it through `opts`. If not available, rollup refs resolve to `undefined` — a documented v1 limitation, not a crash.)*

**Node test:** `scripts/check-formula.mjs` (`npm run check:formula`, mirrors `check-links.mjs`): tokenizer, parser precedence (`2+3*4===14`, `(2+3)*4===20`), every operator + function, `IF` branch selection, typed coercion, `{ref}` resolution via a stub `columns`/`row`, cycle detection, and each error class (bad char, syntax, unknown field, arity, div-by-zero, type mismatch, cycle).

---

## 6. UI

- **`FormulaCell.jsx`** — read-only `FormulaCell({ column, row, columns, ctx })`: `evalFormula(...)` → render:
  - `error` → a small `#ERR` chip (`title={error}` tooltip), clay-colored.
  - `value` number → `formatNumber(value, numberFmt(column))` right-aligned.
  - string → text (clipped by the fixed row height).
  - boolean → `✓` (true) / `·` (false).
  - `undefined`/empty → `—`.
- **`FormulaConfig.jsx`** — reused create + edit (mirrors `LinkFieldConfig`): a monospace expression `<textarea>` (value shown with `{Column Name}`), a **click-to-insert** row of the table's insertable columns (non-derived + rollup), and **live validation** — on each change, `namesToIds` then `compile`; a parse error renders inline (red hint) but does not block saving (Airtable lets you save a broken formula; the cell shows `#ERR`). Emits the id-form expr to the caller.
- **`AddColumnPopover.jsx`** — `{ type:"formula", label:"Formula", icon:"ƒ" }`; picking it opens the formula config step; confirm → `onCreateFormula(name, exprIdForm)`.
- **`ColumnMenu.jsx`** — for `type==="formula"`: "ƒ Edit formula" (opens `FormulaConfig` in an `AnchoredPopover`, seeded via `idsToNames`, commit via `applyUpdateColumn({formula:{expr}})` + undo with the no-op dirty-check) + the existing number-format controls (results are often numeric).
- **`Cell.jsx`** + Grid `ColumnGhost`: `case "formula": <FormulaCell …/>`.
- **Filter/Sort:** extend the existing `DERIVED`/exclusion predicate in `FilterEditor.jsx`/`SortEditor.jsx` to also drop `"formula"`.

`columns` for the config + cell = the FULL active-tab columns (the `link.columns` bundle already threads this to Grid/AddColumnPopover from the linked-fields work — reuse it; rename the bundle field mentally to "config columns" but keep the key).

### 7. Server / DataTable wiring
- `DataTable.addFormulaColumn(name, expr)` builds `{ id: uid(), name, type:"formula", width:160, formula:{ expr } }`, creates via the existing `applyAddColumn` + undo (mirrors `addDerivedColumn`). Edit via `onEditFormula(colId, {expr})` → `applyUpdateColumn` + undo. No new adapter method / server action (uses existing `addColumn`/`updateColumn`/`deleteColumn`).
- Schema: `ColumnSchema` gains the `"formula"` enum member + `formula` object (Task in Stage 2). `coerceCell` gains a `"formula"` → `undefined` arm.

### 8. Error handling
One `FormulaError` class (a plain `Error` subclass with a short message) thrown by tokenize/parse/evaluate; `compile`/`run` catch it and return `{error}`. Nothing in the render path throws. Messages are short + user-facing: `unexpected "…"`, `unknown field`, `ROUND expects 1–2 arguments`, `divide by zero`, `expected a number`, `circular reference`.

### 9. Staging
1. **Engine + tests** — `formula/` (tokenize/parse/evaluate/registry/index/refs) + `formulaModel.mjs` + `scripts/check-formula.mjs`. Fully headless-verifiable (`npm run check:formula`).
2. **Schema + UI end-to-end** — `ColumnSchema`/`coerceCell` arm, `FormulaCell`, `FormulaConfig`, `AddColumnPopover`/`ColumnMenu`/`Cell`/`Grid`/`DataTable` wiring, Filter/Sort exclusion + `npm run check:formula` script. Verify: `check:formula` + `check:views`/`check:expenses` + lint + `npm run build` + `/expenses` smoke.

## 10. Verification checklist
- `npm run check:formula` green (tokenize/parse/eval/registry/refs/cycles/errors).
- `npm run build` green (Zod parse with the extended `ColumnSchema`).
- `/expenses` 200 with a formula column present.
- Manual (throwaway sheet): `{Price}*{Qty}`, `ROUND({A}/{B}, 2)`, `IF({Qty}>10, "bulk", "unit")`, a `#ERR` on a bad expr, a formula referencing another formula (works) and a self/cyclic reference (`#ERR: circular reference`), rename a referenced column (formula still resolves — id-based).

## 11. Reserved seams (future, no reshape needed)
Text ops/functions, logical funcs, date math, more math → add to `FUNCTIONS`/`OPERATORS`. Filter/sort on formulas → `evalFormula` already yields a primitive; flip the exclusion predicate + have the view engine call it. Referencing link/lookup/multiSelect → extend `refValue`. Autocomplete/`{Name}` chip editor → a richer `FormulaConfig`, engine unchanged.
