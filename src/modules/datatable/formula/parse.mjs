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
