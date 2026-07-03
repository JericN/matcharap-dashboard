# Drinks: line-item ingredients + simplified `{name, price}` model — design

**Date:** 2026-07-03
**Feature area:** `src/features/drinks/` + `src/config/{schemas,seed,repo}.js` + `src/features/calculator/Calculator.jsx`
**Status:** Approved (design) — pending spec review

## Goal

Make adding ingredients to a drink clearer, and simplify the ingredient model:

- In the **drink modal**, replace the pill row + search picker with an **ingredient line-item list** (each line = **name + price**), plus **＋ New ingredient** (blank line → create + attach) and **Add existing** (pick a catalog ingredient → attach).
- Reduce an ingredient to **exactly two fields: `name` and `price`** — remove `emoji` and `link` (url) everywhere.

## Decisions

- **Ingredient = `{ name, price }`.** `emoji` and `link` are removed from the schema, seed, forms, and every display site.
- **Shared catalog price.** A line's price is the ingredient's single shared price (name-keyed catalog). Editing a line's price edits that ingredient's price everywhere; "Add existing" attaches at the shared price; "＋ New ingredient" creates a new catalog ingredient. (Not per-drink prices.)
- **Keep the standalone "Ingredients" catalog section** on `/drinks` and the edit modal, simplified to name + price — it remains how the catalog is browsed/created/edited/deleted.

### Non-goals (YAGNI)

Per-drink ingredient prices; emoji/icon picker; ingredient categories; quantities per line; a data-migration script (schema strips stale fields on read).

## Data model & migration

**`src/config/schemas.js`:**
```js
export const IngredientSchema = z.object({
  name: z.string(),
  price: z.number().nonnegative(), // ₱ per cup (shared reference)
});
```
Derived state records follow automatically (they are built from `IngredientSchema`):
- `extraIngredients: z.record(z.string(), IngredientSchema.omit({ name: true })).default({})` → each value is now `{ price }`.
- `ingredientOverrides: z.record(z.string(), IngredientSchema.omit({ name: true }).partial()).default({})` → `{ price? }`.
- Update the trailing comments (`// user-created: name -> { emoji, price, link }` → `{ price }`) and the `ingredients:` line comment (drop "each carries its own link").

**`src/config/seed.js`:** strip `emoji` and `link` from all 21 `ingredients` entries, leaving `{ name, price }` each.

**Migration — free, on read.** Zod objects strip unrecognized keys by default, so any `extraIngredients` / `ingredientOverrides` value still holding `{ emoji, price, link }` in Redis parses down to `{ price }` on the next `getState()`. No data write or script needed. (Same "schema is the migration" approach as the documents feature.) The build's static-generation Zod parse validates the new seed.

## Drink form — pills → line items (`src/features/drinks/DrinkForm.jsx`)

Replace the "Add-on ingredients" pill row + "＋ add" search picker with a **line-item editor**:

```
Add-on ingredients                     (prices are shared across drinks)
┌─────────────────────────────────────────────┐
│ Strawberry compote            ₱ 14      ✕    │
│ Salted cream foam             ₱ 15      ✕    │
└─────────────────────────────────────────────┘
[ ＋ New ingredient ]        [ Add existing ▾ ]
```

- **Attached lines:** each shows the ingredient **name** (read-only — the name is the catalog key; renaming would orphan references) + an editable **₱ price** `NumberField` + a remove **✕**.
  - Editing a line's price calls the catalog edit (shared): optimistic local update + `editIngredient(name, { price })`. A small caption ("prices are shared across drinks") makes the shared effect explicit.
  - Remove detaches the ingredient from this drink (does not delete it from the catalog).
- **＋ New ingredient:** appends a blank editable line (name input + price input). On commit (Enter or a ✓): if the name is new, create the catalog ingredient (`addIngredient({ name, price })`) and attach it; if the name already exists in the catalog, just attach it (no duplicate). Empty name is ignored.
- **Add existing ▾:** a dropdown listing catalog ingredients not yet attached (name + shared ₱). Selecting one attaches it. Hidden when all catalog ingredients are already attached.
- **Persistence split (unchanged philosophy):** which ingredients are *attached* is part of the drink and is saved on the drink's **Save** (batched into the `ingredients` name array, as today). Ingredient **creation** and **price edits** are catalog operations that persist **immediately** (they affect the shared catalog regardless of whether the drink is saved), mirroring how the standalone catalog already works.
- The `localStorage` draft (`df:new` / `df:edit:<name>`) continues to persist the attached-names array only.

