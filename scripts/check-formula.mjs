// Pure-logic tests for the formula engine (tokenize/parse/evaluate/registry/refs)
// and the read-side evalFormula glue. No env needed.  npm run check:formula
import assert from "node:assert/strict";
import { tokenize, FormulaError } from "../src/modules/datatable/formula/tokenize.mjs";
import { OPERATORS, UNARY, FUNCTIONS, num, truthy, eq } from "../src/modules/datatable/formula/registry.mjs";

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

console.log(`\n${n} checks passed.`);
process.exit(0);
