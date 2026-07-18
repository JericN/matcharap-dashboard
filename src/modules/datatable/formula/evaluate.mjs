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
