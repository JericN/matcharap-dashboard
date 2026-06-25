import { getSiteData } from "./store";
import { getState, writeState } from "./state";

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
const without = (obj, key) => {
  const { [key]: _drop, ...rest } = obj;
  return rest;
};

export const repo = {
  // ---- content (read-only) ----
  events: async () => {
    const { events, eventLinks } = await getSiteData();
    return events.map((e) => ({ ...e, links: eventLinks[e.name] ?? [] }));
  },
  powders: async () => (await getSiteData()).powders,
  powderImages: async () => (await getSiteData()).powderImages,
  // competitors, with brand logo overlaid from seed (img = null ⇒ colored numbered circle)
  competitors: async () => {
    const { competitors, competitorImages } = await getSiteData();
    return competitors.map((c) => ({ ...c, img: competitorImages[c.name] ?? null }));
  },
  milkOptions: async () => (await getSiteData()).milkOptions,

  // drinks = seed built-ins ∪ user-created (extraDrinks), each with overlays
  // applied from shared state: text/milk edits (drinkOverrides), attached
  // ingredients (drinkIngredients), base toggles (drinkBases), reference photos.
  drinks: async () => {
    const { drinks, drinkImages } = await getSiteData();
    const { drinkIngredients, drinkBases, extraDrinks, drinkOverrides } = await getState();
    const created = Object.entries(extraDrinks).map(([name, d]) => ({ name, ...d }));
    return [...drinks, ...created].map((d) => {
      const ov = drinkOverrides[d.name] ?? {};
      const base = drinkBases[d.name] ?? {};
      return {
        ...d,
        note: ov.note ?? d.note,
        desc: ov.desc ?? d.desc,
        milkMl: ov.milkMl ?? d.milkMl,
        ingredients: drinkIngredients[d.name] ?? d.ingredients,
        images: drinkImages[d.name] ?? [],
        hasMatcha: base.matcha ?? true, // absent key ⇒ base present
        hasMilk: base.milk ?? true,
        custom: d.name in extraDrinks, // user-created (deletable)
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
    return {
      packaging: costs.packaging ?? pricing.packaging,
      additional: costs.additional ?? pricing.additional,
    };
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
  toggleCompetitor: (name) =>
    mutate((s) => ({ ...s, savedCompetitors: toggle(s.savedCompetitors, name) })),

  setSrp: (drink, price) => mutate((s) => ({ ...s, srp: { ...s.srp, [drink]: price } })),

  setPriceOverride: (key, price) =>
    mutate((s) => ({ ...s, priceOverrides: { ...s.priceOverrides, [key]: price } })),
  resetPriceOverride: (key) =>
    mutate((s) => ({ ...s, priceOverrides: without(s.priceOverrides, key) })),

  // Attach/detach one ingredient to a drink. Computed SERVER-SIDE from the fresh
  // effective list (state override or seed default) so concurrent edits by another
  // user are preserved — the client never sends an absolute list that could clobber.
  attachIngredient: async (drink, ingredient) => {
    const [{ drinks }, s] = await Promise.all([getSiteData(), getState()]);
    const current = s.drinkIngredients[drink] ?? drinks.find((d) => d.name === drink).ingredients;
    if (current.includes(ingredient)) return s;
    return writeState({
      ...s,
      drinkIngredients: { ...s.drinkIngredients, [drink]: [...current, ingredient] },
    });
  },
  detachIngredient: async (drink, ingredient) => {
    const [{ drinks }, s] = await Promise.all([getSiteData(), getState()]);
    const current = s.drinkIngredients[drink] ?? drinks.find((d) => d.name === drink).ingredients;
    return writeState({
      ...s,
      drinkIngredients: { ...s.drinkIngredients, [drink]: current.filter((n) => n !== ingredient) },
    });
  },

  // base = 'matcha' | 'milk'; absent key means present, so the first toggle removes it.
  toggleBase: async (drink, base) => {
    const s = await getState();
    const current = s.drinkBases[drink] ?? {};
    const present = current[base] ?? true;
    return writeState({
      ...s,
      drinkBases: { ...s.drinkBases, [drink]: { ...current, [base]: !present } },
    });
  },

  // create a new add-on ingredient in the catalog (may be partially filled)
  addIngredient: ({ name, emoji = "", price, link = null }) =>
    mutate((s) => ({
      ...s,
      extraIngredients: { ...s.extraIngredients, [name]: { emoji, price, link } },
    })),

  // Add or edit a drink. New drink -> stored whole in extraDrinks. Editing any
  // drink (built-in or custom) -> writes the same overlays the inline UI uses
  // (drinkOverrides for text/milk, drinkIngredients, drinkBases, srp) so there
  // is one home per field and no precedence conflicts.
  saveDrink: ({ name, note, desc, milkMl, srp, ingredients, hasMatcha, hasMilk }, isNew) =>
    mutate((s) => {
      const drinkBases = { ...s.drinkBases, [name]: { matcha: hasMatcha, milk: hasMilk } };
      if (isNew) {
        return {
          ...s,
          extraDrinks: { ...s.extraDrinks, [name]: { note, desc, milkMl, ingredients, srp } },
          drinkBases,
        };
      }
      return {
        ...s,
        drinkOverrides: { ...s.drinkOverrides, [name]: { note, desc, milkMl } },
        drinkIngredients: { ...s.drinkIngredients, [name]: ingredients },
        srp: { ...s.srp, [name]: srp },
        drinkBases,
      };
    }),

  // delete a user-created drink + all its overlays (built-ins can't be deleted)
  deleteDrink: (name) =>
    mutate((s) => ({
      ...s,
      extraDrinks: without(s.extraDrinks, name),
      drinkOverrides: without(s.drinkOverrides, name),
      drinkIngredients: without(s.drinkIngredients, name),
      drinkBases: without(s.drinkBases, name),
      srp: without(s.srp, name),
      savedDrinks: s.savedDrinks.filter((n) => n !== name),
    })),

  setCosts: (patch) => mutate((s) => ({ ...s, costs: { ...s.costs, ...patch } })),
};
