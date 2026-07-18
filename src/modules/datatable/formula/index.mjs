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
