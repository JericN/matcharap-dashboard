// Per-column-type filter operators — the CONTRACT the FilterEditor renders from.
// The op STRINGS must match viewModel.mjs's matchOne switch verbatim (that pure
// engine is shared by the server DAL, the client optimistic layer, and
// scripts/check-views.mjs — an op the editor emits that the engine can't read
// would silently hide/keep the wrong rows).
//
// Shape: OPS_BY_TYPE[type] = [{ op, label, value }], where `value` is the INPUT
// KIND the FilterEditor uses to render (and store) the operand:
//   "text" | "number" | "date" | "selectOne" | "selectMany" | "none"
// Red-team footgun (caught once): select `is`/`isNot` take a SINGLE optionId
// ("selectOne" → value is a string), while select `isAnyOf` and every multiSelect
// op take an optionId[] ("selectMany" → value is an array). Keep them distinct.

export const OPS_BY_TYPE = {
  text: [
    { op: "is", label: "is", value: "text" },
    { op: "isNot", label: "is not", value: "text" },
    { op: "contains", label: "contains", value: "text" },
    { op: "notContains", label: "does not contain", value: "text" },
    { op: "isEmpty", label: "is empty", value: "none" },
    { op: "isNotEmpty", label: "is not empty", value: "none" },
  ],
  number: [
    { op: "eq", label: "=", value: "number" },
    { op: "neq", label: "≠", value: "number" },
    { op: "gt", label: ">", value: "number" },
    { op: "gte", label: "≥", value: "number" },
    { op: "lt", label: "<", value: "number" },
    { op: "lte", label: "≤", value: "number" },
    { op: "isEmpty", label: "is empty", value: "none" },
    { op: "isNotEmpty", label: "is not empty", value: "none" },
  ],
  date: [
    { op: "is", label: "is", value: "date" },
    { op: "before", label: "is before", value: "date" },
    { op: "after", label: "is after", value: "date" },
    { op: "isEmpty", label: "is empty", value: "none" },
    { op: "isNotEmpty", label: "is not empty", value: "none" },
  ],
  select: [
    { op: "is", label: "is", value: "selectOne" },
    { op: "isNot", label: "is not", value: "selectOne" },
    { op: "isAnyOf", label: "is any of", value: "selectMany" },
    { op: "isEmpty", label: "is empty", value: "none" },
    { op: "isNotEmpty", label: "is not empty", value: "none" },
  ],
  multiSelect: [
    { op: "hasAnyOf", label: "has any of", value: "selectMany" },
    { op: "hasAllOf", label: "has all of", value: "selectMany" },
    { op: "hasNoneOf", label: "has none of", value: "selectMany" },
    { op: "isEmpty", label: "is empty", value: "none" },
    { op: "isNotEmpty", label: "is not empty", value: "none" },
  ],
  checkbox: [
    { op: "isChecked", label: "is checked", value: "none" },
    { op: "isUnchecked", label: "is unchecked", value: "none" },
  ],
};

// Flat list of every operator spec, for context-free lookups (labelForOp).
const ALL_OPS = Object.values(OPS_BY_TYPE).flat();

// Human label for an op string (falls back to the raw op if unknown).
export function labelForOp(op) {
  const hit = ALL_OPS.find((o) => o.op === op);
  return hit ? hit.label : op;
}

// The value-input KIND for a (columnType, op) pair — "none" for a valueless op
// or an unknown pairing. The FilterEditor uses this to pick the operand widget
// and to know when switching the op must clear the stored value.
export function valueKind(type, op) {
  const hit = (OPS_BY_TYPE[type] ?? []).find((o) => o.op === op);
  return hit ? hit.value : "none";
}

// Default op when a column (of this type) is first picked or its type changes:
// the first operator in the list.
export function defaultOpFor(type) {
  const list = OPS_BY_TYPE[type] ?? [];
  return list.length ? list[0].op : "is";
}
