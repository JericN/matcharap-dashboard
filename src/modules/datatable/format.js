// Display formatting for number expense cells (pure). The raw numeric value is
// stored; ₱ / grouping / fixed decimals are render-only (math stays on the raw).

// Format a numeric cell value per its column's number format:
//   currency → "₱" + thousands + fixed decimals; plain → thousands + decimals.
// Empty / non-finite → "".
export function formatNumber(value, fmt) {
  if (value === "" || value === null || value === undefined) return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  const { style = "plain", precision = 0 } = fmt ?? {};
  const s = n.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return style === "currency" ? "₱" + s : s;
}

// Parse an input string to a number. "" / non-finite → undefined (⇒ cleared cell).
export function parseNumber(str) {
  if (str === "" || str === null || str === undefined) return undefined;
  const n = Number(str);
  return Number.isFinite(n) ? n : undefined;
}
