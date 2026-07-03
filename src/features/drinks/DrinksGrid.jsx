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
