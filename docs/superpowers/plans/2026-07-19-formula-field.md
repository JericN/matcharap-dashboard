# Formula Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a derived, display-only **formula** column type to the `src/modules/datatable/` engine (used by `/expenses`): a column whose value is computed from an expression over the row's other cells (e.g. `{Price} * {Qty}`), powered by a modular tokenize→parse→evaluate engine with a registry extension seam.

**Architecture:** A pure, dependency-free `formula/` subpackage — `tokenize` → `parse` (Pratt, precedence from the registry) → `evaluate` (dispatches through the registry) — plus `formulaModel.mjs` read-side glue (builds the ref scope, cycle detection). The engine is **client-consumed only** (FormulaCell + config validation); the server just stores an opaque `formula.expr` string. Adding an operator/function = one entry in `registry.mjs`.

**Tech Stack:** Next.js 14 + React, Zod (`schemas.js`), Node `assert/strict` test scripts. Pure `.mjs` ES modules.

## Global Constraints

- The `formula/` engine + `formulaModel.mjs` are **dependency-free** (no react/zod/dnd-kit), no `"use client"`, deps point downward to `./model.mjs` / `./linkDerive.mjs` only. Node-testable.
- The **server DAL does NOT import the engine** — formulas are never evaluated or stored server-side. Server treats `formula.expr` as an opaque string. No new server action / adapter method — create via existing `addColumn`, edit via `updateColumn`, delete via `deleteColumn`.
- **Refs are stored by column id** (`{col_id}` tokens), never by name — rename-proof. The editor translates `{Name}`↔`{id}` at its boundary.
- **Nothing in the render path throws** — `compile`/`run` catch `FormulaError` and return `{error}`; FormulaCell shows `#ERR`.
- Formula columns are **display-only** (excluded from Filter/Sort field pickers, like link/lookup/rollup). Zod stays permissive (a bad expr never throws at `StateSchema`). `coerceCell` returns `undefined` for `type==="formula"` (never stored).
- v1 registry: operators `+ - * / % > < >= <= = !=` + unary `-`; functions `ROUND ABS MIN MAX SUM IF` (IF lazy).
- Verify per stage in the **main loop** (never inside a workflow): `npm run check:formula`, `npm run lint`, `npm run build`, `/expenses` smoke. Shared-state manual E2E in a **throwaway sheet** only. Branch: `formula-field`. Spec: `docs/superpowers/specs/2026-07-19-formula-field-design.md`.
- **Locate code by CONTENT, not line number** — Grid.jsx/DataTable.jsx/etc. changed heavily during the linked-fields work.

---

# STAGE 1 — the engine (headless, pure)

### Task 1: `FormulaError` + `tokenize.mjs`

**Files:**
- Create: `src/modules/datatable/formula/tokenize.mjs`
- Test: `scripts/check-formula.mjs` (create)

**Interfaces:**
- Produces: `class FormulaError extends Error`; `tokenize(src) -> Token[]` where `Token = {t:"num",v} | {t:"str",v} | {t:"ref",id} | {t:"ident",v} | {t:"op",v} | {t:"lparen"} | {t:"rparen"} | {t:"comma"}`.

- [ ] **Step 1: Write the failing test** — create `scripts/check-formula.mjs`:

```js
// Pure-logic tests for the formula engine (tokenize/parse/evaluate/registry/refs)
// and the read-side evalFormula glue. No env needed.  npm run check:formula
import assert from "node:assert/strict";
import { tokenize, FormulaError } from "../src/modules/datatable/formula/tokenize.mjs";

let n = 0;
const ok = (msg) => console.log(`✅ ${msg}`) || n++;
const types = (src) => tokenize(src).map((t) => t.t);

assert.deepEqual(tokenize("1 + 2"), [{ t: "num", v: 1 }, { t: "op", v: "+" }, { t: "num", v: 2 }]);
assert.deepEqual(types("{col_a} * 2"), ["ref", "op", "num"]);
assert.equal(tokenize("{col_a}")[0].id, "col_a");
assert.deepEqual(tokenize('"hi"'), [{ t: "str", v: "hi" }]);
assert.deepEqual(types("ROUND(1.5, 0)"), ["ident", "lparen", "num", "comma", "num", "rparen"]);
assert.deepEqual(tokenize("a >= b").map((t) => t.v ?? t.t), ["a", ">=", "b"]);
assert.equal(tokenize("2.5")[0].v, 2.5);
assert.throws(() => tokenize("1 @ 2"), FormulaError); // illegal char
assert.throws(() => tokenize("{unterminated"), FormulaError);
ok("tokenize: numbers, strings, {ref}, idents, ops (incl. >=), errors");

console.log(`\n${n} checks passed.`);
process.exit(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-formula.mjs`
Expected: FAIL — cannot find `tokenize.mjs`.

- [ ] **Step 3: Implement `src/modules/datatable/formula/tokenize.mjs`:**

