"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TextField, NumberField } from "@/components/form";

// Add/edit a drink — one modal form for both. On a new drink the name is the
// key (must be unique); on edit it's read-only (renaming would orphan overlays).
export default function DrinkForm({ drink, isNew, existingNames, catalog, onSave, onClose }) {
  const [name, setName] = useState(drink.name);
  const [note, setNote] = useState(drink.note);
  const [desc, setDesc] = useState(drink.desc);
  const [milkMl, setMilkMl] = useState(drink.milkMl);
  const [srp, setSrp] = useState(drink.srp);
  const [ingredients, setIngredients] = useState(drink.ingredients);
  const [hasMatcha, setHasMatcha] = useState(drink.hasMatcha);
  const [hasMilk, setHasMilk] = useState(drink.hasMilk);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmed = name.trim();
  const dup = isNew && existingNames.includes(trimmed);
  const valid = trimmed.length > 0 && !dup;

  const toggleIng = (n) =>
    setIngredients((arr) => (arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n]));

  const submit = () => {
    if (!valid) return;
    onSave(
      {
        name: trimmed,
        note: note.trim(),
        desc: desc.trim(),
        milkMl: Number(milkMl) || 0,
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
          <div className="flex gap-3">
            <NumberField
              label="🥛 Milk (ml)"
              id="df-milk"
              className="flex-1"
              inputClassName="text-center"
              min="0"
              step="10"
              value={milkMl}
              onChange={(e) => setMilkMl(e.target.value)}
            />
            <NumberField
              label="SRP"
              id="df-srp"
              prefix="₱"
              className="flex-1"
              min="0"
              step="5"
              value={srp}
              onChange={(e) => setSrp(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Toggle on={hasMatcha} onClick={() => setHasMatcha((v) => !v)} label="🍵 Matcha" />
            <Toggle on={hasMilk} onClick={() => setHasMilk((v) => !v)} label="🥛 Milk" />
          </div>
          <div>
            <span className="field-label">Add-on ingredients</span>
            <div className="flex flex-wrap gap-[6px]">
              {catalog.map((ing) => {
                const on = ingredients.includes(ing.name);
                return (
                  <button
                    key={ing.name}
                    type="button"
                    onClick={() => toggleIng(ing.name)}
                    aria-pressed={on}
                    className={`font-mono text-[.58rem] uppercase tracking-[.04em] border-2 rounded-pill px-[9px] py-[4px] transition ${
                      on
                        ? "bg-matcha-fill border-olive text-forest"
                        : "bg-cream-light border-brown-soft/40 text-brown-soft hover:border-forest"
                    }`}
                  >
                    {ing.emoji} {ing.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
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
    </div>,
    document.body,
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
