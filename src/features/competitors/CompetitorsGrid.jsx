"use client";
import { useState } from "react";
import CompetitorCard from "@/features/competitors/CompetitorCard";

const GRID = "grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]";
const REGIONS = [
  { k: "all", label: "All areas" },
  { k: "north", label: "🧭 North · QC·Caloocan·Marikina" },
  { k: "central", label: "🏙 Central · Makati·BGC" },
  { k: "south", label: "🌴 South · Las Piñas·Parañaque" },
];
const BANDS = [
  { k: "all", label: "Any price" },
  { k: "budget", label: "₱ Budget" },
  { k: "mid", label: "₱₱ Mid" },
  { k: "premium", label: "₱₱₱ Premium" },
];

export default function CompetitorsGrid({ competitors }) {
  const [region, setRegion] = useState("all");
  const [band, setBand] = useState("all");
  const shown = competitors.filter(
    (c) => (region === "all" || c.region === region) && (band === "all" || c.band === band)
  );

  const chips = (items, val, set) =>
    items.map((x) => (
      <button
        key={x.k}
        className={"chip" + (val === x.k ? " chip--active" : "")}
        onClick={() => set(x.k)}
      >
        {x.label}
      </button>
    ));

  return (
    <>
      <div className="flex flex-col gap-[10px] mb-3">
        <div className="chiprow flex flex-wrap gap-[9px]">{chips(REGIONS, region, setRegion)}</div>
        <div className="chiprow flex flex-wrap gap-[9px]">{chips(BANDS, band, setBand)}</div>
      </div>
      <div className="font-mono text-[.6rem] tracking-[.08em] uppercase text-brown-soft mb-[18px]">
        showing {shown.length} of {competitors.length}
      </div>
      <div className={GRID}>
        {shown.length ? (
          shown.map((c) => <CompetitorCard key={c.name} c={c} />)
        ) : (
          <p className="font-body text-olive-soft">No competitors match these filters.</p>
        )}
      </div>
    </>
  );
}
