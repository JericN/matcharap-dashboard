// Pure pricing math. Inputs are already-valid (validated at the config boundary),
// so these functions just compute — no guards, no checks.

export const matchaCostPerCup = (pricePerGram, doseGrams) => Math.round(pricePerGram * doseGrams);

export const milkCostPerCup = (milkPricePerMl, milkMl) => milkMl * milkPricePerMl;

export function cogsForDrink(drink, { pricePerGram, doseGrams, milkPricePerMl, extras }) {
  const matcha = matchaCostPerCup(pricePerGram, doseGrams);
  const milk = milkCostPerCup(milkPricePerMl, drink.milkMl);
  return Math.round(matcha + milk + drink.fl + extras);
}

export const profit = (srp, cogs) => srp - cogs;

export const marginPct = (srp, cogs) => (srp > 0 ? Math.round(((srp - cogs) / srp) * 100) : 0);

export const marginWord = (m) => (m >= 65 ? 'healthy ✓' : m >= 45 ? 'ok' : 'tight');