```js
// Pure lexer for the formula engine. String → tokens. No deps, no "use client".
// FormulaError is the one error type the whole engine throws; compile/run catch it.
export class FormulaError extends Error {
  constructor(message) {
    super(message);
    this.name = "FormulaError";
  }
}

const isDigit = (c) => c >= "0" && c <= "9";
const isIdentStart = (c) => /[A-Za-z_]/.test(c);
const isIdent = (c) => /[A-Za-z0-9_]/.test(c);

// Token shapes: {t:"num",v} {t:"str",v} {t:"ref",id} {t:"ident",v} {t:"op",v}
//               {t:"lparen"} {t:"rparen"} {t:"comma"}
export function tokenize(src) {
  const s = String(src ?? "");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (isDigit(c) || (c === "." && isDigit(s[i + 1]))) {
      let j = i + 1;
      while (j < s.length && (isDigit(s[j]) || s[j] === ".")) j++;
      const text = s.slice(i, j);
      const v = Number(text);
      if (!Number.isFinite(v)) throw new FormulaError(`invalid number "${text}"`);
      tokens.push({ t: "num", v });
      i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, str = "";
      while (j < s.length && s[j] !== c) { str += s[j]; j++; }
      if (j >= s.length) throw new FormulaError("unterminated string");
      tokens.push({ t: "str", v: str });
      i = j + 1; continue;
    }
    if (c === "{") {
      let j = i + 1, id = "";
      while (j < s.length && s[j] !== "}") { id += s[j]; j++; }
      if (j >= s.length) throw new FormulaError("unterminated { reference");
      tokens.push({ t: "ref", id: id.trim() });
      i = j + 1; continue;
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < s.length && isIdent(s[j])) j++;
      tokens.push({ t: "ident", v: s.slice(i, j) });
      i = j; continue;
    }
    if (c === "(") { tokens.push({ t: "lparen" }); i++; continue; }
    if (c === ")") { tokens.push({ t: "rparen" }); i++; continue; }
    if (c === ",") { tokens.push({ t: "comma" }); i++; continue; }
    const two = s.slice(i, i + 2);
    if (two === ">=" || two === "<=" || two === "!=") { tokens.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/%><=".includes(c)) { tokens.push({ t: "op", v: c }); i++; continue; }
    throw new FormulaError(`unexpected character "${c}"`);
  }
  return tokens;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-formula.mjs`
Expected: PASS — `1 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add src/modules/datatable/formula/tokenize.mjs scripts/check-formula.mjs
git commit -m "feat(formula): tokenizer + FormulaError"
```

---

### Task 2: `registry.mjs` (operators · functions · coercion)

**Files:**
- Create: `src/modules/datatable/formula/registry.mjs`
- Test: `scripts/check-formula.mjs` (extend)

**Interfaces:**
- Consumes: `FormulaError` (tokenize.mjs).
- Produces: `OPERATORS` (`{sym:{prec,fn}}`), `UNARY` (`{sym:fn}`), `FUNCTIONS` (`{NAME:{min,max,lazy?,fn}}`), and coercion helpers `num`, `truthy`, `eq`, `cmpNum`.

- [ ] **Step 1: Write the failing test** — append to `scripts/check-formula.mjs` (before the final `console.log`):

```js
import { OPERATORS, UNARY, FUNCTIONS, num, truthy, eq } from "../src/modules/datatable/formula/registry.mjs";

assert.equal(num(3), 3);
assert.equal(num(true), 1);
assert.equal(num(""), 0);        // empty → 0 in arithmetic
assert.equal(num(undefined), 0);
assert.throws(() => num("abc"), FormulaError);
assert.equal(OPERATORS["+"].fn(2, 3), 5);
assert.equal(OPERATORS["*"].fn(2, 3), 6);
assert.throws(() => OPERATORS["/"].fn(1, 0), FormulaError); // divide by zero
assert.equal(OPERATORS[">"].fn(3, 2), true);
assert.equal(OPERATORS["="].fn("Done", "Done"), true); // string equality (select names)
assert.equal(UNARY["-"](5), -5);
assert.equal(truthy(0), false);
assert.equal(truthy("x"), true);
assert.equal(eq(2, 2), true);
assert.equal(FUNCTIONS.ROUND.fn(1.555, 2), 1.56);
assert.equal(FUNCTIONS.MAX.fn(1, 9, 3), 9);
assert.equal(FUNCTIONS.SUM.fn(1, 2, 3), 6);
assert.equal(FUNCTIONS.IF.lazy, true);
assert.equal(FUNCTIONS.IF.fn(() => true, () => "a", () => "b"), "a"); // lazy thunks
ok("registry: coercion + operators + unary + functions (ROUND/MAX/SUM/IF-lazy)");
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/check-formula.mjs` → cannot find `registry.mjs`.

- [ ] **Step 3: Implement `src/modules/datatable/formula/registry.mjs`:**

