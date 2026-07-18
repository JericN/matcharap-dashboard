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
