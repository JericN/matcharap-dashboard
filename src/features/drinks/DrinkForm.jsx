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
              A drink named ““{trimmed}”“ already exists.
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