```js
// The extension seam: operators + functions + typed coercion. Add a feature by
// adding ONE entry here — tokenize/parse/evaluate never change. Pure, no deps.
import { FormulaError } from "./tokenize.mjs";

// ---- typed coercion ----
export const num = (v) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "boolean" ? (v ? 1 : 0) : Number(v);
  if (!Number.isFinite(n)) throw new FormulaError("expected a number");
  return n;
};
export const truthy = (v) =>
  !(v === undefined || v === null || v === "" || v === false || v === 0 || (typeof v === "number" && Number.isNaN(v)));
const bothNumeric = (a, b) =>
  (typeof a === "number" || typeof a === "boolean") && (typeof b === "number" || typeof b === "boolean");
export const eq = (a, b) => (bothNumeric(a, b) ? num(a) === num(b) : String(a ?? "") === String(b ?? ""));
export const cmpNum = (a, b) => num(a) - num(b);

const divguard = (b) => { const d = num(b); if (d === 0) throw new FormulaError("divide by zero"); return d; };

// ---- operators: {prec, fn}. Higher prec binds tighter. ----
export const OPERATORS = {
  "+": { prec: 10, fn: (a, b) => num(a) + num(b) },
  "-": { prec: 10, fn: (a, b) => num(a) - num(b) },
  "*": { prec: 20, fn: (a, b) => num(a) * num(b) },
  "/": { prec: 20, fn: (a, b) => num(a) / divguard(b) },
  "%": { prec: 20, fn: (a, b) => num(a) % divguard(b) },
  "=": { prec: 5, fn: (a, b) => eq(a, b) },
  "!=": { prec: 5, fn: (a, b) => !eq(a, b) },
  ">": { prec: 5, fn: (a, b) => cmpNum(a, b) > 0 },
  "<": { prec: 5, fn: (a, b) => cmpNum(a, b) < 0 },
  ">=": { prec: 5, fn: (a, b) => cmpNum(a, b) >= 0 },
  "<=": { prec: 5, fn: (a, b) => cmpNum(a, b) <= 0 },
};

export const UNARY = { "-": (a) => -num(a) };

// ---- functions: {min, max, lazy?, fn}. lazy ⇒ args arrive as thunks. ----
export const FUNCTIONS = {
  ROUND: { min: 1, max: 2, fn: (n, d = 0) => { const p = 10 ** num(d); return Math.round(num(n) * p) / p; } },
  ABS: { min: 1, max: 1, fn: (n) => Math.abs(num(n)) },
  MIN: { min: 1, max: Infinity, fn: (...a) => Math.min(...a.map(num)) },
  MAX: { min: 1, max: Infinity, fn: (...a) => Math.max(...a.map(num)) },
  SUM: { min: 1, max: Infinity, fn: (...a) => a.reduce((s, x) => s + num(x), 0) },
  IF: { min: 3, max: 3, lazy: true, fn: (cond, a, b) => (truthy(cond()) ? a() : b()) },
};
```

- [ ] **Step 4: Run test to verify it passes** — `node scripts/check-formula.mjs` → `2 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add src/modules/datatable/formula/registry.mjs scripts/check-formula.mjs
git commit -m "feat(formula): registry — operators, functions, typed coercion"
```

---

### Task 3: `parse.mjs` (Pratt parser)

**Files:**
- Create: `src/modules/datatable/formula/parse.mjs`
- Test: `scripts/check-formula.mjs` (extend)

**Interfaces:**
- Consumes: `FormulaError`, `OPERATORS`, `UNARY`, `FUNCTIONS`.
- Produces: `parse(tokens) -> Ast` where `Ast = {k:"num",v} | {k:"str",v} | {k:"bool",v} | {k:"ref",id} | {k:"unary",op,arg} | {k:"binary",op,l,r} | {k:"call",name,args}`.

- [ ] **Step 1: Write the failing test** — append:

```js
import { parse } from "../src/modules/datatable/formula/parse.mjs";
import { tokenize as tk } from "../src/modules/datatable/formula/tokenize.mjs";
const ast = (src) => parse(tk(src));

assert.deepEqual(ast("2 + 3"), { k: "binary", op: "+", l: { k: "num", v: 2 }, r: { k: "num", v: 3 } });
// precedence: * binds tighter than +
assert.equal(ast("2 + 3 * 4").r.k, "binary"); // right side is (3*4)
assert.equal(ast("2 + 3 * 4").r.op, "*");
assert.equal(ast("(2 + 3) * 4").op, "*");     // parens override
assert.equal(ast("-5").k, "unary");
assert.equal(ast("true").k, "bool");
assert.deepEqual(ast("ROUND(1.5)"), { k: "call", name: "ROUND", args: [{ k: "num", v: 1.5 }] });
assert.equal(ast("if(1,2,3)").name, "IF");    // case-insensitive fn name → canonical upper
assert.throws(() => parse(tk("2 +")), FormulaError);        // dangling op
assert.throws(() => parse(tk("(2 + 3")), FormulaError);     // unmatched paren
assert.throws(() => parse(tk("NOPE(1)")), FormulaError);    // unknown function
assert.throws(() => parse(tk("ROUND(1,2,3)")), FormulaError); // arity
ok("parse: precedence, parens, unary, bool, calls (case-insensitive), errors");
```

- [ ] **Step 2: Run test to verify it fails** — cannot find `parse.mjs`.

- [ ] **Step 3: Implement `src/modules/datatable/formula/parse.mjs`:**