## Standalone catalog + edit modal

**`src/features/drinks/DrinksGrid.jsx`:**
- `EMPTY` ingredient-creator state → `{ name: "", price: "" }`; `create()` builds `{ name, price }` (drop `emoji`/`link`), drops the `isUrl` helper and the URL check (validate only: non-empty name, not a duplicate).
- Catalog tiles render **name + ₱price** only — remove the emoji `<span>` and the `↗`/`<a href={link}>` branch (a tile is now a plain `<div>` with the right-click edit/delete menu). Update the section blurb (drop the "↗ clickable reference" sentence).
- Creator bar: **name + price + Add** (remove the emoji input and the URL input); update its helper text.

**`src/features/drinks/IngredientForm.jsx`:** keep name (read-only) + **price**; remove the `emoji` and `link` fields, the `link` state, and the URL-validation block. `onSave` returns `{ price }`.

## Downstream cleanups

- **`src/features/drinks/DrinkCard.jsx`:** the add-on `Pill` drops the emoji (pills show name only; base matcha/milk pills keep their 🍵/🥛 literals). Remove `emojiOf`; the "+ add" menu item label becomes `${i.name} — ₱${i.price}` (no emoji).
- **`src/features/calculator/Calculator.jsx`:** remove `emojiOf` and `linkOf`; ingredient labels render `${nm}` (no emoji) at both sites (lines ~241, ~420). No cost-math change.
- **`src/config/repo.js`:** `addIngredient({ name, price })` → writes `extraIngredients[name] = { price }`; `editIngredient(name, { price })` → writes `{ price }` to `extraIngredients` or `ingredientOverrides`. (No `emoji`/`link` defaults.) `deleteIngredient` unchanged. `actions.js` forwards opaque objects → **no change needed**.

## Entanglement & branch (logistics)

- Work happens on branch **`feature/drink-ingredient-line-items`** (off the documents branch HEAD).
- `schemas.js` and `repo.js` currently hold a **teammate's uncommitted expense-reorder WIP** (a `date` field on expense rows; `addExpense(row, afterId)` + `reorderExpenses`). My edits touch *different* regions of those files, so targeted edits won't clobber their work — but a `git add` of either file bundles their WIP into my commit.
- **Preferred:** the teammate commits (or stashes) their expense WIP before implementation starts, so my commits are clean. **Fallback:** proceed and accept the bundling (as previously chosen for the documents work), flagged in the commit. This is a logistics decision to confirm at the review gate, not a design blocker.

## Verification

- `npm run build` — static generation runs the Zod parse over the new seed/schema; a missed `emoji`/`link` in seed or a type error fails it.
- `npm run lint` — separately (lint doesn't run in build).
- Runtime smoke **`/drinks`** and **`/calculator`** (both `force-dynamic`, both read the ingredient catalog): 200 + expected markup. Run in an **isolated detached worktree at HEAD** (committed code only) so the teammate's uncommitted WIP can't confound the build — the pattern used for the documents feature.
- Interactive check (human, in dev): add a new ingredient via a line, add from existing, edit a line's price and confirm it reflects in the catalog + calculator, remove a line, create/edit/delete in the standalone catalog — and confirm existing drinks still render (their attached ingredient names resolve).

## Files touched

- `src/config/schemas.js` — `IngredientSchema` + 2 state-record comments *(entangled)*
- `src/config/seed.js` — strip emoji/link from 21 ingredients
- `src/config/repo.js` — `addIngredient` / `editIngredient` *(entangled)*
- `src/features/drinks/DrinkForm.jsx` — line-item editor
- `src/features/drinks/DrinksGrid.jsx` — catalog tiles + creator bar + wiring
- `src/features/drinks/IngredientForm.jsx` — name + price only
- `src/features/drinks/DrinkCard.jsx` — drop emoji from pills/menu
- `src/features/calculator/Calculator.jsx` — drop emoji/link
- `CLAUDE.md` — update the ingredient-model description (drinks↔ingredients data model bullet)
