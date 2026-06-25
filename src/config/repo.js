import { getSiteData } from './store';
import { getState, writeState } from './state';

// ============================================================================
// DATA-ACCESS LAYER — the single interface the app uses for data.
// Reads merge immutable content (seed) with the shared state overlay and return
// already-valid values, so callers trust them. Writes go through one read-
// modify-write helper against the single Redis `state` record.
//
// Price model: a drink's COGS = matcha (global dose × selected powder ₱/g) +
// milk (drink.milkMl × selected milk ₱/ml) + Σ attached add-on ingredient ₱ +
// packaging + additional. Matcha & milk unit prices and each ingredient price
// are overridable; overrides are keyed "matcha:<powder>" / "milk:<label>" /
// "ing:<name>" in priceOverrides.
// ============================================================================

async function mutate(fn) {
  return writeState(fn(await getState()));
}
const toggle = (arr, x) => (arr.includes(x) ? arr.filter((v) => v !== x) : [...arr, x]);
const without = (obj, key) => { const { [key]: _drop, ...rest } = obj; return rest; };

export const repo = {
  // ---- content (read-only) ----
  events: async () => {
    const { events, eventLinks } = await getSiteData();
    return events.map((e) => ({ ...e, links: eventLinks[e.name] ?? [] }));
  },
  powders: async () => (await getSiteData()).powders,
  powderImages: async () => (await getSiteData()).powderImages,
  competitors: async () => (await getSiteData()).competitors,
  milkOptions: async () => (await getSiteData()).milkOptions,

  // drinks, with per-drink ingredient attachments + base (matcha/milk) toggles
  // overlaid from shared state, and reference photos overlaid from seed.
  drinks: async () => {
    const { drinks, drinkImages } = await getSiteData();
    const { drinkIngredients, drinkBases } = await getState();
    return drinks.map((d) => {
      const base = drinkBases[d.name] ?? {};
      return {
        ...d,
        ingredients: drinkIngredients[d.name] ?? d.ingredients,
        images: drinkImages[d.name] ?? [],
        hasMatcha: base.matcha ?? true, // absent key ⇒ base present
        hasMilk: base.milk ?? true,
      };
    });
  },

  // ingredient catalog = seed ∪ user-added, with REFERENCE prices.
  // (Price overrides live in priceOverrides — the calculator shows ref + override.)
  ingredients: async () => {
    const { ingredients } = await getSiteData();
    const { extraIngredients } = await getState();
    const extras = Object.entries(extraIngredients).map(([name, v]) => ({ name, ...v }));
    return [...ingredients, ...extras];
  },

  costs: async () => {
    const { pricing } = await getSiteData();
    const { costs } = await getState();
    return { packaging: costs.packaging ?? pricing.packaging, additional: costs.additional ?? pricing.additional };
  },

  // ---- shared-state reads ----
  savedEvents: async () => (await getState()).savedEvents,
  savedPowders: async () => (await getState()).savedPowders,
  savedDrinks: async () => (await getState()).savedDrinks,
  savedCompetitors: async () => (await getState()).savedCompetitors,
  srp: async () => (await getState()).srp,
  priceOverrides: async () => (await getState()).priceOverrides,

  // ---- shared-state writes (read-modify-write the one record) ----
  toggleEvent: (name) => mutate((s) => ({ ...s, savedEvents: toggle(s.savedEvents, name) })),
  togglePowder: (name) => mutate((s) => ({ ...s, savedPowders: toggle(s.savedPowders, name) })),
  toggleDrink: (name) => mutate((s) => ({ ...s, savedDrinks: toggle(s.savedDrinks, name) })),
  toggleCompetitor: (name) => mutate((s) => ({ ...s, savedCompetitors: toggle(s.savedCompetitors, name) })),

  setSrp: (drink, price) => mutate((s) => ({ ...s, srp: { ...s.srp, [drink]: price } })),

  setPriceOverride: (key, price) => mutate((s) => ({ ...s, priceOverrides: { ...s.priceOverrides, [key]: price } })),
  resetPriceOverride: (key) => mutate((s) => ({ ...s, priceOverrides: without(s.priceOverrides, key) })),

  // Attach/detach one ingredient to a drink. Computed SERVER-SIDE from the fresh
  // effective list (state override or seed default) so concurrent edits by another
  // user are preserved — the client never sends an absolute list that could clobber.
  attachIngredient: async (drink, ingredient) => {
    const [{ drinks }, s] = await Promise.all([getSiteData(), getState()]);
    const current = s.drinkIngredients[drink] ?? drinks.find((d) => d.name === drink).ingredients;
    if (current.includes(ingredient)) return s;
    return writeState({ ...s, drinkIngredients: { ...s.drinkIngredients, [drink]: [...current, ingredient] } });
  },
  detachIngredient: async (drink, ingredient) => {
    const [{ drinks }, s] = await Promise.all([getSiteData(), getState()]);
    const current = s.drinkIngredients[drink] ?? drinks.find((d) => d.name === drink).ingredients;
    return writeState({ ...s, drinkIngredients: { ...s.drinkIngredients, [drink]: current.filter((n) => n !== ingredient) } });
  },

  // base = 'matcha' | 'milk'; absent key means present, so the first toggle removes it.
  toggleBase: async (drink, base) => {
    const s = await getState();
    const current = s.drinkBases[drink] ?? {};
    const present = current[base] ?? true;
    return writeState({ ...s, drinkBases: { ...s.drinkBases, [drink]: { ...current, [base]: !present } } });
  },

  // create a new add-on ingredient in the catalog (may be partially filled)
  addIngredient: ({ name, emoji = '', price, link = null }) =>
    mutate((s) => ({ ...s, extraIngredients: { ...s.extraIngredients, [name]: { emoji, price, link } } })),

  setCosts: (patch) => mutate((s) => ({ ...s, costs: { ...s.costs, ...patch } })),
};