```js
// Pratt / precedence-climbing parser: tokens → AST. Binary precedence is read
// FROM the registry, so a new operator needs no parser edit. Pure, no deps.
import { FormulaError } from "./tokenize.mjs";
import { OPERATORS, UNARY, FUNCTIONS } from "./registry.mjs";

export function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (t) => {
    const tok = next();
    if (!tok || tok.t !== t) throw new FormulaError(`expected ${t === "rparen" ? ")" : t}`);
    return tok;
  };

  function parseExpr(minPrec) {
    let left = parseUnary();
    for (;;) {
      const tok = peek();
      if (!tok || tok.t !== "op") break;
      const op = OPERATORS[tok.v];
      if (!op || op.prec < minPrec) break;
      next();
      const right = parseExpr(op.prec + 1); // left-associative
      left = { k: "binary", op: tok.v, l: left, r: right };
    }
    return left;
  }

  function parseUnary() {
    const tok = peek();
    if (tok && tok.t === "op" && UNARY[tok.v]) {
      next();
      return { k: "unary", op: tok.v, arg: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = next();
    if (!tok) throw new FormulaError("unexpected end of formula");
    if (tok.t === "num") return { k: "num", v: tok.v };
    if (tok.t === "str") return { k: "str", v: tok.v };
    if (tok.t === "ref") return { k: "ref", id: tok.id };
    if (tok.t === "lparen") { const e = parseExpr(0); expect("rparen"); return e; }
    if (tok.t === "ident") {
      const low = tok.v.toLowerCase();
      if (low === "true") return { k: "bool", v: true };
      if (low === "false") return { k: "bool", v: false };
      const name = tok.v.toUpperCase();
      const fn = FUNCTIONS[name];
      if (!fn) throw new FormulaError(`unknown function "${tok.v}"`);
      expect("lparen");
      const args = [];
      if (peek() && peek().t !== "rparen") {
        args.push(parseExpr(0));
        while (peek() && peek().t === "comma") { next(); args.push(parseExpr(0)); }
      }
      expect("rparen");
      if (args.length < fn.min || args.length > fn.max) {
        const range = fn.max === Infinity ? `at least ${fn.min}` : fn.min === fn.max ? `${fn.min}` : `${fn.min}–${fn.max}`;
        throw new FormulaError(`${name} expects ${range} argument${fn.min === 1 && fn.max === 1 ? "" : "s"}`);
      }
      return { k: "call", name, args };
    }
    throw new FormulaError("unexpected token");
  }

  const out = parseExpr(0);
  if (pos < tokens.length) throw new FormulaError("unexpected trailing input");
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes** — `node scripts/check-formula.mjs` → `3 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add src/modules/datatable/formula/parse.mjs scripts/check-formula.mjs
git commit -m "feat(formula): Pratt parser (precedence from registry)"
```

---

### Task 4: `evaluate.mjs` + `index.mjs` (public API)

**Files:**
- Create: `src/modules/datatable/formula/evaluate.mjs`, `src/modules/datatable/formula/index.mjs`
- Test: `scripts/check-formula.mjs` (extend)

**Interfaces:**
- Produces: `evaluate(ast, scope) -> value` (`scope = { getRef(id) -> value }`); `compile(expr) -> {ast, error}`; `run(ast, scope) -> {value, error}`; re-export `FormulaError`.

- [ ] **Step 1: Write the failing test** — append:

```js
import { compile, run } from "../src/modules/datatable/formula/index.mjs";
// evaluate an expr against a ref scope (id → value)
const evalExpr = (expr, refs = {}) => {
  const { ast, error } = compile(expr);
  if (error) return { error };
  return run(ast, { getRef: (id) => refs[id] });
};

assert.equal(evalExpr("2 + 3 * 4").value, 14);
assert.equal(evalExpr("(2 + 3) * 4").value, 20);
assert.equal(evalExpr("{a} * {b}", { a: 6, b: 7 }).value, 42);
assert.equal(evalExpr("ROUND({a} / {b}, 2)", { a: 10, b: 3 }).value, 3.33);
assert.equal(evalExpr('IF({q} > 10, "bulk", "unit")', { q: 12 }).value, "bulk");
assert.equal(evalExpr('IF({q} > 10, "bulk", "unit")', { q: 3 }).value, "unit");
// lazy IF: untaken div-by-zero branch is NOT evaluated
assert.equal(evalExpr("IF({b} = 0, 0, {a} / {b})", { a: 5, b: 0 }).value, 0);
assert.equal(evalExpr("{a} / {b}", { a: 5, b: 0 }).error, "divide by zero");
assert.equal(evalExpr("SUM({a}, {b}, {c})", { a: 1, b: 2, c: 3 }).value, 6);
assert.equal(compile("2 +").error, "unexpected end of formula"); // compile catches parse errors
ok("evaluate/index: arithmetic, refs, ROUND, IF (incl. lazy), errors via compile/run");
```

- [ ] **Step 2: Run test to verify it fails** — cannot find `index.mjs`.

- [ ] **Step 3: Implement `evaluate.mjs`:**

```js
// AST walker. Dispatches operators/functions through the registry. Lazy functions
// receive arg thunks. Throws FormulaError (caught by run). Pure, no deps.
import { FormulaError } from "./tokenize.mjs";
import { OPERATORS, UNARY, FUNCTIONS } from "./registry.mjs";

export function evaluate(ast, scope) {
  switch (ast.k) {
    case "num":
    case "str":
    case "bool":
      return ast.v;
    case "ref":
      return scope.getRef(ast.id);
    case "unary":
      return UNARY[ast.op](evaluate(ast.arg, scope));
    case "binary":
      return OPERATORS[ast.op].fn(evaluate(ast.l, scope), evaluate(ast.r, scope));
    case "call": {
      const fn = FUNCTIONS[ast.name];
      if (fn.lazy) return fn.fn(...ast.args.map((a) => () => evaluate(a, scope)));
      return fn.fn(...ast.args.map((a) => evaluate(a, scope)));
    }
    default:
      throw new FormulaError("bad expression");
  }
}
```

- [ ] **Step 4: Implement `index.mjs`:**

```js
// Public API for the formula engine — the only entry point consumers import.
// compile() and run() catch FormulaError so nothing above ever throws.
import { FormulaError, tokenize } from "./tokenize.mjs";
import { parse } from "./parse.mjs";
import { evaluate } from "./evaluate.mjs";

export { FormulaError };

