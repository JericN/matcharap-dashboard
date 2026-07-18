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
