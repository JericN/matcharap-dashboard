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