// Parse once (memoizable per column) → {ast, error}.
export function compile(expr) {
  try {
    return { ast: parse(tokenize(expr)), error: null };
  } catch (e) {
    if (e instanceof FormulaError) return { ast: null, error: e.message };
    throw e;
  }
}

// Evaluate a compiled ast against a scope → {value, error}.
export function run(ast, scope) {
  try {
    return { value: evaluate(ast, scope), error: null };
  } catch (e) {
    if (e instanceof FormulaError) return { value: undefined, error: e.message };
    throw e;
  }
}
```

- [ ] **Step 5: Run test to verify it passes** — `node scripts/check-formula.mjs` → `4 checks passed.`

- [ ] **Step 6: Commit**

```bash
git add src/modules/datatable/formula/evaluate.mjs src/modules/datatable/formula/index.mjs scripts/check-formula.mjs
git commit -m "feat(formula): evaluator + public compile/run API"
```

---

### Task 5: `refs.mjs` + `formulaModel.mjs` (name↔id, typed refs, cycle detection)

**Files:**
- Create: `src/modules/datatable/formula/refs.mjs`, `src/modules/datatable/formulaModel.mjs`
- Test: `scripts/check-formula.mjs` (extend)

**Interfaces:**
- Produces (`refs.mjs`): `namesToIds(expr, columns) -> string`, `idsToNames(expr, columns) -> string`, `refColumnIds(expr) -> string[]`.
- Produces (`formulaModel.mjs`): `evalFormula(column, row, columns, ctx?, visiting?) -> {value, error}`.

- [ ] **Step 1: Write the failing test** — append:

```js
import { namesToIds, idsToNames, refColumnIds } from "../src/modules/datatable/formula/refs.mjs";
import { evalFormula } from "../src/modules/datatable/formulaModel.mjs";

const cols = [
  { id: "c1", name: "Price", type: "number" },
  { id: "c2", name: "Qty", type: "number" },
  { id: "c3", name: "Status", type: "select", options: [{ id: "o1", name: "Done" }] },
  { id: "c4", name: "Total", type: "formula", formula: { expr: "{c1} * {c2}" } },
  { id: "c5", name: "Loop", type: "formula", formula: { expr: "{c5} + 1" } },
];
// refs
assert.equal(namesToIds("{Price} * {Qty}", cols), "{c1} * {c2}");
assert.equal(idsToNames("{c1} * {c2}", cols), "{Price} * {Qty}");
assert.equal(namesToIds("{Missing} + 1", cols), "{Missing} + 1"); // unmatched left literal
assert.deepEqual(refColumnIds("{c1} + {c2}"), ["c1", "c2"]);

const row = { id: "r1", tabId: "t", values: { c1: 10, c2: 3, c3: "o1" } };
const F = (expr) => ({ id: "cF", name: "F", type: "formula", formula: { expr } });
assert.equal(evalFormula(F("{c1} * {c2}"), row, cols).value, 30);
assert.equal(evalFormula(F('IF({c3} = "Done", 1, 0)'), row, cols).value, 1); // select → option name
assert.equal(evalFormula(F("{c4} + 5"), row, cols).value, 35);       // formula→formula ref
assert.equal(evalFormula(F("{nope}"), row, cols).error, "unknown field");
assert.equal(evalFormula(cols[4], row, cols).error, "circular reference"); // {c5}+1 self-ref
ok("refs + evalFormula: name↔id, typed refs, select-name, nested formula, cycle detection");
```

- [ ] **Step 2: Run test to verify it fails** — cannot find `refs.mjs`.

- [ ] **Step 3: Implement `src/modules/datatable/formula/refs.mjs`:**

```js
// Editor/eval boundary helpers: translate {Name}↔{id} in an expression, and list
// the column ids an expression references. Pure string transforms. No deps.
const RE = /\{([^}]*)\}/g;

export function namesToIds(expr, columns) {
  const byName = new Map(columns.map((c) => [c.name, c.id]));
  return String(expr ?? "").replace(RE, (m, inner) => {
    const id = byName.get(inner.trim());
    return id ? `{${id}}` : m; // unmatched name left literal (surfaces as an eval error)
  });
}

export function idsToNames(expr, columns) {
  const byId = new Map(columns.map((c) => [c.id, c.name]));
  return String(expr ?? "").replace(RE, (m, inner) => {
    const name = byId.get(inner.trim());
    return name ? `{${name}}` : m;
  });
}

export function refColumnIds(expr) {
  const ids = [];
  String(expr ?? "").replace(RE, (m, inner) => { ids.push(inner.trim()); return m; });
  return ids;
}
```

- [ ] **Step 4: Implement `src/modules/datatable/formulaModel.mjs`:**

```js
// Read-side glue between the pure engine and the table's rows/columns. Builds the
// ref scope (typed values), recurses through formula refs with a cycle guard, and
// returns {value, error}. Pure (no react); imports the engine + linkDerive only.
import { compile, run, FormulaError } from "./formula/index.mjs";
import { rollupValue } from "./linkDerive.mjs";

const cache = new Map(); // expr string → {ast, error}
const compiled = (expr) => {
  const key = expr ?? "";
  if (!cache.has(key)) cache.set(key, compile(key));
  return cache.get(key);
};

