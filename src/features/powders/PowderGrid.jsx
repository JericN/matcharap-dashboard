"use client";
import { useState, useTransition } from "react";
import { toggleSaved } from "@/config/actions";
import PowderCard from "@/features/powders/PowderCard";

const GRID = "grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]";

export default function PowderGrid({ powders, images, initialSaved }) {
  const [f, setF] = useState("all");
  const [saved, setSaved] = useState(initialSaved); // shared state, seeded from Edge Config
  const [, startTransition] = useTransition();

  const savedSet = new Set(saved);
  const toggle = (name) => {
    setSaved((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name])); // optimistic
    startTransition(() => toggleSaved(name)); // persist to the centralized store
  };

  const card = (p) => (
    <PowderCard
      key={p.name}
      powder={p}
      img={images[p.name]}
      saved={savedSet.has(p.name)}
      onToggleSave={() => toggle(p.name)}
    />
  );

  const selected = powders.filter((p) => savedSet.has(p.name));
  const rest = powders.filter((p) => !savedSet.has(p.name));
  const shown = rest.filter((p) => f === "all" || p.cat === f);

  return (
    <>
      {selected.length > 0 && (
        <section className="mb-9">
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="font-doodle font-bold text-[1.2rem] text-forest">♥ Our selection</h3>
            <span className="font-mono text-[.6rem] tracking-[.08em] uppercase text-brown-soft">{selected.length} saved</span>
          </div>
          <div className={GRID}>{selected.map(card)}</div>
          <hr className="rule" />
        </section>
      )}

      <div className="chiprow flex flex-wrap gap-[9px] mb-[22px]">
        <button className={"chip" + (f === "all" ? " chip--active" : "")} onClick={() => setF("all")}>All</button>
        <button className={"chip" + (f === "ph" ? " chip--active" : "")} onClick={() => setF("ph")}>🇵🇭 PH Homegrown</button>
        <button className={"chip" + (f === "jp" ? " chip--active" : "")} onClick={() => setF("jp")}>🇯🇵 Japanese · in PH</button>
        <button className={"chip" + (f === "import" ? " chip--active" : "")} onClick={() => setF("import")}>🌏 Imported</button>
      </div>
      <div className={GRID}>{shown.map(card)}</div>
    </>
  );
}
