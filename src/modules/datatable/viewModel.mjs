// Pure view engine for the DataTable module — filter + sort + column visibility
// over a table's rows. Dependency-free (only imports sibling pure helpers), so it
// is Node-testable and shared VERBATIM by the client optimistic layer, the server
// DAL, and scripts/check-views.mjs — server-derived and client-optimistic rows must
// never diverge. Convention: empty cell ≡ ABSENT key (via isEmptyValue).

import { isEmptyValue } from "./model.mjs";

// Ops that need no `value`. Everything else is "value-carrying": an incomplete
// (empty-value) value-carrying filter is IGNORED (matches all rows), Airtable-style.
const VALUELESS = new Set(["isEmpty", "isNotEmpty", "isChecked", "isUnchecked"]);

// Columns a view actually shows (order preserved; hidden ones removed).
export function visibleColumns(columns, view) {
  const hidden = new Set(view?.hiddenColumnIds ?? []);
  return columns.filter((c) => !hidden.has(c.id));
}

// Does one filter condition hold for a cell? Empty ≡ absent throughout.
function matchOne(col, cell, f) {
  if (!VALUELESS.has(f.op) && isEmptyValue(f.value)) return true; // incomplete filter → ignore
  const empty = isEmptyValue(cell);
  switch (f.op) {
    case "isEmpty":
      return empty;
    case "isNotEmpty":
      return !empty;
    case "isChecked":
      return cell === true;
    case "isUnchecked":
      return cell !== true; // unchecked ≡ absent (checkbox stores true-only)

    // text (+ select `is`/`isNot` on a single optionId)
    case "is":
      if (col.type === "select") return !empty && cell === f.value;
      return !empty && String(cell).toLowerCase() === String(f.value).toLowerCase();
    case "isNot":
      if (col.type === "select") return cell !== f.value; // empty included
      return empty ? true : String(cell).toLowerCase() !== String(f.value).toLowerCase();
    case "contains":
      return !empty && String(cell).toLowerCase().includes(String(f.value).toLowerCase());
    case "notContains":
      return empty ? true : !String(cell).toLowerCase().includes(String(f.value).toLowerCase());

    // number (thresholds are POSITIVE — empty never matches)
    case "eq":
      return !empty && Number(cell) === Number(f.value);
    case "neq":
      return empty ? true : Number(cell) !== Number(f.value);
    case "gt":
      return !empty && Number(cell) > Number(f.value);
    case "gte":
      return !empty && Number(cell) >= Number(f.value);
    case "lt":
      return !empty && Number(cell) < Number(f.value);
    case "lte":
      return !empty && Number(cell) <= Number(f.value);

    // date — native input guarantees zero-padded ISO ⇒ lexical compare is chronological
    case "before":
      return !empty && String(cell) < String(f.value);
    case "after":
      return !empty && String(cell) > String(f.value);

    // select multi-pick
    case "isAnyOf": {
      const arr = Array.isArray(f.value) ? f.value : [f.value];
      return !empty && arr.includes(cell);
    }

    // multiSelect
    case "hasAnyOf": {
      if (empty) return false;
      const set = new Set(Array.isArray(cell) ? cell : []);
      return (f.value ?? []).some((x) => set.has(x));
    }
    case "hasAllOf": {
      if (empty) return false;
      const set = new Set(Array.isArray(cell) ? cell : []);
      return (f.value ?? []).every((x) => set.has(x));
    }
    case "hasNoneOf": {
      const set = new Set(Array.isArray(cell) ? cell : []);
      return (f.value ?? []).every((x) => !set.has(x)); // empty cell → true
    }

    default:
      return true; // unknown op → don't hide rows
  }
}

// AND across all conditions. A condition on a dangling column id is skipped
// (a teammate's concurrent column delete must not crash the view before reload).
export function matchesFilters(row, columns, filters) {
  const byId = new Map(columns.map((c) => [c.id, c]));
  for (const f of filters ?? []) {
    const col = byId.get(f.columnId);
    if (!col) continue; // dangling → skip defensively
    if (!matchOne(col, row.values[f.columnId], f)) return false;
  }
  return true;
}

// Compare a single non-checkbox column's values by type (ascending, pre-flip).
function typeCompare(col, av, bv) {
  switch (col.type) {
    case "number":
      return Number(av) - Number(bv);
    case "select": {
      const opts = col.options ?? [];
      const ai = opts.findIndex((o) => o.id === av);
      const bi = opts.findIndex((o) => o.id === bv);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi); // dangling sinks
    }
    case "date":
    case "text":
    default:
      return String(av).localeCompare(String(bv));
  }
}

// One sort key. Empties sink to the bottom in BOTH directions (bucket resolved
// OUTSIDE the dir flip). Checkbox is EXEMPT — unchecked is a real `false` bucket
// that swaps with dir (else asc==desc).
function compareCells(col, av, bv, dir) {
  const mul = dir === "desc" ? -1 : 1;
  if (col.type === "checkbox") {
    return ((av === true ? 1 : 0) - (bv === true ? 1 : 0)) * mul;
  }
  const ae = isEmptyValue(av);
  const be = isEmptyValue(bv);
  if (ae && be) return 0;
  if (ae) return 1; // empties last, regardless of dir
  if (be) return -1;
  return typeCompare(col, av, bv) * mul;
}

// Filter THEN multi-key stable sort. Returns a new array; never mutates `rows`.
export function applyView(rows, columns, view) {
  const filtered = (rows ?? []).filter((r) => matchesFilters(r, columns, view?.filters ?? []));
  const sorts = view?.sorts ?? [];
  if (!sorts.length) return filtered;
  const byId = new Map(columns.map((c) => [c.id, c]));
  const active = sorts.map((s) => ({ col: byId.get(s.columnId), dir: s.dir })).filter((s) => s.col);
  if (!active.length) return filtered;
  return filtered
    .map((row, i) => [row, i])
    .sort((a, b) => {
      for (const s of active) {
        const c = compareCells(s.col, a[0].values[s.col.id], b[0].values[s.col.id], s.dir);
        if (c !== 0) return c;
      }
      return a[1] - b[1]; // stable tiebreak
    })
    .map((x) => x[0]);
}

// For "＋ add row" under a filter: pre-fill values from the EQUALITY-seedable
// conditions so the new row lands visibly. Returns a raw {colId: value} map (the
// caller runs it through coerceCell/writeCell). Non-equality ops can't seed.
export function seedValuesFromView(columns, view) {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const out = {};
  for (const f of view?.filters ?? []) {
    const col = byId.get(f.columnId);
    if (!col) continue;
    if (col.type === "checkbox" && f.op === "isChecked") out[f.columnId] = true;
    else if (isEmptyValue(f.value)) continue;
    else if (col.type === "text" && f.op === "is") out[f.columnId] = f.value;
    else if (col.type === "number" && f.op === "eq") out[f.columnId] = f.value;
    else if (col.type === "date" && f.op === "is") out[f.columnId] = f.value;
    else if (col.type === "select" && f.op === "is") out[f.columnId] = f.value;
  }
  return out;
}
