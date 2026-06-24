"use client";
import { useState } from "react";
import CompetitorCard from "@/features/competitors/CompetitorCard";

const GRID = "grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]";
const FILTERS = [
  { k: "all", label: "All 10" },
  { k: "north", label: "🧭 North · QC·Caloocan·Marikina" },
  { k: "central", label: "🏙 Central · Makati·BGC" },
  { k: "south", label: "🌴 South · Las Piñas·Parañaque" },
];

export default function CompetitorsGrid({ competitors }) {
  const [f, setF] = useState("all");
  const shown = competitors.filter((c) => f === "all" || c.region === f);

  return (
    <>
      <div className="chiprow flex flex-wrap gap-[9px] mb-[22px]">
        {FILTERS.map((x) => (
          <button
            key={x.k}
            className={"chip" + (f === x.k ? " chip--active" : "")}
            onClick={() => setF(x.k)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className={GRID}>
        {shown.map((c) => (
          <CompetitorCard key={c.name} c={c} />
        ))}
      </div>
    </>
  );
}