// A non-formula, non-rollup column's cell value → a typed formula value.
function refValue(col, raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  switch (col.type) {
    case "number": return typeof raw === "number" ? raw : Number(raw);
    case "checkbox": return raw === true;
    case "select": {
      const opt = (col.options ?? []).find((o) => o.id === raw);
      return opt ? opt.name : undefined;
    }
    case "text":
    case "date": return String(raw);
    default: return undefined;
  }
}

export function evalFormula(column, row, columns, ctx = null, visiting = new Set()) {
  const c = compiled(column.formula?.expr ?? "");
  if (c.error) return { value: undefined, error: c.error };
  const byId = new Map(columns.map((cc) => [cc.id, cc]));
  const throwFE = (m) => { throw new FormulaError(m); };
  const scope = {
    getRef: (id) => {
      const ref = byId.get(id);
      if (!ref) throwFE("unknown field");
      if (ref.type === "formula") {
        if (id === column.id || visiting.has(id)) throwFE("circular reference");
        const r = evalFormula(ref, row, columns, ctx, new Set([...visiting, column.id]));
        if (r.error) throwFE(r.error);
        return r.value;
      }
      if (ref.type === "rollup") {
        const v = ctx ? rollupValue(row, ref, ctx) : null;
        return v === null ? undefined : v;
      }
      if (ref.type === "link" || ref.type === "lookup" || ref.type === "multiSelect") throwFE("unsupported field type");
      return refValue(ref, row.values[id]);
    },
  };
  return run(c.ast, scope);
}
```

- [ ] **Step 5: Run test to verify it passes** — `node scripts/check-formula.mjs` → `5 checks passed.`

- [ ] **Step 6: Commit**

```bash
git add src/modules/datatable/formula/refs.mjs src/modules/datatable/formulaModel.mjs scripts/check-formula.mjs
git commit -m "feat(formula): refs translation + evalFormula (typed refs, cycles)"
```

---

# STAGE 2 — schema + UI end-to-end

### Task 6: `ColumnSchema` "formula" arm + `coerceCell` + `check:formula` script

**Files:**
- Modify: `src/config/schemas.js` (`ColumnSchema`)
- Modify: `src/modules/datatable/model.mjs` (`coerceCell`)
- Modify: `package.json` (add `check:formula`)

**Interfaces:**
- Produces: `type` enum includes `"formula"`; optional `formula: { expr }`; `coerceCell` returns `undefined` for formula.

- [ ] **Step 1: Extend `ColumnSchema`** in `src/config/schemas.js` — add `"formula"` to the `type` enum and, after the `rollup` object, add:

```js
  formula: z.object({ expr: z.string().default("") }).optional(),
```
And in the `type` enum add `"formula"`:
```js
  type: z
    .enum(["text", "number", "date", "select", "multiSelect", "checkbox", "link", "lookup", "rollup", "formula"])
    .default("text"),
```

- [ ] **Step 2: Extend `coerceCell`** in `src/modules/datatable/model.mjs` — add `"formula"` to the derived arm that returns `undefined` (alongside `lookup`/`rollup`):

```js
    case "lookup":
    case "rollup":
    case "formula":
      return undefined; // derived — never stored in a cell
```

- [ ] **Step 3: Add the npm script** — in `package.json` after `"check:links"`:

```json
    "check:links": "node scripts/check-links.mjs",
    "check:formula": "node scripts/check-formula.mjs"
```

- [ ] **Step 4: Verify** — run `npm run check:formula` (→ `5 checks passed.`) then `npm run build` (green — validates the extended schema), then `rm -rf .next`.

- [ ] **Step 5: Commit**

```bash
git add src/config/schemas.js src/modules/datatable/model.mjs package.json
git commit -m "feat(formula): ColumnSchema formula arm + coerceCell + check:formula script"
```

---

### Task 7: `FormulaCell.jsx` + `Cell` dispatch + Grid ghost arm

**Files:**
- Create: `src/modules/datatable/cells/FormulaCell.jsx`
- Modify: `src/modules/datatable/cells/Cell.jsx`, `src/modules/datatable/Grid.jsx`

**Interfaces:**
- Consumes: `evalFormula` (formulaModel.mjs), `numberFmt` (model.mjs), `formatNumber` (format.js).
- Produces: `FormulaCell({ column, row, columns, ctx })`.

- [ ] **Step 1: Create `cells/FormulaCell.jsx`:**

```jsx
"use client";
import { evalFormula } from "../formulaModel.mjs";
import { numberFmt } from "../model.mjs";
import { formatNumber } from "../format";

// Read-only formula cell: evaluates the expression against the row and renders the
// typed result. Errors show a #ERR chip (message on hover); nothing throws.
export default function FormulaCell({ column, row, columns, ctx }) {
  const { value, error } = evalFormula(column, row, columns ?? [], ctx ?? null);
  if (error) {
    return (
      <span
        title={error}
        className="mx-2 my-auto font-mono text-[.7rem] px-1.5 py-[1px] rounded border border-clay/50 text-clay bg-clay/5"
      >
        #ERR
      </span>
    );
  }
  if (value === undefined || value === null || value === "") {
    return <span className="px-2 text-brown-soft/45 text-[.82rem]">—</span>;
  }
  if (typeof value === "number") {
    return <span className="w-full block text-right px-2 font-mono text-[.82rem] text-forest">{formatNumber(value, numberFmt(column))}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="w-full block text-center px-2 font-mono text-[.82rem] text-forest">{value ? "✓" : "·"}</span>;
  }
  return <span className="px-2 font-mono text-[.8rem] text-forest truncate">{String(value)}</span>;
}
```

- [ ] **Step 2: Dispatch in `Cell.jsx`** — add `import FormulaCell from "./FormulaCell";` and, needing the full `columns`, pass them. The dispatcher currently receives `{ column, value, row, ctx, link, onCommit, onCreateOption }`. Formula needs the full columns list — thread `columns` from `link.columns` (already the full active-tab columns). Add to the dispatcher a `case`:

```jsx
    case "formula":
      return <FormulaCell column={column} row={row} columns={link?.columns ?? []} ctx={ctx} />;
