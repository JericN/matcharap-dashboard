// Pure helpers that derive numbers from a milk's structured `price` (₱ pack) +
// `liters` (pack size). Client-safe; the milk-card headline and the calculator's
// milk-option derivation share ONE source. Mirrors features/powders/pricing.js.

// numeric ₱/L — for cost math + the calculator dropdown
export function perLiter(milk) {
  return milk.liters > 0 ? milk.price / milk.liters : null;
}

// rounded ₱/L for display — the card headline
export function perLiterLabel(milk) {
  const pl = perLiter(milk);
  return pl == null ? "—" : "₱" + Math.round(pl);
}

// ≈₱ per cup at a given milk volume (default 180 ml) — the card sub-line
export function perCupLabel(milk, ml = 180) {
  const pl = perLiter(milk);
  return pl == null ? "—" : `₱${Math.round((pl / 1000) * ml)}`;
}

// "₱120 / 1L" (or "₱59 / 370 ml" for sub-litre packs) pack line shown on the card
export function priceLabel(milk) {
  const size = milk.liters < 1 ? `${Math.round(milk.liters * 1000)} ml` : `${milk.liters}L`;
  return `₱${milk.price.toLocaleString("en-US")} / ${size}`;
}

// Concentrates/creamers (evaporated, condensed) are research-board entries, not
// pourable latte bases — excluded from the calculator dropdown.
const CONCENTRATE = /evaporat|condensed|creamer/i;

// The calculator's milk-option label, which is ALSO the identity for a
// "milk:<label>" price override. Embeds the rounded ₱/L so the calculator key
// matches what the calculator + milks page compute.
export function milkOptionLabel(milk) {
  const pl = perLiter(milk);
  return pl == null ? null : `${milk.name} — ₱${Math.round(pl)}/L`;
}

// Milk choices for the calculator dropdown, derived from the milk list (single
// source of truth, like toMatchaOptions). Skips concentrates + milks with no
// parseable ₱/L; cheapest-first. `ml` is ₱ per ml.
export function toMilkOptions(milks) {
  return milks
    .filter((m) => !CONCENTRATE.test(`${m.type} ${m.name}`))
    .map((m) => ({ milk: m, pl: perLiter(m) }))
    .filter((x) => x.pl != null)
    .sort((a, b) => a.pl - b.pl)
    .map(({ milk, pl }) => ({ l: milkOptionLabel(milk), ml: pl / 1000, cat: milk.cat }));
}
