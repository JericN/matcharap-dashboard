"use client";
import { useState } from "react";
import PowderCard from "@/features/powders/PowderCard";

export default function PowderGrid({ powders, images }) {
  const [f, setF] = useState("all");

  return (
    <>
      <div className="chiprow flex flex-wrap gap-[9px] mb-[22px]">
        <button className={"chip" + (f === "all" ? " chip--active" : "")} onClick={() => setF("all")}>All</button>
        <button className={"chip" + (f === "ph" ? " chip--active" : "")} onClick={() => setF("ph")}>🇵🇭 PH Homegrown</button>
        <button className={"chip" + (f === "jp" ? " chip--active" : "")} onClick={() => setF("jp")}>🇯🇵 Japanese · in PH</button>
        <button className={"chip" + (f === "import" ? " chip--active" : "")} onClick={() => setF("import")}>🌏 Imported</button>
      </div>
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {powders.filter((p) => f === "all" || p.cat === f).map((p) => (
          <PowderCard key={p.name} powder={p} img={images[p.name]} />
        ))}
      </div>
    </>
  );
}
