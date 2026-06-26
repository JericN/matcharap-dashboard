"use client";
import { useState, useTransition } from "react";
import { toggleMilk, saveMilk } from "@/config/actions";
import MilkCard from "@/features/milks/MilkCard";
import PriceSizeForm from "@/components/PriceSizeForm";
import SectionTitle from "@/components/SectionTitle";

const GRID = "card-grid";
const SECTION = "mb-12 max-md:mb-9";
// the 4 research buckets, rendered top→bottom as their own sections (tiers ARE the cut)
const BUCKETS = [
  ["ph", "🇵🇭 PH-made / available"],
  ["import", "🌏 Imported barista milks"],
  ["authentic", "🍵 Authentic-matcha pairing"],
  ["unique", "✨ Unique / specialty"],
];

export default function MilkGrid({ milks, images, initialSaved }) {
  const [saved, setSaved] = useState(initialSaved); // shared state, seeded from the server
  const [edits, setEdits] = useState({}); // optimistic price/liters edits: name -> { price, liters }
  const [editing, setEditing] = useState(null); // the milk being edited
  const [, startTransition] = useTransition();

  const savedSet = new Set(saved);
  const toggle = (name) => {
    setSaved((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));
    startTransition(() => toggleMilk(name));
  };

  const eff = (m) => (edits[m.name] ? { ...m, ...edits[m.name] } : m);

  const persistEdit = (patch) => {
    const name = editing.name;
    setEdits((o) => ({ ...o, [name]: patch }));
    setEditing(null);
    startTransition(() => saveMilk(name, patch));
  };

  const card = (m0) => {
    const m = eff(m0);
    return (
      <MilkCard
        key={m.name}
        milk={m}
        img={images[m.name]}
        saved={savedSet.has(m.name)}
        onToggleSave={() => toggle(m.name)}
        onEdit={() => setEditing(m)}
      />
    );
  };

  // hearted milks (in heart order) lift into "Our Selection"; the rest stay in their bucket
  const selected = saved.map((n) => milks.find((m) => m.name === n)).filter(Boolean);
  const rest = milks.filter((m) => !savedSet.has(m.name));

  return (
    <>
      {selected.length > 0 && (
        <section className={SECTION}>
          <SectionTitle icon="♥" title="Our Selection" meta={`${selected.length} saved`} />
          <div className={GRID}>{selected.map(card)}</div>
        </section>
      )}

      {BUCKETS.map(([k, label]) => {
        const items = rest.filter((m) => m.cat === k);
        if (items.length === 0) return null;
        return (
          <section key={k} className={SECTION}>
            <SectionTitle title={label} meta={`${items.length} milks`} />
            <div className={GRID}>{items.map(card)}</div>
          </section>
        );
      })}

      {editing && (
        <PriceSizeForm
          kind="milk"
          item={editing}
          onSave={persistEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