```

- [ ] **Step 3: Grid `ColumnGhost` arm** — in `Grid.jsx` `ColumnGhost`, add a `columns` param (FormulaCell needs the FULL columns to resolve refs — unlike lookup/rollup which only need `ctx`). Thread it: where `<ColumnGhost … ctx={ctx} />` is rendered (inside the `DragOverlay`), also pass `columns={link?.columns ?? []}`. Then in `ColumnGhost`'s per-row render, for `column.type === "formula"` render `<FormulaCell column={column} row={r} columns={columns} ctx={ctx} />` (mirroring the lookup/rollup ghost arms). Import `FormulaCell` into Grid.

- [ ] **Step 4: Verify** — `npm run build` green + `/expenses` smoke 200 (background `next start -p 3199`, poll, assert 200 + `expense planner`, kill, `rm -rf .next`). (You can't create a formula column yet — that's Task 8 — so this just confirms the dispatch compiles.)

- [ ] **Step 5: Commit**

```bash
git add src/modules/datatable/cells/FormulaCell.jsx src/modules/datatable/cells/Cell.jsx src/modules/datatable/Grid.jsx
git commit -m "feat(formula): FormulaCell + dispatch + ghost arm"
```

---

### Task 8: `FormulaConfig.jsx` + AddColumnPopover step + create/undo

**Files:**
- Create: `src/modules/datatable/FormulaConfig.jsx`
- Modify: `src/modules/datatable/AddColumnPopover.jsx`, `src/modules/datatable/DataTable.jsx`, `src/modules/datatable/Grid.jsx`

**Interfaces:**
- Consumes: `namesToIds`/`idsToNames` (refs.mjs), `compile` (formula/index.mjs), the full `columns`.
- Produces: `FormulaConfig({ columns, draft, setDraft })` (draft holds `expr` in **name form** for editing); DataTable `addFormulaColumn(name, exprIdForm)`.

- [ ] **Step 1: Create `FormulaConfig.jsx`:**

```jsx
"use client";
import { compile } from "./formula/index.mjs";
import { namesToIds } from "./formula/refs.mjs";

// Reused for create + edit. `draft.expr` is the NAME-form expression being edited;
// the caller converts to id-form on save. Shows a click-to-insert column list and
// live parse validation (a broken formula is still savable — the cell shows #ERR).
export default function FormulaConfig({ columns, draft, setDraft }) {
  const expr = draft.expr ?? "";
  const insertable = columns.filter(
    (c) => c.type !== "link" && c.type !== "lookup" && c.type !== "multiSelect" && c.type !== "formula",
  );
  const { error } = compile(namesToIds(expr, columns));
  const insert = (name) => setDraft({ ...draft, expr: `${expr}${expr && !expr.endsWith(" ") ? " " : ""}{${name}}` });

  return (
    <div className="mt-1">
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Formula</div>
      <textarea
        autoFocus
        value={expr}
        onChange={(e) => setDraft({ ...draft, expr: e.target.value })}
        rows={2}
        placeholder="{Price} * {Qty}"
        spellCheck={false}
        className="field-box w-full py-[6px] px-[10px] text-[.72rem] font-mono resize-y"
      />
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mt-2 mb-1">Insert field</div>
      <div className="flex flex-wrap gap-1">
        {insertable.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => insert(c.name)}
            className="font-mono text-[.62rem] px-2 py-[3px] rounded-[6px] border border-olive text-forest hover:bg-cream-light"
          >
            {c.name || "Field"}
          </button>
        ))}
      </div>
      {error && <div className="mt-2 font-mono text-[.6rem] text-clay">⚠ {error} — you can still save; the cell shows #ERR.</div>}
    </div>
  );
}
```

- [ ] **Step 2: AddColumnPopover** — add `{ type: "formula", label: "Formula", icon: "ƒ" }` to `TYPES`; picking it sets `step = "formula"`; render `<FormulaConfig columns={columns} draft={draft} setDraft={setDraft} />`; the confirm button "Create formula" (always enabled — even an empty/broken expr saves) calls `onCreateFormula(name, namesToIds(draft.expr ?? "", columns))` then `onClose()`. Import `namesToIds` from `./formula/refs.mjs`. Add `onCreateFormula` prop.

- [ ] **Step 3: Grid** — pass `onCreateFormula={onCreateFormula}` into `<AddColumnPopover>` (and add `onCreateFormula` to Grid's props). `columns` for the popover is already the full-columns bundle used by the lookup/rollup config.

- [ ] **Step 4: DataTable `addFormulaColumn`:**

```js
  const addFormulaColumn = (name, expr) => {
    const col = { id: uid(), name, type: "formula", width: 160, formula: { expr } };
    const tabId = activeId;
    applyAddColumn(tabId, col);
    record({ label: "add formula field", undo: () => applyDeleteColumn(tabId, col.id), redo: () => applyAddColumn(tabId, col) });
  };
