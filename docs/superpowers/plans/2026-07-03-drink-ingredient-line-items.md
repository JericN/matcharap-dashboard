# Drink Line-Item Ingredients + `{name, price}` Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify ingredients to `{ name, price }` (remove emoji + link everywhere) and replace the drink modal's ingredient pills with a line-item editor (name + shared ₱ price; create-new or add-existing).

**Architecture:** `IngredientSchema` drops to two fields; Zod strips the stale `emoji`/`link` from seed and Redis state on read (free migration). The drink form edits attached ingredients as line items, where the price is the ingredient's single shared catalog price — editing/creating persists to the catalog immediately (via `onSetIngredientPrice`/`onCreateIngredient` threaded from `DrinksGrid`), while which ingredients are attached stays batched into the drink's Save.

**Tech Stack:** Next.js 14 (app router), React 18, Tailwind v3, Zod v4, Upstash Redis. No new deps.

## Global Constraints

- **Ingredient shape is exactly `{ name: string, price: number≥0 }`** — no `emoji`, no `link`/url, anywhere (schema, seed, repo, forms, cards, calculator).
- **Shared catalog price:** a line's price is the ingredient's one shared price. Editing it edits the catalog everywhere. Attach/detach is batched into the drink's Save; ingredient **creation** and **price edits** persist immediately.
- **Base matcha/milk pills keep their 🍵 / 🥛 literals** (those are not ingredients). Only *add-on ingredient* emojis are removed.
- **No test framework in this repo** (no jest/vitest/RTL). Verification per task = `npm run build` (static-gen Zod parse catches a malformed seed) + `npm run lint`. The controller runs the authoritative build + a `/drinks` **and** `/calculator` runtime smoke at the end, in an **isolated detached git worktree at HEAD** (committed code only), so the teammate's uncommitted WIP can't confound it.
- **Entanglement:** `src/config/schemas.js` and `src/config/repo.js` currently contain a teammate's uncommitted expense-reorder WIP (a `date` field on expense rows; `addExpense(row, afterId)` + `reorderExpenses`). Edit ONLY the ingredient regions of those files (re-Read right before editing). `git add` only the exact files a task names — for `schemas.js`/`repo.js` this may bundle the teammate's WIP into the commit; that is a known, accepted risk (flag it, do not try to revert their lines).
- Reuse existing tokens/components (`TextField`, `NumberField` from `@/components/form`; `chip`, `ing-tile`, `field-box`, `bg-cream-light`, `text-clay`, etc.). No new hex.

### Interface contract (exact names/types)

- **`IngredientSchema`** (`schemas.js`): `z.object({ name: z.string(), price: z.number().nonnegative() })`. `extraIngredients` values become `{ price }`; `ingredientOverrides` values become `{ price? }` (both derive from `IngredientSchema` and update automatically).
- **`repo.addIngredient({ name, price })`** → writes `extraIngredients[name] = { price }`. **`repo.editIngredient(name, { price })`** → writes `{ price }` to `extraIngredients` (custom) or `ingredientOverrides` (seed). `repo.deleteIngredient` unchanged. **`actions.js` needs no change** (it forwards opaque objects).
- **`DrinksGrid`** exposes two catalog ops and passes them to `DrinkForm`:
  - `createIngredient(name, price)` — optimistic add to `catalog` + `addIngredient({name, price})`; no-op on empty/duplicate name.
  - `setIngredientPrice(name, price)` — optimistic price patch in `catalog` + `editIngredient(name, {price})`.
- **`DrinkForm` props:** `{ drink, isNew, existingNames, catalog, onSave, onClose, onCreateIngredient, onSetIngredientPrice }` where `onCreateIngredient = createIngredient`, `onSetIngredientPrice = setIngredientPrice`.
- Ingredient objects passed around are `{ name, price }` (+ `custom` from `repo.ingredients()`).

---

### Task 1: Ingredient model — schema + seed + repo

**Files:**
- Modify: `src/config/schemas.js` (`IngredientSchema` + comments) *(entangled)*
- Modify: `src/config/seed.js` (`ingredients` array)
- Modify: `src/config/repo.js` (`addIngredient`, `editIngredient`) *(entangled)*

**Interfaces:**
- Produces: the `IngredientSchema` + `repo.addIngredient/editIngredient` contract above. Consumed by Tasks 2–5.

- [ ] **Step 1: Shrink `IngredientSchema` in `src/config/schemas.js`**

