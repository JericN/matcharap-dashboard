// Pure helpers that derive numbers from a powder's structured `price` (₱ pack) +
// `grams` (pack size). Client-safe (no server/Edge deps) so the powder-card badge
// and the calculator's matcha-option derivation share ONE source of truth.

// numeric ₱/g — for cost math
export function perGram(powder) {
  return powder.grams > 0 ? powder.price / powder.grams : null;
}

// rounded ₱/g for display (1 decimal under ₱100, else integer) — the card badge
export function perGramLabel(powder) {
  const g = perGram(powder);
  if (g == null) return "—";
  return "₱" + (g < 100 ? Math.round(g * 10) / 10 : Math.round(g));
}

// "₱929 / 30g" pack line shown on the card
export function priceLabel(powder) {
  return `₱${powder.price.toLocaleString("en-US")} / ${powder.grams}g`;
}

// ≈₱ per serving (default 2g) — the card sub-line
export function servingLabel(powder, grams = 2) {
  const g = perGram(powder);
  return g == null ? "—" : `₱${Math.round(g * grams)}`;
}

// Matcha choices for the calculator, derived from the powder list (single source
// of truth). Skips powders with no parseable ₱/g; cheapest-first.
export function toMatchaOptions(powders) {
  return powders
    .filter((p) => perGram(p) != null)
    .map((p) => ({ l: p.name, g: perGram(p), cat: p.cat }))
    .sort((a, b) => a.g - b.g);
}
