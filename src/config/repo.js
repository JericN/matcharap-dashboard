import { getSiteData } from './store';
import { getState, writeState } from './state';

// ============================================================================
// DATA-ACCESS LAYER — the single interface the app uses for data.
// Reads return already-validated values (store/state parse at the boundary),
// so callers trust them. Writes are scoped to the only mutable data: the
// shared `selection` (saved powders) and `prices` (SRP overrides). Content
// (events, powders, competitors, …) is read-only here — it's managed in
// Edge Config / seed, not edited through the app.
// ============================================================================

export const repo = {
  // ---- content (read-only) ----
  events: async () => (await getSiteData()).events,
  powders: async () => (await getSiteData()).powders,
  competitors: async () => (await getSiteData()).competitors,
  drinks: async () => (await getSiteData()).drinks,
  ingredients: async () => (await getSiteData()).ingredients,
  milkOptions: async () => (await getSiteData()).milkOptions,
  pricing: async () => (await getSiteData()).pricing,
  powderImages: async () => (await getSiteData()).powderImages,

  // ---- shared selection (saved powders) ----
  selection: {
    list: async () => (await getState()).saved,
    toggle: async (name) => {
      const s = await getState();
      const saved = s.saved.includes(name) ? s.saved.filter((n) => n !== name) : [...s.saved, name];
      return writeState({ ...s, saved });
    },
  },

  // ---- shared prices (SRP overrides; defaults live on each drink) ----
  prices: {
    map: async () => (await getState()).srp,
    set: async (name, price) => {
      const s = await getState();
      return writeState({ ...s, srp: { ...s.srp, [name]: price } });
    },
    reset: async () => {
      const s = await getState();
      return writeState({ ...s, srp: {} });
    },
  },
};
