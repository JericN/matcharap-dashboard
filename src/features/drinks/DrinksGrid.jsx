"use client";
import { useState, useTransition } from "react";
import {
  toggleDrink,
  attachIngredient,
  detachIngredient,
  addIngredient,
  toggleBase,
  saveDrink,
  deleteDrink,
} from "@/config/actions";
import DrinkCard from "@/features/drinks/DrinkCard";
import DrinkForm from "@/features/drinks/DrinkForm";
import { TextField, NumberField } from "@/components/form";
import SectionTitle from "@/components/SectionTitle";

const GRID = "card-grid";
const SECTION = "mb-12 max-md:mb-9";
const EMPTY = { name: "", emoji: "", price: "", link: "" };
const BLANK_DRINK = {
  name: "",
  note: "",
  desc: "",
  milkMl: 180,
  srp: 150,
  ingredients: [],
  hasMatcha: true,
  hasMilk: true,
};
const isUrl = (s) => {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
};

export default function DrinksGrid({ drinks, ingredients, initialSaved }) {
  const [saved, setSaved] = useState(initialSaved);
  const [list, setList] = useState(drinks); // full drink objects, updated optimistically
  const [catalog, setCatalog] = useState(ingredients);
  const [form, setForm] = useState(EMPTY); // the ingredient creator bar
  const [editing, setEditing] = useState(null); // { drink, isNew } for the drink form, or null
  const [, startTransition] = useTransition();

  const toggle = (name) => {
    setSaved((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));
    startTransition(() => toggleDrink(name));
  };

  const patchDrink = (name, fn) => setList((l) => l.map((d) => (d.name === name ? fn(d) : d)));

  // attach/detach send a single-ingredient delta; the server merges it into the
  // fresh list (concurrent edits survive). Local state mirrors optimistically.
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

  // add a new drink or save edits to an existing one — both via the same form
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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const create = () => {
    const ing = {
      name: form.name.trim(),
      emoji: form.emoji.trim(),
      price: Number(form.price) || 0,
      link: form.link.trim() || null,
    };
    if (!ing.name || (ing.link && !isUrl(ing.link)) || catalog.some((c) => c.name === ing.name))
      return;
    setCatalog((c) => [...c, ing]);
    startTransition(() => addIngredient(ing));
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
          The shared add-on catalog · ₱ per cup. Attach any of these to a drink above; ones with a ↗
          are clickable — hover for detail, click to open the reference.
        </p>

        <div className="flex flex-wrap gap-[9px] mb-5">
          {catalog.map((ing) => {
            const inner = (
              <>
                <span className="text-[1.05rem] leading-none">{ing.emoji}</span>
                <span className="font-doodle font-bold text-[.92rem] text-forest leading-none">
                  {ing.name}
                </span>
                <span className="font-mono text-[.7rem] text-clay leading-none">₱{ing.price}</span>
                {ing.link && (
                  <span className="text-[.95rem] text-olive leading-none" aria-hidden="true">
                    ↗
                  </span>
                )}
              </>
            );
            return ing.link ? (
              <a
                key={ing.name}
                href={ing.link}
                target="_blank"
                rel="noopener"
                title={`${ing.emoji} ${ing.name} · ₱${ing.price}/cup — open reference ↗`}
                aria-label={`${ing.name}, ₱${ing.price} per cup — open reference`}
                className="ing-tile flex-row items-center gap-[9px] !py-2 no-underline cursor-pointer transition hover:border-forest hover:-translate-y-0.5"
              >
                {inner}
              </a>
            ) : (
              <div
                key={ing.name}
                title={`${ing.emoji} ${ing.name} · ₱${ing.price}/cup — no reference link yet`}
                className="ing-tile flex-row items-center gap-[9px] !py-2"
              >
                {inner}
              </div>
            );
          })}
        </div>

        {/* compact creator bar — emoji · name · URL · price · Add */}
        <div className="paper-card !static p-[14px]">
          <div className="flex items-baseline gap-2 mb-2.5">
            <span className="font-doodle font-bold text-[.98rem] text-forest leading-none">
              Add new ingredients
            </span>
            <span className="font-mono text-[.56rem] tracking-[.04em] text-brown-soft">
              emoji + name + link + ₱/cup · all optional but the name
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TextField
              aria-label="Emoji"
              className="shrink-0"
              inputClassName="text-center !w-[54px]"
              value={form.emoji}
              onChange={set("emoji")}
              placeholder="🥥"
            />
            <TextField
              aria-label="Ingredient name"
              className="flex-1 min-w-[150px]"
              value={form.name}
              onChange={set("name")}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Name — e.g. Oat foam"
            />
            <TextField
              aria-label="Reference link"
              type="url"
              className="flex-1 min-w-[170px]"
              value={form.link}
              onChange={set("link")}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="https://… reference (optional)"
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
        />
      )}
    </>
  );
}
