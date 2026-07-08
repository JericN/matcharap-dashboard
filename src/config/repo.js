import { getSiteData } from "./store";
import { getState, writeState } from "./state";
import { toMilkOptions } from "@/features/milks/pricing";
import {
  coerceCell,
  writeCell,
  cloneValues,
  stripColumn,
  stripOption,
  restoreColumn as restoreColumnCore,
  restoreOption as restoreOptionCore,
  restoreTab as restoreTabCore,
  restoreView as restoreViewCore,
} from "./expenseModel.mjs";

// ============================================================================
// DATA-ACCESS LAYER — the single interface the app uses for data.
// Reads merge immutable content (seed) with the shared state overlay and return
// already-valid values, so callers trust them. Writes go through one read-
// modify-write helper against the single Redis `state` record.
//
// Price model: a drink's COGS = matcha (global dose × selected powder ₱/g) +
// milk (global ml/cup × selected milk ₱/ml) + Σ attached add-on ingredient ₱ +
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
  // powders with per-item price/grams edits overlaid from state (powderOverrides)
  powders: async () => {
    const { powders } = await getSiteData();
    const { powderOverrides } = await getState();
    return powders.map((p) => {
      const ov = powderOverrides[p.name] ?? {};
      return { ...p, price: ov.price ?? p.price, grams: ov.grams ?? p.grams };
    });
  },
  powderImages: async () => (await getSiteData()).powderImages,
  // competitors, with brand logo overlaid from seed (img = null ⇒ colored numbered circle)
  competitors: async () => {
    const { competitors, competitorImages } = await getSiteData();
    return competitors.map((c) => ({ ...c, img: competitorImages[c.name] ?? null }));
  },
  // milks with per-item price/liters edits overlaid from state (milkOverrides)
  milks: async () => {
    const { milks } = await getSiteData();
    const { milkOverrides } = await getState();
    return milks.map((m) => {
      const ov = milkOverrides[m.name] ?? {};
      return { ...m, price: ov.price ?? m.price, liters: ov.liters ?? m.liters };
    });
  },
  milkImages: async () => (await getSiteData()).milkImages,
  // calculator milk dropdown, DERIVED from the OVERLAID milk catalog (single source
  // of truth, mirrors toMatchaOptions): [{ l, ml }] cheapest-first.
  milkOptions: async () => toMilkOptions(await repo.milks()),

  // drinks = seed built-ins ∪ user-created (extraDrinks), each with overlays
  // applied from shared state: text edits (drinkOverrides), attached
  // ingredients (drinkIngredients), base toggles (drinkBases), reference photos.
  drinks: async () => {
    const { drinks, drinkImages, ingredients } = await getSiteData();
    const { drinkIngredients, drinkBases, extraDrinks, drinkOverrides, extraIngredients, deletedIngredients } =
      await getState();
    const created = Object.entries(extraDrinks).map(([name, d]) => ({ name, ...d }));
    const del = new Set(deletedIngredients);
    const validIng = new Set([
      ...ingredients.map((i) => i.name).filter((n) => !del.has(n)),
      ...Object.keys(extraIngredients),
    ]);
    return [...drinks, ...created].map((d) => {
      const ov = drinkOverrides[d.name] ?? {};
      const base = drinkBases[d.name] ?? {};
      return {
        ...d,
        note: ov.note ?? d.note,
        desc: ov.desc ?? d.desc,
        ingredients: (drinkIngredients[d.name] ?? d.ingredients).filter((n) => validIng.has(n)),
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
    const { extraIngredients, ingredientOverrides, deletedIngredients } = await getState();
    const del = new Set(deletedIngredients);
    const seed = ingredients
      .filter((i) => !del.has(i.name))
      .map((i) => ({ ...i, ...(ingredientOverrides[i.name] ?? {}), custom: false }));
    const extras = Object.entries(extraIngredients).map(([name, v]) => ({ name, ...v, custom: true }));
    return [...seed, ...extras];
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
  savedMilks: async () => (await getState()).savedMilks,
  savedDrinks: async () => (await getState()).savedDrinks,
  savedCompetitors: async () => (await getState()).savedCompetitors,
  srp: async () => (await getState()).srp,
  priceOverrides: async () => (await getState()).priceOverrides,
  expenses: async () => (await getState()).expenses,
  expenseTabs: async () => (await getState()).expenseTabs,

  // ---- shared-state writes (read-modify-write the one record) ----
  toggleEvent: (name) => mutate((s) => ({ ...s, savedEvents: toggle(s.savedEvents, name) })),
  togglePowder: (name) => mutate((s) => ({ ...s, savedPowders: toggle(s.savedPowders, name) })),
  toggleMilk: (name) => mutate((s) => ({ ...s, savedMilks: toggle(s.savedMilks, name) })),
  toggleDrink: (name) => mutate((s) => ({ ...s, savedDrinks: toggle(s.savedDrinks, name) })),
  toggleCompetitor: (name) =>
    mutate((s) => ({ ...s, savedCompetitors: toggle(s.savedCompetitors, name) })),

  setSrp: (drink, price) => mutate((s) => ({ ...s, srp: { ...s.srp, [drink]: price } })),

  // edit a powder's price (₱ pack) + grams — overlay on seed, keyed by name
  savePowder: (name, { price, grams }) =>
    mutate((s) => ({ ...s, powderOverrides: { ...s.powderOverrides, [name]: { price, grams } } })),
  // edit a milk's price (₱ pack) + liters — overlay on seed, keyed by name
  saveMilk: (name, { price, liters }) =>
    mutate((s) => ({ ...s, milkOverrides: { ...s.milkOverrides, [name]: { price, liters } } })),

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

  // create a new add-on ingredient in the catalog (name + ₱)
  addIngredient: ({ name, price }) =>
    mutate((s) => ({
      ...s,
      extraIngredients: { ...s.extraIngredients, [name]: { price } },
    })),

  // Edit an ingredient's price. Custom → update its extraIngredients record; seed
  // (built-in) → write an ingredientOverrides overlay. The name is the key.
  editIngredient: (name, { price }) =>
    mutate((s) =>
      name in s.extraIngredients
        ? { ...s, extraIngredients: { ...s.extraIngredients, [name]: { price } } }
        : { ...s, ingredientOverrides: { ...s.ingredientOverrides, [name]: { price } } },
    ),

  // Delete an ingredient. Custom → remove from extraIngredients. Seed →
  // tombstone it in deletedIngredients. Always drop its override + price
  // override; drink refs to it are filtered out at read time, so no cascade.
  deleteIngredient: (name) =>
    mutate((s) => ({
      ...s,
      extraIngredients: without(s.extraIngredients, name),
      ingredientOverrides: without(s.ingredientOverrides, name),
      deletedIngredients:
        name in s.extraIngredients
          ? s.deletedIngredients
          : [...new Set([...s.deletedIngredients, name])],
      priceOverrides: without(s.priceOverrides, `ing:${name}`),
    })),

  // Add or edit a drink. New drink -> stored whole in extraDrinks. Editing any
  // drink (built-in or custom) -> writes the same overlays the inline UI uses
  // (drinkOverrides for text, drinkIngredients, drinkBases, srp) so there
  // is one home per field and no precedence conflicts.
  saveDrink: ({ name, note, desc, srp, ingredients, hasMatcha, hasMilk }, isNew) =>
    mutate((s) => {
      const drinkBases = { ...s.drinkBases, [name]: { matcha: hasMatcha, milk: hasMilk } };
      if (isNew) {
        return {
          ...s,
          extraDrinks: { ...s.extraDrinks, [name]: { note, desc, ingredients, srp } },
          drinkBases,
        };
      }
      return {
        ...s,
        drinkOverrides: { ...s.drinkOverrides, [name]: { note, desc } },
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

  // ---- expense-planner rows (the client builds each row's id) ----
  // Append, patch-by-id, and remove-by-id all work off the FRESH list, so a
  // teammate editing a different row concurrently is preserved.
  // `afterId` inserts the new row right below an existing one (used by
  // duplicate); omitted/unknown ⇒ append to the end.
  addExpense: (row, afterId) =>
    mutate((s) => {
      const i = afterId ? s.expenses.findIndex((r) => r.id === afterId) : -1;
      if (i < 0) return { ...s, expenses: [...s.expenses, row] };
      const expenses = s.expenses.slice();
      expenses.splice(i + 1, 0, row);
      return { ...s, expenses };
    }),
  // Write a single cell as a fresh-list delta: preserves the row's other cells
  // (concurrent edits to a different cell survive) and guards a concurrently-deleted
  // row/column. `coerceCell` enforces the column type at the boundary; `writeCell`
  // drops the key when the value is empty (empty cell ≡ absent key).
  setExpenseCell: (rowId, colId, value) =>
    mutate((s) => {
      const row = s.expenses.find((r) => r.id === rowId);
      if (!row) return s; // row deleted concurrently → no-op
      const tab = s.expenseTabs.find((t) => t.id === row.tabId);
      const col = tab?.columns.find((c) => c.id === colId);
      if (!col) return s; // column gone → drop the write (no dangling key)
      const v = coerceCell(col, value);
      return {
        ...s,
        expenses: s.expenses.map((r) =>
          r.id === rowId ? { ...r, values: writeCell(r.values, colId, v) } : r,
        ),
      };
    }),
  // Duplicate a row off the FRESH row with a deep-copied cell map (arrays must not
  // alias); the client passes the pre-generated `newId` so optimistic + server ids match.
  duplicateExpense: (rowId, newId, afterId) =>
    mutate((s) => {
      const src = s.expenses.find((r) => r.id === rowId);
      if (!src) return s;
      const copy = { ...src, id: newId, values: cloneValues(src.values) };
      const anchor = afterId ?? rowId;
      const i = s.expenses.findIndex((r) => r.id === anchor);
      const expenses = s.expenses.slice();
      expenses.splice(i < 0 ? s.expenses.length : i + 1, 0, copy);
      return { ...s, expenses };
    }),
  removeExpense: (id) =>
    mutate((s) => ({ ...s, expenses: s.expenses.filter((r) => r.id !== id) })),
  // Reorder one tab's rows to match `orderedIds`, refilling only that tab's
  // slots in the global array so other tabs (and concurrent edits) are left in
  // place. Unknown ids are skipped; a tab row missing from the list (e.g. a
  // teammate just added one) is appended so nothing is dropped.
  reorderExpenses: (tabId, orderedIds) =>
    mutate((s) => {
      const byId = new Map(
        s.expenses.filter((r) => r.tabId === tabId).map((r) => [r.id, r]),
      );
      const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
      const seen = new Set(seq.map((r) => r.id));
      for (const r of byId.values()) if (!seen.has(r.id)) seq.push(r);
      let k = 0;
      const expenses = s.expenses.map((r) => (r.tabId === tabId ? seq[k++] : r));
      return { ...s, expenses };
    }),

  // ---- expense-planner columns (per-tab; the client builds each column's id) ----
  addColumn: (tabId, column) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) =>
        t.id === tabId ? { ...t, columns: [...t.columns, column] } : t,
      ),
    })),
  // patch = { name?, width?, number? } — rename, resize, or set number format
  updateColumn: (tabId, colId, patch) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) =>
        t.id === tabId
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : t,
      ),
    })),
  // Reorder one tab's columns to match `orderedIds`, keeping any not listed.
  reorderColumns: (tabId, orderedIds) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) => {
        if (t.id !== tabId) return t;
        const byId = new Map(t.columns.map((c) => [c.id, c]));
        const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
        const seen = new Set(seq.map((c) => c.id));
        for (const c of t.columns) if (!seen.has(c.id)) seq.push(c);
        return { ...t, columns: seq };
      }),
    })),
  // Delete a column + strip its key from every in-tab row (cascade core).
  deleteColumn: (tabId, colId) =>
    mutate((s) => {
      const { tabs, rows } = stripColumn(s.expenseTabs, s.expenses, tabId, colId);
      return { ...s, expenseTabs: tabs, expenses: rows };
    }),

  // ---- expense-planner select/multiSelect options (per column) ----
  addOption: (tabId, colId, option) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              columns: t.columns.map((c) =>
                c.id === colId ? { ...c, options: [...(c.options ?? []), option] } : c,
              ),
            }
          : t,
      ),
    })),
  // patch = { name?, color? }
  updateOption: (tabId, colId, optionId, patch) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              columns: t.columns.map((c) =>
                c.id === colId
                  ? { ...c, options: (c.options ?? []).map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
                  : c,
              ),
            }
          : t,
      ),
    })),
  // Delete an option + strip it from every in-tab cell (cascade core).
  deleteOption: (tabId, colId, optionId) =>
    mutate((s) => {
      const { tabs, rows } = stripOption(s.expenseTabs, s.expenses, tabId, colId, optionId);
      return { ...s, expenseTabs: tabs, expenses: rows };
    }),

  // ---- expense-planner undo/redo restores (re-insert deleted things + data) ----
  // cells = [{ rowId, value }] captured before the delete.
  restoreColumn: (tabId, column, index, cells, viewRefs) =>
    mutate((s) => {
      const { tabs, rows } = restoreColumnCore(s.expenseTabs, s.expenses, tabId, column, index, cells, viewRefs);
      return { ...s, expenseTabs: tabs, expenses: rows };
    }),
  restoreOption: (tabId, colId, option, index, cells, viewRefs) =>
    mutate((s) => {
      const { tabs, rows } = restoreOptionCore(s.expenseTabs, s.expenses, tabId, colId, option, index, cells, viewRefs);
      return { ...s, expenseTabs: tabs, expenses: rows };
    }),
  restoreTab: (tab, index, tabRows) =>
    mutate((s) => {
      const { tabs, rows } = restoreTabCore(s.expenseTabs, s.expenses, tab, index, tabRows);
      return { ...s, expenseTabs: tabs, expenses: rows };
    }),

  // ---- expense-planner sheets/tabs (group rows by tabId) ----
  addExpenseTab: (tab) => mutate((s) => ({ ...s, expenseTabs: [...s.expenseTabs, tab] })),
  // Reorder the sheets to match `orderedIds`, keeping any not listed (mirrors reorderColumns).
  reorderExpenseTabs: (orderedIds) =>
    mutate((s) => {
      const byId = new Map(s.expenseTabs.map((t) => [t.id, t]));
      const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
      const seen = new Set(seq.map((t) => t.id));
      for (const t of s.expenseTabs) if (!seen.has(t.id)) seq.push(t);
      return { ...s, expenseTabs: seq };
    }),
  renameExpenseTab: (id, name) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) => (t.id === id ? { ...t, name } : t)),
    })),
  // delete the tab AND its rows; refuse to remove the last remaining tab
  removeExpenseTab: (id) =>
    mutate((s) =>
      s.expenseTabs.length <= 1
        ? s
        : {
            ...s,
            expenseTabs: s.expenseTabs.filter((t) => t.id !== id),
            expenses: s.expenses.filter((r) => r.tabId !== id),
          },
    ),

  // ---- views (per-table saved lenses: filters + sorts + hidden fields) ----
  addView: (tabId, view) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) => (t.id === tabId ? { ...t, views: [...(t.views ?? []), view] } : t)),
    })),
  // partial patch of { name?, filters?, sorts?, hiddenColumnIds? } — last-write-wins per view
  updateView: (tabId, viewId, patch) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) =>
        t.id === tabId ? { ...t, views: t.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)) } : t,
      ),
    })),
  // refuse to remove a table's last remaining view (≥1 view invariant, mirrors tabs)
  removeView: (tabId, viewId) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) =>
        t.id === tabId && t.views.length > 1 ? { ...t, views: t.views.filter((v) => v.id !== viewId) } : t,
      ),
    })),
  reorderViews: (tabId, orderedIds) =>
    mutate((s) => ({
      ...s,
      expenseTabs: s.expenseTabs.map((t) => {
        if (t.id !== tabId) return t;
        const byId = new Map(t.views.map((v) => [v.id, v]));
        const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
        const seen = new Set(seq.map((v) => v.id));
        for (const v of t.views) if (!seen.has(v.id)) seq.push(v);
        return { ...t, views: seq };
      }),
    })),
  restoreView: (tabId, view, index) =>
    mutate((s) => ({ ...s, expenseTabs: restoreViewCore(s.expenseTabs, tabId, view, index) })),
};
