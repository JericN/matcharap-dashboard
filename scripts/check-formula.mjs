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

import { parse } from "../src/modules/datatable/formula/parse.mjs";
const ast = (src) => parse(tokenize(src));

assert.deepEqual(ast("2 + 3"), { k: "binary", op: "+", l: { k: "num", v: 2 }, r: { k: "num", v: 3 } });
// precedence: * binds tighter than +
assert.equal(ast("2 + 3 * 4").r.k, "binary"); // right side is (3*4)
assert.equal(ast("2 + 3 * 4").r.op, "*");
assert.equal(ast("(2 + 3) * 4").op, "*");     // parens override
assert.equal(ast("-5").k, "unary");
assert.equal(ast("true").k, "bool");
assert.deepEqual(ast("ROUND(1.5)"), { k: "call", name: "ROUND", args: [{ k: "num", v: 1.5 }] });
assert.equal(ast("if(1,2,3)").name, "IF");    // case-insensitive fn name → canonical upper
assert.throws(() => parse(tokenize("2 +")), FormulaError);        // dangling op
assert.throws(() => parse(tokenize("(2 + 3")), FormulaError);     // unmatched paren
assert.throws(() => parse(tokenize("NOPE(1)")), FormulaError);    // unknown function
assert.throws(() => parse(tokenize("ROUND(1,2,3)")), FormulaError); // arity
ok("parse: precedence, parens, unary, bool, calls (case-insensitive), errors");

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

console.log(`\n${n} checks passed.`);
process.exit(0);
