"use client";
import { useState, useTransition } from "react";
import { togglePowder, savePowder } from "@/config/actions";
import PowderCard from "@/features/powders/PowderCard";
import PriceSizeForm from "@/components/PriceSizeForm";
import SectionTitle from "@/components/SectionTitle";

const GRID = "card-grid";
const SECTION = "mb-12 max-md:mb-9";
const CATS = [
  ["all", "All"],
  ["ph", "🇵🇭 PH Homegrown"],
  ["jp", "🇯🇵 Japanese · in PH"],
  ["import", "🌏 Imported"],
];

export default function PowderGrid({ powders, images, initialSaved }) {
  const [cat, setCat] = useState("all");
  const [saved, setSaved] = useState(initialSaved); // shared state, seeded from the server
  const [edits, setEdits] = useState({}); // optimistic price/grams edits: name -> { price, grams }
  const [editing, setEditing] = useState(null); // the powder being edited
  const [, startTransition] = useTransition();

  const savedSet = new Set(saved);
  const toggle = (name) => {
    setSaved((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));
    startTransition(() => togglePowder(name));
  };

  const eff = (p) => (edits[p.name] ? { ...p, ...edits[p.name] } : p);

  const persistEdit = (patch) => {
    const name = editing.name;
    setEdits((m) => ({ ...m, [name]: patch }));
    setEditing(null);
    startTransition(() => savePowder(name, patch));
  };

  const card = (p0) => {
    const p = eff(p0);
    return (
      <PowderCard
        key={p.name}
        powder={p}
        img={images[p.name]}
        saved={savedSet.has(p.name)}
        onToggleSave={() => toggle(p.name)}
        onEdit={() => setEditing(p)}
      />
    );
  };

  const selected = powders.filter((p) => savedSet.has(p.name));
  const rest = powders.filter((p) => !savedSet.has(p.name));
  const shown = rest.filter((p) => cat === "all" || p.cat === cat);

  return (
    <>
      {selected.length > 0 && (
        <section className={SECTION}>
          <SectionTitle icon="♥" title="Our Selection" meta={`${selected.length} saved`} />
          <div className={GRID}>{selected.map(card)}</div>
        </section>
      )}

      <section className={SECTION}>
        <SectionTitle icon="🍃" title="The Whole Shelf" meta={`${rest.length} powders`} />
        <div className="flex flex-wrap gap-[9px] mb-[22px]">
          {CATS.map(([k, label]) => (
            <button
              key={k}
              className={"chip" + (cat === k ? " chip--active" : "")}
              onClick={() => setCat(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={GRID}>{shown.map(card)}</div>
      </section>

      {editing && (
        <PriceSizeForm
          kind="powder"
          item={editing}
          onSave={persistEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