Replace the whole `IngredientSchema` block (currently `{ name, emoji, price, link }`) with:
```js
// A priced, attachable add-on ingredient (strawberry, cream foam, …). Exactly two
// fields: name + a shared ₱/cup reference price (overridable in state). Matcha &
// milk are the dropdown selectors, not ingredients.
export const IngredientSchema = z.object({
  name: z.string(),
  price: z.number().nonnegative(), // market / reference ₱ per cup (shared)
});
```
Then update two trailing comments so they don't lie:
- On the `ingredients:` line in `SiteDataSchema`, change `// priced add-ons drinks attach (each carries its own link)` → `// priced add-ons drinks attach (name + ₱)`.
- On `extraIngredients`, change `// user-created: name -> { emoji, price, link }` → `// user-created: name -> { price }`.

(Do NOT touch the expense-row schema region — that is the teammate's `date` field.)

- [ ] **Step 2: Strip emoji/link from `src/config/seed.js`**

Replace the entire `ingredients: [ … ]` array (all 20 entries, currently each `{ name, emoji, price, link }`) with:
```js
  ingredients: [
    { name: "Strawberry compote", price: 14 },
    { name: "Salted cream foam", price: 15 },
    { name: "Soy + caramel", price: 5 },
    { name: "Pistachio", price: 34 },
    { name: "Sakura syrup", price: 36 },
    { name: "Calamansi + honey", price: 8 },
    { name: "Lychee", price: 28 },
    { name: "Horchata mix", price: 13 },
    { name: "Ube halaya", price: 10 },
    { name: "Pandan syrup", price: 3 },
    { name: "Young coconut", price: 6 },
    { name: "Silken tofu", price: 8 },
    { name: "Brown sugar syrup", price: 5 },
    { name: "Sago pearls", price: 4 },
    { name: "Espresso shot", price: 10 },
    { name: "Mascarpone cream", price: 25 },
    { name: "Cocoa dust", price: 2 },
    { name: "White chocolate", price: 12 },
    { name: "Yuzu", price: 12 },
    { name: "Blueberry compote", price: 5 },
  ],
```

- [ ] **Step 3: Update `addIngredient` + `editIngredient` in `src/config/repo.js`**

Replace the current `addIngredient` and `editIngredient` definitions with:
```js
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
```
(Leave `deleteIngredient`, the expense functions, and everything else untouched.)

- [ ] **Step 4: Verify build + lint**

Run: `npm run build`
Expected: `✓ Compiled successfully`, all routes generated (the static-gen Zod parse validates the new `IngredientSchema` against the new seed — a stray `emoji`/`link` or type error would fail here).
Run: `npm run lint`
Expected: no errors in the three files.

- [ ] **Step 5: Commit**

```bash
git add src/config/schemas.js src/config/seed.js src/config/repo.js
git commit -m "Ingredients: reduce model to {name, price} (drop emoji + link)"
```
(Note: `schemas.js`/`repo.js` may carry the teammate's uncommitted expense hunks — expected, per Global Constraints.)

---

### Task 2: `DrinksGrid` — simplify catalog + expose catalog ops

**Files:**
- Modify: `src/features/drinks/DrinksGrid.jsx` (full replacement below)

**Interfaces:**
- Consumes: `repo`/actions `addIngredient({name,price})`, `editIngredient(name,{price})` (Task 1).
- Produces: `createIngredient(name, price)` + `setIngredientPrice(name, price)`, passed to `DrinkForm` as `onCreateIngredient`/`onSetIngredientPrice` (Task 3 consumes these). Catalog tiles + creator bar are now name+price only.

- [ ] **Step 1: Replace `src/features/drinks/DrinksGrid.jsx` entirely**

```jsx
"use client";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  toggleDrink,
  attachIngredient,
  detachIngredient,
  addIngredient,
  toggleBase,
  saveDrink,
  deleteDrink,
  editIngredient,
  deleteIngredient,
} from "@/config/actions";
import DrinkCard from "@/features/drinks/DrinkCard";
import DrinkForm from "@/features/drinks/DrinkForm";
import IngredientForm from "@/features/drinks/IngredientForm";
import { TextField, NumberField } from "@/components/form";
import SectionTitle from "@/components/SectionTitle";

const GRID = "card-grid";
const SECTION = "mb-12 max-md:mb-9";
const EMPTY = { name: "", price: "" };
const BLANK_DRINK = {
  name: "",
  note: "",
  desc: "",
  srp: 150,
  ingredients: [],
  hasMatcha: true,
  hasMilk: true,
};

export default function DrinksGrid({ drinks, ingredients, initialSaved }) {
  const [saved, setSaved] = useState(initialSaved);
  const [list, setList] = useState(drinks); // full drink objects, updated optimistically
  const [catalog, setCatalog] = useState(ingredients);
  const [form, setForm] = useState(EMPTY); // the ingredient creator bar
  const [editing, setEditing] = useState(null); // { drink, isNew } for the drink form, or null
  const [ingMenu, setIngMenu] = useState(null); // ingredient right-click menu { x, y, ing } or null
  const [editingIng, setEditingIng] = useState(null); // ingredient object for the edit form, or null
  const [, startTransition] = useTransition();

  const toggle = (name) => {
    setSaved((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));
    startTransition(() => toggleDrink(name));
  };

  const patchDrink = (name, fn) => setList((l) => l.map((d) => (d.name === name ? fn(d) : d)));

  const attach = (name, ing) => {
    patchDrink(name, (d) => ({ ...d, ingredients: [...d.ingredients, ing] }));
    startTransition(() => attachIngredient(name, ing));
  };
  const detach = (name, ing) => {
    patchDrink(name, (d) => ({ ...d, ingredients: d.ingredients.filter((n) => n !== ing) }));
    startTransition(() => detachIngredient(name, ing));
  };
  const flipBase = (name, base) => {
    const key = base === "matcha" ? "hasMatcha" : "hasMilk";
    patchDrink(name, (d) => ({ ...d, [key]: !d[key] }));
    startTransition(() => toggleBase(name, base));
  };

  const persistDrink = (drink, isNew) => {
    setList((l) =>
      isNew
        ? [...l, { ...drink, images: [], custom: true }]
        : l.map((d) => (d.name === drink.name ? { ...d, ...drink } : d)),
    );
    startTransition(() => saveDrink(drink, isNew));
    setEditing(null);
  };
  const removeDrink = (name) => {
    setList((l) => l.filter((d) => d.name !== name));
    setSaved((s) => s.filter((n) => n !== name));
    startTransition(() => deleteDrink(name));
  };

  // shared catalog ops — used by the creator bar, the drink form, and the edit modal.
  const createIngredient = (name, price) => {
    const nm = String(name).trim();
    if (!nm || catalog.some((c) => c.name === nm)) return;
    const ing = { name: nm, price: Number(price) || 0 };
    setCatalog((c) => [...c, ing]);
    startTransition(() => addIngredient(ing));
  };
  const setIngredientPrice = (name, price) => {
    const patch = { price: Number(price) || 0 };
    setCatalog((c) => c.map((i) => (i.name === name ? { ...i, ...patch } : i)));
    startTransition(() => editIngredient(name, patch));
  };
  const removeIng = (name) => {
    setCatalog((c) => c.filter((i) => i.name !== name));
    startTransition(() => deleteIngredient(name));
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const create = () => {
    if (!form.name.trim()) return;
    createIngredient(form.name, form.price);
    setForm(EMPTY);
  };

  const savedSet = new Set(saved);
  const card = (d) => (
    <DrinkCard
      key={d.name}
      drink={d}
      saved={savedSet.has(d.name)}
      onToggleSave={() => toggle(d.name)}
      catalog={catalog}
      onAttach={(ing) => attach(d.name, ing)}
      onDetach={(ing) => detach(d.name, ing)}
      onToggleBase={(base) => flipBase(d.name, base)}
      onEdit={() => setEditing({ drink: d, isNew: false })}
      onDelete={d.custom ? () => removeDrink(d.name) : null}
    />
  );

  const selected = list.filter((d) => savedSet.has(d.name));
  const rest = list.filter((d) => !savedSet.has(d.name));

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-6 max-md:mb-4 flex-wrap">
        <p className="sec-sub !mt-0">Right-click any drink to edit it, or add a brand-new one →</p>
        <button
          type="button"
          onClick={() => setEditing({ drink: BLANK_DRINK, isNew: true })}
          className="chip chip--active normal-case tracking-normal shrink-0"
        >
          ＋ New drink
        </button>
      </div>

      {selected.length > 0 && (
        <section className={SECTION}>
          <SectionTitle icon="♥" title="Our Selection" meta={`${selected.length} saved`} />
          <div className={GRID}>{selected.map(card)}</div>
        </section>
      )}

      {rest.length > 0 && (
        <section className={SECTION}>
          <SectionTitle icon="🍵" title="More to Whisk" meta={`${rest.length} on the menu`} />
          <div className={GRID}>{rest.map(card)}</div>
        </section>
      )}

      <section className={SECTION}>
        <SectionTitle title="Ingredients" meta={`${catalog.length} add-ons`} />
        <p className="sec-sub mb-4 -mt-3">
          The shared add-on catalog · ₱ per cup. Attach any of these to a drink above; right-click a
          tile to edit its price or delete it.
        </p>

        <div className="flex flex-wrap gap-[9px] mb-5">
          {catalog.map((ing) => (
            <div
              key={ing.name}
              onContextMenu={(e) => {
                e.preventDefault();
                setIngMenu({ x: e.clientX, y: e.clientY, ing });
              }}
              title={`${ing.name} · ₱${ing.price}/cup — right-click to edit/delete`}
              className="ing-tile flex-row items-center gap-[9px] !py-2"
            >
              <span className="font-doodle font-bold text-[.92rem] text-forest leading-none">
                {ing.name}
              </span>
              <span className="font-mono text-[.7rem] text-clay leading-none">₱{ing.price}</span>
            </div>
          ))}
        </div>

        {/* compact creator bar — name · price · Add */}
        <div className="paper-card !static p-[14px]">
          <div className="flex items-baseline gap-2 mb-2.5">
            <span className="font-doodle font-bold text-[.98rem] text-forest leading-none">
              Add new ingredient
            </span>
            <span className="font-mono text-[.56rem] tracking-[.04em] text-brown-soft">
              name + ₱/cup
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TextField
              aria-label="Ingredient name"
              className="flex-1 min-w-[150px]"
              value={form.name}
              onChange={set("name")}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Name — e.g. Oat foam"
            />
            <NumberField
              aria-label="Price per cup"
              prefix="₱"
              className="shrink-0"
              inputClassName="!w-[110px]"
              min="0"
              step="0.5"
              value={form.price}
              onChange={set("price")}
              placeholder="0"
            />
            <button
              type="button"
              onClick={create}
              disabled={!form.name.trim()}
              className="chip chip--active normal-case tracking-normal shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {editing && (
        <DrinkForm
          drink={editing.drink}
          isNew={editing.isNew}
          existingNames={list.map((d) => d.name)}
          catalog={catalog}
          onSave={persistDrink}
          onClose={() => setEditing(null)}
          onCreateIngredient={createIngredient}
          onSetIngredientPrice={setIngredientPrice}
        />
      )}

      {ingMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              onClick={() => setIngMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setIngMenu(null);
              }}
              aria-hidden="true"
            />
            <div
              className="fixed z-[56] min-w-[150px] bg-cream-card border-2 border-forest rounded-[10px] shadow-hard-sm p-1"
              style={{ top: ingMenu.y, left: ingMenu.x }}
            >
              <button
                type="button"
                onClick={() => {
                  setEditingIng(ingMenu.ing);
                  setIngMenu(null);
                }}
                className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-forest hover:bg-cream-light transition"
              >
                ✎ Edit ingredient
              </button>
              <button
                type="button"
                onClick={() => {
                  removeIng(ingMenu.ing.name);
                  setIngMenu(null);
                }}
                className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-clay hover:bg-cream-light transition"
              >
                🗑 Delete ingredient
              </button>
            </div>
          </>,
          document.body,
        )}

      {editingIng && (
        <IngredientForm
          ingredient={editingIng}
          onSave={(patch) => {
            setIngredientPrice(editingIng.name, patch.price);
            setEditingIng(null);
          }}
          onClose={() => setEditingIng(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build` → `✓ Compiled successfully`. Run: `npm run lint` → clean for `DrinksGrid.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/drinks/DrinksGrid.jsx
git commit -m "Drinks: name+price catalog tiles/creator + shared catalog ops for the form"
```

---

### Task 3: `DrinkForm` — line-item ingredient editor

**Files:**
- Modify: `src/features/drinks/DrinkForm.jsx` (full replacement below)

**Interfaces:**
- Consumes: `onCreateIngredient(name, price)`, `onSetIngredientPrice(name, price)`, `catalog` (Task 2).
- Produces: the drink form's `onSave` payload is unchanged (`{ name, note, desc, srp, ingredients, hasMatcha, hasMilk }`).

- [ ] **Step 1: Replace `src/features/drinks/DrinkForm.jsx` entirely**

```jsx
"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TextField, NumberField } from "@/components/form";

// localStorage draft so an in-progress form survives closing/reopening. Keyed
// per form identity (the new-drink form, or a specific drink being edited).
const draftKey = (isNew, name) => (isNew ? "df:new" : `df:edit:${name}`);
const readDraft = (k) => {
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeDraft = (k, v) => {
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore unavailable storage */
  }
};
const clearDraft = (k) => {
  try {
    window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

// Add/edit a drink — one modal for both. Add-on ingredients are edited as line
// items (name + shared ₱ price): attach an existing one, or create a new one
// inline. WHICH ingredients are attached is batched into the drink's Save (the
// `ingredients` name array). Creating an ingredient and editing a price are
// catalog ops that persist immediately (shared across drinks, regardless of
// Save/Cancel).
export default function DrinkForm({
  drink,
  isNew,
  existingNames,
  catalog,
  onSave,
  onClose,
  onCreateIngredient,
  onSetIngredientPrice,
}) {
  const dkey = draftKey(isNew, drink.name);
  const [snap] = useState(() => ({ ...drink, ...(readDraft(dkey) ?? {}) }));
  const [name, setName] = useState(snap.name);
  const [note, setNote] = useState(snap.note);
  const [desc, setDesc] = useState(snap.desc);
  const [srp, setSrp] = useState(snap.srp);
  const [ingredients, setIngredients] = useState(snap.ingredients);
  const [hasMatcha, setHasMatcha] = useState(snap.hasMatcha);
  const [hasMilk, setHasMilk] = useState(snap.hasMilk);
  const [addOpen, setAddOpen] = useState(false); // "add existing" dropdown open
  const [adding, setAdding] = useState(false); // new-ingredient line shown
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // remember in-progress values (attached names + fields) so reopening keeps them;
  // the shared catalog isn't drafted here (it persists itself).
  useEffect(() => {
    writeDraft(dkey, { name, note, desc, srp, ingredients, hasMatcha, hasMilk });
  }, [dkey, name, note, desc, srp, ingredients, hasMatcha, hasMilk]);

  const trimmed = name.trim();
  const dup = isNew && existingNames.includes(trimmed);
  const valid = trimmed.length > 0 && !dup;

  const attach = (n) => setIngredients((arr) => (arr.includes(n) ? arr : [...arr, n]));
  const detach = (n) => setIngredients((arr) => arr.filter((x) => x !== n));
  const priceOf = (n) => catalog.find((i) => i.name === n)?.price ?? 0;
  const unattached = catalog.filter((i) => !ingredients.includes(i.name));

  const commitNew = () => {
    const nm = newName.trim();
    if (!nm) return;
    const p = Number(newPrice) || 0;
    if (!catalog.some((i) => i.name === nm)) onCreateIngredient(nm, p); // create in shared catalog
    attach(nm);
    setNewName("");
    setNewPrice("");
    setAdding(false);
  };

  const reset = () => {
    setName(drink.name);
    setNote(drink.note);
    setDesc(drink.desc);
    setSrp(drink.srp);
    setIngredients(drink.ingredients);
    setHasMatcha(drink.hasMatcha);
    setHasMilk(drink.hasMilk);
    setAddOpen(false);
    setAdding(false);
    setNewName("");
    setNewPrice("");
    clearDraft(dkey);
  };

  const submit = () => {
    if (!valid) return;
    clearDraft(dkey);
    onSave(
      {
        name: trimmed,
        note: note.trim(),
        desc: desc.trim(),
        srp: Number(srp) || 0,
        ingredients,
        hasMatcha,
        hasMilk,
      },
      isNew,
    );
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-forest/85 backdrop-blur-sm overflow-y-auto p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Add a new drink" : `Edit ${drink.name}`}
    >
      <div
        className="paper-card !static w-full max-w-[460px] mx-auto my-6 p-5 max-md:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-2 mb-4">
          <h3 className="font-doodle font-bold text-[1.4rem] text-forest leading-none">
            {isNew ? "Add a drink" : "Edit drink"}
          </h3>
          <span className="font-mono text-[.56rem] tracking-[.06em] uppercase text-brown-soft">
            synced to everyone
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <TextField
            label="Name"
            id="df-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hojicha Matcha Latte"
            disabled={!isNew}
            inputClassName={isNew ? "" : "opacity-60 cursor-not-allowed"}
          />
          {dup && (
            <p className="font-mono text-[.58rem] text-clay -mt-2">
              A drink named “{trimmed}” already exists.
            </p>
          )}
          <TextField
            label="Subtitle"
            id="df-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="short tagline — e.g. roasty & smooth"
          />
          <div>
            <label htmlFor="df-desc" className="field-label">
              Description
            </label>
            <textarea
              id="df-desc"
              className="field-box leading-relaxed"
              rows={4}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="a sentence or two about the drink & how it fits the market…"
            />
          </div>
          <NumberField
            label="SRP"
            id="df-srp"
            prefix="₱"
            min="0"
            step="5"
            value={srp}
            onChange={(e) => setSrp(e.target.value)}
          />
          <div className="flex gap-2">
            <Toggle on={hasMatcha} onClick={() => setHasMatcha((v) => !v)} label="🍵 Matcha" />
            <Toggle on={hasMilk} onClick={() => setHasMilk((v) => !v)} label="🥛 Milk" />
          </div>

          {/* add-on ingredients as line items (name + shared ₱ price) */}
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="field-label !mb-0">Add-on ingredients</span>
              <span className="font-mono text-[.5rem] tracking-[.04em] text-brown-soft">
                prices are shared across drinks
              </span>
            </div>

            <div className="flex flex-col gap-1.5 mt-1.5">
              {ingredients.map((nm) => (
                <IngredientLine
                  key={nm}
                  name={nm}
                  price={priceOf(nm)}
                  onPrice={(p) => onSetIngredientPrice(nm, p)}
                  onRemove={() => detach(nm)}
                />
              ))}
              {ingredients.length === 0 && (
                <p className="font-mono text-[.6rem] text-brown-soft">No add-ons yet.</p>
              )}
            </div>

            {adding && (
              <div className="flex items-center gap-2 mt-1.5">
                <TextField
                  aria-label="New ingredient name"
                  autoFocus
                  className="flex-1"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitNew();
                    else if (e.key === "Escape") {
                      e.stopPropagation();
                      setAdding(false);
                    }
                  }}
                  placeholder="Name — e.g. Oat foam"
                />
                <NumberField
                  aria-label="New ingredient price"
                  prefix="₱"
                  inputClassName="!w-[86px]"
                  min="0"
                  step="0.5"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitNew()}
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={commitNew}
                  disabled={!newName.trim()}
                  aria-label="Add ingredient"
                  className="chip chip--active !px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✓
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              {!adding && (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(true);
                    setAddOpen(false);
                  }}
                  className="font-mono text-[.58rem] uppercase tracking-[.06em] text-olive bg-cream-card border-2 border-dashed border-olive rounded-pill px-[10px] py-[4px] hover:border-forest hover:text-forest transition"
                >
                  ＋ New ingredient
                </button>
              )}
              {unattached.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAddOpen((o) => !o)}
                  aria-expanded={addOpen}
                  className="font-mono text-[.58rem] uppercase tracking-[.06em] text-olive bg-cream-card border-2 border-dashed border-olive rounded-pill px-[10px] py-[4px] hover:border-forest hover:text-forest transition"
                >
                  Add existing ▾
                </button>
              )}
            </div>

            {addOpen && unattached.length > 0 && (
              <div className="mt-1.5 border-2 border-forest rounded-[11px] bg-cream-card p-1 max-h-[200px] overflow-auto flex flex-col gap-[3px]">
                {unattached.map((ing) => (
                  <button
                    key={ing.name}
                    type="button"
                    onClick={() => {
                      attach(ing.name);
                      setAddOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-forest hover:bg-cream-light transition flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{ing.name}</span>
                    <span className="text-clay shrink-0">₱{ing.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          <button
            type="button"
            onClick={reset}
            className="chip normal-case tracking-normal !text-clay"
          >
            ↺ Reset
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="chip normal-case tracking-normal">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!valid}
              className="chip chip--active normal-case tracking-normal disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isNew ? "Add drink" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// One attached ingredient: name + editable shared ₱ price (commits on blur /
// Enter) + remove. The price field keeps a local draft so typing is smooth; it
// commits the shared catalog price only when it actually changed.
function IngredientLine({ name, price, onPrice, onRemove }) {
  const [val, setVal] = useState(String(price));
  useEffect(() => setVal(String(price)), [price]);
  const commit = () => {
    const p = Number(val) || 0;
    if (p !== price) onPrice(p);
  };
  return (
    <div className="flex items-center gap-2 border-2 border-brown-soft/30 rounded-[10px] bg-cream-light px-2.5 py-1.5">
      <span className="flex-1 min-w-0 truncate font-doodle text-[.92rem] text-forest">{name}</span>
      <NumberField
        aria-label={"Price of " + name}
        prefix="₱"
        inputClassName="!w-[84px]"
        min="0"
        step="0.5"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      <button
        type="button"
        aria-label={"Remove " + name}
        onClick={onRemove}
        className="text-clay hover:text-forest leading-none px-1"
      >
        ✕
      </button>
    </div>
  );
}

function Toggle({ on, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex-1 font-mono text-[.62rem] uppercase tracking-[.06em] border-2 rounded-[10px] py-2 transition ${
        on
          ? "bg-matcha-fill border-olive text-forest"
          : "bg-cream-light border-brown-soft/40 text-brown-soft"
      }`}
    >
      {on ? "✓ " : "✕ "}
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build` → `✓ Compiled successfully`. Run: `npm run lint` → clean for `DrinkForm.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/drinks/DrinkForm.jsx
git commit -m "Drinks: line-item ingredient editor in the drink modal"
```

---

### Task 4: `IngredientForm` — name + price only

**Files:**
- Modify: `src/features/drinks/IngredientForm.jsx` (full replacement below)

**Interfaces:**
- Consumes: `onSave({ price })` (wired in Task 2's `DrinksGrid`).

- [ ] **Step 1: Replace `src/features/drinks/IngredientForm.jsx` entirely**

```jsx
"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TextField, NumberField } from "@/components/form";

// Edit an add-on ingredient — the name is the catalog key (read-only); only the
// shared ₱ price is editable.
export default function IngredientForm({ ingredient, onSave, onClose }) {
  const [price, setPrice] = useState(ingredient.price);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => onSave({ price: Number(price) || 0 });

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-forest/85 backdrop-blur-sm overflow-y-auto p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${ingredient.name}`}
    >
      <div
        className="paper-card !static w-full max-w-[460px] mx-auto my-6 p-5 max-md:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-2 mb-4">
          <h3 className="font-doodle font-bold text-[1.4rem] text-forest leading-none">
            Edit ingredient
          </h3>
          <span className="font-mono text-[.56rem] tracking-[.06em] uppercase text-brown-soft">
            synced to everyone
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <TextField
            label="Name"
            id="if-name"
            value={ingredient.name}
            disabled
            inputClassName="opacity-60 cursor-not-allowed"
          />
          <NumberField
            label="Price"
            id="if-price"
            prefix="₱"
            min="0"
            step="0.5"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="chip normal-case tracking-normal">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="chip chip--active normal-case tracking-normal"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build` → `✓ Compiled successfully`. Run: `npm run lint` → clean for `IngredientForm.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/drinks/IngredientForm.jsx
git commit -m "Drinks: IngredientForm edits price only (name read-only)"
```

---

### Task 5: Drop emoji/link from `DrinkCard` + `Calculator`

**Files:**
- Modify: `src/features/drinks/DrinkCard.jsx`
- Modify: `src/features/calculator/Calculator.jsx`

**Interfaces:** none new (display cleanup).

- [ ] **Step 1: `DrinkCard.jsx` — remove the add-on emoji (keep base 🍵/🥛)**

Make the add-on `Pill` render cleanly without an emoji while base pills keep theirs. Edit the `Pill` component's label line — change:
```jsx
      {emoji} {label}
```
to:
```jsx
      {emoji ? emoji + " " : ""}{label}
```
Then remove the `emojiOf` helper line:
```jsx
  const emojiOf = (name) => catalog.find((i) => i.name === name)?.emoji ?? "";
```
In the `addItems` array, change the unattached add-on label from:
```jsx
      label: `${i.emoji} ${i.name} — ₱${i.price}`,
```
to:
```jsx
      label: `${i.name} — ₱${i.price}`,
```
And in the attached-pills render, change:
```jsx
          <Pill key={name} emoji={emojiOf(name)} label={name} onRemove={() => onDetach(name)} />
```
to:
```jsx
          <Pill key={name} label={name} onRemove={() => onDetach(name)} />
```
(The base pills at `<Pill emoji="🍵" …>` / `<Pill emoji="🥛" …>` are unchanged.)

- [ ] **Step 2: `Calculator.jsx` — remove `emojiOf`/`linkOf` and the reference-link row**

Delete these two lines (currently ~77–78):
```jsx
  const linkOf = Object.fromEntries(ingredients.map((i) => [i.name, i.link]));
  const emojiOf = Object.fromEntries(ingredients.map((i) => [i.name, i.emoji]));
```
In the `<PriceRow>` for `usedIngredients` (~line 241), change `label={`${emojiOf[nm]} ${nm}`}` to `label={nm}`, and delete the `link={linkOf[nm]}` prop line (~248).
In the per-ingredient totals breakdown (~line 420), change `{emojiOf[nm]} {nm}` to `{nm}`.
In the `PriceRow` component definition, drop the now-unused `link` param and its render block: change the signature `function PriceRow({ label, unit, refVal, okey, ov, editOv, commitOv, link }) {` to `function PriceRow({ label, unit, refVal, okey, ov, editOv, commitOv }) {`, and delete the trailing block:
```jsx
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener"
          className="font-mono text-[.5rem] tracking-[.04em] uppercase text-clay underline underline-offset-2 mt-0.5"
        >
          reference ↗
        </a>
      )}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build` → `✓ Compiled successfully`. Run: `npm run lint` → clean (no unused `emojiOf`/`linkOf`/`link`).

- [ ] **Step 4: Commit**

```bash
git add src/features/drinks/DrinkCard.jsx src/features/calculator/Calculator.jsx
git commit -m "Drinks/calculator: drop ingredient emoji + reference link from display"
```

---

### Task 6: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (the drinks↔ingredients data-model bullet)

**Interfaces:** none (docs).

- [ ] **Step 1: Update the ingredient-model sentence in `CLAUDE.md`**

Find the bullet beginning **`- **Drinks ↔ ingredients data model.**`**. Replace its first sentence — currently:
> `ingredients` (seed) are **first-class priced add-ons**, each a self-contained object `{ name, emoji, price, link }` (`price` = ₱/cup reference; `link` = a reference URL or `null`; partial-fill on create is fine). There is **no separate `sources` list** — every reference link lives on its ingredient.

with:
> `ingredients` (seed) are **first-class priced add-ons**, each exactly `{ name, price }` (`price` = shared ₱/cup reference; no emoji, no link). In the drink modal they're edited as **line items** (name + shared price) — attach existing or create-new; editing a line's price edits the shared catalog ingredient (persists immediately), while *which* ingredients are attached is batched into the drink's Save.

Then, in the same bullet's `IngredientForm.jsx` mention, adjust "full CRUD (create/edit/delete via `IngredientForm.jsx`)" note if it references emoji/link (it should now read name+price). Leave the rest of the bullet (drinks shape, bases, drinkImages) intact.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Docs: CLAUDE.md — ingredients are {name, price}, line-item drink editor"
```

---

## Final verification (controller, after all tasks)

- [ ] `npm run lint` → clean.
- [ ] Authoritative build + smoke in an **isolated detached worktree at HEAD** (committed code only, `node_modules` symlinked, `.env.local` copied): `npm run build` = `✓ Compiled successfully` (all 12 routes; `/drinks` + `/calculator` are `ƒ`), then a runtime smoke of **`/drinks`** and **`/calculator`** = HTTP 200 with expected markup (both read the ingredient catalog; this exercises the state-side migration — any stale `emoji`/`link` in Redis `extraIngredients`/`ingredientOverrides` is stripped by the new schema on read).
- [ ] **Interactive dev check** (human runs `npm run dev`): open a drink → add an existing ingredient (line appears with its ₱), create a new ingredient inline (appears in the drink + the catalog), edit a line's price and confirm it changes the catalog tile + the calculator's ref price, remove a line, Save; then in the standalone catalog create/edit-price/delete an ingredient; confirm existing drinks still render their attached ingredients and the calculator totals are unchanged in math.

## Self-review notes

- **Spec coverage:** `{name, price}` model (Task 1) · seed stripped (Task 1) · repo add/edit (Task 1) · line-item editor with new/add-existing (Task 3) · shared-price semantics (Tasks 2+3) · standalone catalog + IngredientForm simplified (Tasks 2+4) · DrinkCard/Calculator emoji-link drop (Task 5) · CLAUDE.md (Task 6). All spec sections map to a task.
- **Type consistency:** `createIngredient(name, price)`/`setIngredientPrice(name, price)` defined in Task 2 are consumed as `onCreateIngredient`/`onSetIngredientPrice` in Task 3; `editIngredient(name, {price})` matches across Tasks 1/2; ingredient objects are `{name, price}` everywhere.
- **Build stays green each task:** removing schema fields never breaks compilation (property accesses to a dropped field read `undefined`); the emoji/link *display* references are all removed by Task 5, and the final smoke runs only after that — so no "undefined" text ships.
- **Entanglement:** only `schemas.js`/`repo.js` overlap the teammate's WIP; edits are confined to ingredient regions; commits of those files may bundle their hunks (flagged, accepted).