```
Pass `onCreateFormula={addFormulaColumn}` to `<Grid>`.

- [ ] **Step 5: Verify** — `npm run build` + `/expenses` smoke, `rm -rf .next`. Manual (throwaway sheet, own dev server): add a Formula column `{Price} * {Qty}`, confirm it computes; a bad expr shows `#ERR`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/datatable/FormulaConfig.jsx src/modules/datatable/AddColumnPopover.jsx src/modules/datatable/DataTable.jsx src/modules/datatable/Grid.jsx
git commit -m "feat(formula): create formula columns (config + undo)"
```

---

### Task 9: ColumnMenu edit + `FormulaEditPopover` + Filter/Sort exclusion

**Files:**
- Modify: `src/modules/datatable/ColumnMenu.jsx`, `src/modules/datatable/Grid.jsx`, `src/modules/datatable/DataTable.jsx`, `src/modules/datatable/FilterEditor.jsx`, `src/modules/datatable/SortEditor.jsx`

**Interfaces:**
- Produces: `onEditFormula(colId, {expr})` (DataTable, id-form expr, `updateColumn` + undo); a `FormulaEditPopover` in Grid (mirrors `RollupEditPopover`, seeded via `idsToNames`); `"formula"` added to the Filter/Sort exclusion predicate.

- [ ] **Step 1: ColumnMenu** — for `column.type === "formula"`, add a "ƒ Edit formula" item calling a new `onEditFormula` prop (mirror the edit-rollup item). Formula columns also get the existing number-format controls (results are often numeric) — set `isNumber`-style rendering to include `type === "formula"` for the format block, OR just add the format block for formula too.

- [ ] **Step 2: Grid `FormulaEditPopover`** (mirror `RollupEditPopover`):

```jsx
function FormulaEditPopover({ column, columns, rect, onClose, onSave }) {
  const [draft, setDraft] = useState({ expr: idsToNames(column.formula?.expr ?? "", columns) });
  const nextId = namesToIds(draft.expr ?? "", columns);
  const dirty = nextId !== (column.formula?.expr ?? "");
  return (
    <AnchoredPopover rect={rect} onClose={onClose} width={260}>
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1.5">
        Edit formula · {column.name || "field"}
      </div>
      <FormulaConfig columns={columns} draft={draft} setDraft={setDraft} />
      <div className="flex gap-1 mt-2">
        <button type="button" onClick={onClose} className="flex-1 chip">Cancel</button>
        <button type="button" onClick={() => { if (dirty) onSave({ expr: nextId }); onClose(); }} className="flex-1 chip chip--active">Save</button>
      </div>
    </AnchoredPopover>
  );
}
```
Import `FormulaConfig`, `idsToNames`/`namesToIds` (from `./formula/refs.mjs`) into Grid. **Wiring mirrors `RollupEditPopover` exactly** (already in Grid.jsx from the linked-fields work): a `formulaEdit` popover-state in Grid, opened by the ColumnMenu's "Edit formula" item (the `onEditFormula` menu prop sets that state, like edit-rollup opens `RollupEditPopover`), and this popover's `onSave({expr})` calls the **DataTable** commit handler `onEditFormula(colId, {expr})` (Step 3). Pass the full `columns` (`link.columns`) to the popover.

- [ ] **Step 3: DataTable `onEditFormula`:**

```js
  const onEditFormula = (colId, formula) => {
    const tabId = activeId;
    const old = columns.find((c) => c.id === colId)?.formula;
    applyUpdateColumn(tabId, colId, { formula });
    record({
      label: "edit formula",
      undo: () => applyUpdateColumn(tabId, colId, { formula: old }),
      redo: () => applyUpdateColumn(tabId, colId, { formula }),
    });
  };
```
Wire `onEditFormula` down to Grid/ColumnMenu.

- [ ] **Step 4: Filter/Sort exclusion** — in `FilterEditor.jsx` and `SortEditor.jsx`, add `"formula"` to the derived-type exclusion predicate (the one already excluding link/lookup/rollup).

- [ ] **Step 5: Verify** — `npm run check:formula` (5) + `npm run check:views` + `npm run check:expenses` + `npm run lint` + `npm run build` + `/expenses` smoke, `rm -rf .next`. Manual (throwaway sheet): edit a formula's expression; rename a referenced column and confirm the formula still resolves (id-based); confirm formula columns don't appear in the Filter/Sort field pickers.

- [ ] **Step 6: Commit**

```bash
git add src/modules/datatable/ColumnMenu.jsx src/modules/datatable/Grid.jsx src/modules/datatable/DataTable.jsx src/modules/datatable/FilterEditor.jsx src/modules/datatable/SortEditor.jsx
git commit -m "feat(formula): edit formula + rename-proof refs + filter/sort exclusion"
```

---

## Final verification (after Task 9)
- `npm run check:formula` (5) · `npm run check:links` (12) · `npm run check:views` (21) · `npm run check:expenses` (21) — all pass (no regressions).
- `npm run lint` clean · `npm run build` green · `rm -rf .next`.
- `/expenses` smoke 200 with a formula column present.
- Manual E2E (throwaway sheet): `{Price}*{Qty}`, `ROUND({A}/{B},2)`, `IF({Qty}>10,"bulk","unit")`, `#ERR` on a bad expr, formula→formula (works) and self-reference (`#ERR: circular reference`), rename a referenced column (formula survives). Delete the throwaway sheet after.
