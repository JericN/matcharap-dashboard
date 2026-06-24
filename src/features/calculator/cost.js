// Pure pricing math. Inputs are already-valid (validated at the config boundary),
// so these functions just compute — no guards, no checks.

export const matchaCostPerCup = (pricePerGram, doseGrams) => Math.round(pricePerGram * doseGrams);

export const milkCostPerCup = (milkPricePerMl, milkMl) => milkMl * milkPricePerMl;

export function cogsForDrink(drink, { pricePerGram, doseGrams, milkPricePerMl, extras }) {
  const matcha = matchaCostPerCup(pricePerGram, doseGrams);             // rounded ₱
  const milk = Math.round(milkCostPerCup(milkPricePerMl, drink.milkMl)); // round once, here
  return matcha + milk + drink.fl + extras;                             // whole-₱ parts → breakdown sums exactly
}

export const profit = (srp, cogs) => srp - cogs;

export const marginPct = (srp, cogs) => (srp > 0 ? Math.round(((srp - cogs) / srp) * 100) : 0);

export const marginWord = (m) => (m >= 65 ? 'healthy ✓' : m >= 45 ? 'ok' : 'tight');

// Batch / shopping-list planner. Assumes a representative cup (milkMl defaults
// to a 180ml latte) at the currently-selected matcha & milk. Ingredient cost
// only — no booth fee, labour or spoilage.
export function batchPlan({ cups, doseGrams, pricePerGram, packG, milkPricePerMl, milkMl = 180, extras }) {
  const grams = cups * doseGrams;
  const tins = packG ? Math.ceil(grams / packG) : null;
  const matchaSpend = Math.round(grams * pricePerGram);
  const milkLitres = (cups * milkMl) / 1000;
  const milkSpend = Math.round(cups * milkMl * milkPricePerMl);
  const pkgSpend = cups * extras;
  const total = matchaSpend + milkSpend + pkgSpend;
  return { grams, tins, matchaSpend, milkLitres, milkSpend, pkgSpend, total, perCup: cups ? Math.round(total / cups) : 0 };
}
