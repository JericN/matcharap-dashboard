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
