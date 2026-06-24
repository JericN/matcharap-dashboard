"use client";
import { useState, useTransition } from "react";
import { setSrp as setSrpAction, resetSrp as resetSrpAction } from "@/config/actions";
import { matchaCostPerCup, milkCostPerCup, cogsForDrink, profit, marginPct, marginWord, batchPlan } from "@/features/calculator/cost";

const CAT_EMOJI = { ph: "🇵🇭", jp: "🇯🇵", import: "🌏" };
const peso = (n) => "₱" + Math.round(n).toLocaleString("en-US");

export default function Calculator({ matchaOptions, milkOptions, drinks, ingredients, extras, initialSrp }) {
  // default to the matcha nearest ₱20/g (a typical latte grade)
  const [mi, setMi] = useState(() => {
    let best = 0, bd = Infinity;
    matchaOptions.forEach((o, i) => { const d = Math.abs(o.g - 20); if (d < bd) { bd = d; best = i; } });
    return best;
  });
  const [ki, setKi] = useState(1);
  const [dose, setDose] = useState(3);
  const [cups, setCups] = useState(50);

  // Shared selling prices (one centralized record, seeded from Edge Config;
  // config holds the defaults). Edit optimistically, persist on blur.
  const [srpMap, setSrpMap] = useState(initialSrp);
  const [, startTransition] = useTransition();
  const srpFor = (d) => (d.name in srpMap ? srpMap[d.name] : d.srp);
  const editSrp = (name, v) => setSrpMap((m) => ({ ...m, [name]: v }));
  const commitSrp = (name) => startTransition(() => setSrpAction(name, srpMap[name] ?? 0));
  const resetPrices = () => {
    setSrpMap({});
    startTransition(() => resetSrpAction());
  };

  const sel = matchaOptions[mi];
  const pricePerGram = sel.g;
  const milkPricePerMl = milkOptions[ki].ml;
  const mCost = matchaCostPerCup(pricePerGram, dose);
  const cupsPerTin = sel.packG ? Math.floor(sel.packG / dose) : null;
  const batch = batchPlan({ cups, doseGrams: dose, pricePerGram, packG: sel.packG, milkPricePerMl, milkMl: 180, extras });

  return (
    <>
      <div className="bg-kraft border-[2.2px] border-forest rounded-card shadow-hard-sm px-5 py-[18px] mb-1.5 max-md:p-[14px]">
        <div className="flex gap-[18px] flex-wrap max-md:gap-3">
          <div className="flex-1 min-w-[220px] max-md:min-w-0 max-md:basis-full">
            <label className="field-label">🍵 Matcha powder</label>
            <select className="field-select" value={mi} onChange={(e) => setMi(+e.target.value)}>
              {matchaOptions.map((o, i) => (
                <option key={i} value={i}>{(CAT_EMOJI[o.cat] || "") + " "}{o.l} — ₱{o.g.toFixed(2)}/g</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[220px] max-md:min-w-0 max-md:basis-full">
            <label className="field-label">🥛 Milk</label>
            <select className="field-select" value={ki} onChange={(e) => setKi(+e.target.value)}>
              {milkOptions.map((o, i) => (
                <option key={i} value={i}>{o.l}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[220px] max-md:min-w-0 max-md:basis-full">
            <label className="field-label">⚖️ Matcha dose / cup <span className="float-right text-olive tracking-[.04em] normal-case">{dose} g</span></label>
            <input className="range-input" type="range" min="1.5" max="6" step="0.5" value={dose} onChange={(e) => setDose(+e.target.value)} />
          </div>
        </div>
        <div className="mt-3.5 font-mono text-[.72rem] tracking-[.02em] text-forest bg-cream-card border-2 border-dashed border-olive rounded-xl px-3.5 py-2.5 text-center">🍵 Matcha <b className="text-clay">₱{mCost}</b>/cup ({dose}g × ₱{pricePerGram.toFixed(2)}/g) &nbsp;·&nbsp; 🥛 Milk <b className="text-clay">₱{Math.round(180 * milkPricePerMl)}</b>/180ml &nbsp;·&nbsp; 🥤 cup+ice+sugar <b className="text-clay">₱{extras}</b>{cupsPerTin ? <> &nbsp;·&nbsp; 🥫 ≈{cupsPerTin} cups/{sel.packG}g tin</> : null}</div>
        <div className="mt-2 text-center">
          <button type="button" onClick={resetPrices} className="font-mono text-[.55rem] tracking-[.08em] uppercase text-brown-soft underline underline-offset-2 hover:text-clay">↺ reset saved prices</button>
        </div>
      </div>

      <div className="bg-kraft border-[2.2px] border-forest rounded-card shadow-hard-sm px-5 py-[18px] my-[18px] max-md:p-[14px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-doodle font-bold text-[1.05rem] text-forest">📦 Plan a batch</span>
          <label className="ml-auto flex items-center gap-2 font-mono text-[.6rem] tracking-[.1em] uppercase text-brown">cups to make
            <input type="number" min="0" step="10" value={cups} inputMode="numeric" aria-label="Cups to make" onChange={(e) => setCups(Math.max(0, +e.target.value || 0))} className="srp-input !w-[84px] text-center" />
          </label>
        </div>
        <div className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
          <div className="ing-tile">
            <div className="font-mono text-[.56rem] tracking-[.06em] uppercase text-olive">🍵 {sel.l}</div>
            <div className="text-[.8rem] text-forest font-semibold">{batch.grams} g{batch.tins ? " · ≈" + batch.tins + " × " + sel.packG + "g tin" + (batch.tins > 1 ? "s" : "") : ""}</div>
            <div className="font-mono text-[.62rem] text-clay font-semibold">{peso(batch.matchaSpend)}</div>
          </div>
          <div className="ing-tile">
            <div className="font-mono text-[.56rem] tracking-[.06em] uppercase text-olive">🥛 {milkOptions[ki].l.split(" — ")[0]}</div>
            <div className="text-[.8rem] text-forest font-semibold">{batch.milkLitres.toFixed(1)} L <span className="text-brown-soft">(≈180ml/cup)</span></div>
            <div className="font-mono text-[.62rem] text-clay font-semibold">{peso(batch.milkSpend)}</div>
          </div>
          <div className="ing-tile">
            <div className="font-mono text-[.56rem] tracking-[.06em] uppercase text-olive">🥤 Cups + ice + sugar</div>
            <div className="text-[.8rem] text-forest font-semibold">{cups} cups</div>
            <div className="font-mono text-[.62rem] text-clay font-semibold">{peso(batch.pkgSpend)}</div>
          </div>
          <div className="ing-tile !bg-forest !border-forest">
            <div className="font-mono text-[.56rem] tracking-[.06em] uppercase text-onforest-mut">Total ingredient cost</div>
            <div className="text-[.95rem] text-cream-light font-bold">{peso(batch.total)}</div>
            <div className="font-mono text-[.6rem] text-onforest-mut">{peso(batch.perCup)}/cup · ingredient only</div>
          </div>
        </div>
        <div className="mt-2 font-mono text-[.55rem] tracking-[.04em] text-brown-soft">Assumes ~180ml milk &amp; {dose}g matcha per cup, at the matcha/milk picked above. Ingredient cost only — excludes booth fee, labour &amp; spoilage.</div>
      </div>

      <div className="bg-cream-card border-[2.2px] border-forest rounded-card shadow-hard-sm px-5 py-[18px] my-[18px] max-md:p-[14px]">
        <h3 className="font-doodle font-bold text-[1.05rem] text-forest">🧾 Ingredients used & price sources</h3>
        <div className="text-[.78rem] text-olive-soft mt-1 mb-3.5">Verified June 2026 — tap “price ↗” to open each source. Prices vary by retailer & quantity.</div>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(255px,1fr))]">
          {ingredients.map((x, i) => (
            <div className="ing-tile" key={i}>
              <div className="font-mono text-[.56rem] tracking-[.06em] uppercase text-olive">{x.il}</div>
              <div className="text-[.8rem] text-forest font-semibold">{x.iv}</div>
              <a className="self-start mt-[3px] font-mono text-[.56rem] tracking-[.06em] uppercase text-cream-light bg-forest px-[11px] py-1 rounded-full no-underline hover:bg-olive" href={x.url} target="_blank" rel="noopener">price ↗</a>
            </div>
          ))}
        </div>
      </div>

      <div className="card-grid">
        {drinks.map((d) => {
          const milkCost = milkCostPerCup(milkPricePerMl, d.milkMl);
          const cogs = cogsForDrink(d, { pricePerGram, doseGrams: dose, milkPricePerMl, extras });
          const srp = srpFor(d);
          const p = profit(srp, cogs);
          const mar = marginPct(srp, cogs);
          return (
            <article key={d.name} className="relative bg-cream-deep border-[2.2px] border-brown rounded-card shadow-hard-brown p-[17px] flex flex-col gap-[11px]">
              <div className="flex gap-[11px] items-center">
                <svg className="w-[42px] h-[42px]" viewBox="0 0 64 64" aria-hidden="true"><use href="#mm-glass" /></svg>
                <div>
                  <h3 className="font-doodle font-bold text-[1.12rem] text-brown leading-tight">{d.name}</h3>
                  <span className="font-mono text-[.58rem] tracking-[.04em] text-brown-soft">{d.note}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-[7px]">
                <div className="cost-cell"><span className="block font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft">COGS</span><span className="block font-mono font-medium text-[1.05rem] text-forest mt-[3px]">₱{cogs}</span></div>
                <div className="cost-cell"><span className="block font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft">SRP ✎</span><input className="srp-input" type="number" min="0" step="5" value={srp} inputMode="numeric" aria-label={"Selling price for " + d.name} onChange={(e) => editSrp(d.name, +e.target.value || 0)} onBlur={() => commitSrp(d.name)} /></div>
                <div className="cost-cell cost-cell--hl"><span className="block font-mono text-[.52rem] tracking-[.1em] uppercase text-onforest-mut">Profit</span><span className="block font-mono font-medium text-[1.05rem] text-cream-light mt-[3px]">₱{p}</span></div>
              </div>
              <div className="flex justify-between font-mono text-[.56rem] tracking-[.06em] uppercase text-brown-soft"><span>ingredient margin · <b className="text-clay">{mar}%</b></span><span>{marginWord(mar)}</span></div>
              <div className="h-4 border-2 border-brown rounded-[10px] bg-cream-card overflow-hidden"><div className="margin-fill h-full" style={{ width: Math.max(0, mar) + "%" }} /></div>
              <div className="font-mono text-[.58rem] leading-relaxed tracking-[.01em] text-brown bg-cream-card border-[1.5px] border-dashed border-brown-soft rounded-[11px] px-[11px] py-[9px]">🧮 matcha ₱{mCost} + milk ₱{Math.round(milkCost)}{d.fl > 0 ? " + " + d.flavor + " ₱" + d.fl : ""} + cup/ice/sugar ₱{extras} = <b className="text-forest">₱{cogs}</b> · type your price in SRP ✎</div>
            </article>
          );
        })}
      </div>
    </>
  );
}
