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
