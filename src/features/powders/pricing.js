// Pure helpers that read numbers out of a powder's display `price` string.
// Client-safe (no server/Edge deps) so the powder-card badge and the calculator's
// matcha-option derivation share ONE parser instead of each rolling their own.

const PER_G = /₱([\d.]+)(?:[–-][\d.]+)?\s*\/\s*g/;
const PER_G_LABEL = /₱[\d.]+(?:[–-][\d.]+)?\s*\/\s*g/;

// numeric ₱/g (lower bound of any range) — for cost math
export function perGram(powder) {
  const m = powder.price.match(PER_G);
  return m ? parseFloat(m[1]) : null;
}

// display ₱/g, range preserved (e.g. "₱27–70") — for the badge
export function perGramLabel(powder) {
  const m = powder.price.match(PER_G_LABEL);
  return m ? m[0].replace(/\s*\/\s*g/, '') : '—';
}

// Matcha choices for the calculator, derived from the powder list (single
// source of truth). Skips sweetened latte mixes; cheapest-first.
export function toMatchaOptions(powders) {
  return powders
    .filter((p) => !/sweeten|mix/i.test(p.price) && perGram(p) != null)
    .map((p) => ({ l: p.name, g: perGram(p), cat: p.cat }))
    .sort((a, b) => a.g - b.g);
}
