"use client";
import { useEffect, useState, useTransition } from "react";
import { setSrp, setCosts, setPriceOverride, resetPriceOverride } from "@/config/actions";
import {
  matchaCostPerCup,
  milkCostPerCup,
  cogsForDrink,
  profit,
  marginPct,
  marginWord,
  tallyTotals,
} from "@/features/calculator/cost";
import { SelectField, NumberField } from "@/components/form";
import SectionTitle from "@/components/SectionTitle";

const CAT_EMOJI = { ph: "🇵🇭", jp: "🇯🇵", import: "🌏" };
const peso = (n) => "₱" + Math.round(n).toLocaleString("en-US");
const SECTION = "mb-12 max-md:mb-9";

export default function Calculator({
  matchaOptions,
  usingAllPowders,
  milkOptions,
  drinks,
  savedDrinks,
  ingredients,
  costs,
  srp,
  priceOverrides,
}) {
  // ---- local (session) selections — not synced ----
  const [mLabel, setMLabel] = useState(() => {
    let best = matchaOptions[0],
      bd = Infinity;
    for (const o of matchaOptions) {
      const d = Math.abs(o.g - 20);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best.l;
  });
  const [ki, setKi] = useState(1);
  const [dose, setDose] = useState(3);
  const [cups, setCups] = useState(() => Object.fromEntries(savedDrinks.map((n) => [n, 10])));

  // ---- shared (synced) overrides — seeded from the store, persist on blur ----
  const [srpMap, setSrpMap] = useState(srp);
  const [cost, setCost] = useState(costs);
  const [ov, setOv] = useState(priceOverrides);
  const [, startTransition] = useTransition();

  // Resolve the matcha selection by stable identity (label), not by a frozen
  // index — the options list can change when powders are hearted/un-hearted.
  const selIndex = matchaOptions.findIndex((o) => o.l === mLabel);
  useEffect(() => {
    if (selIndex === -1) setMLabel(matchaOptions[0].l);
  }, [selIndex, matchaOptions]);
  const sel = matchaOptions[selIndex === -1 ? 0 : selIndex];

  // ---- derived prices ----
  const matchaKey = `matcha:${sel.l}`;
  const pricePerGram = ov[matchaKey] ?? sel.g;
  const milkOpt = milkOptions[ki];
  const milkKey = `milk:${milkOpt.l}`;
  const milkRefPerL = Math.round(milkOpt.ml * 1000 * 100) / 100;
  const milkPerL = ov[milkKey] ?? milkRefPerL;
  const milkPricePerMl = milkPerL / 1000;
  const packaging = cost.packaging;
  const additional = cost.additional;
  const refPrice = Object.fromEntries(ingredients.map((i) => [i.name, i.price]));
  const linkOf = Object.fromEntries(ingredients.map((i) => [i.name, i.link]));
  const emojiOf = Object.fromEntries(ingredients.map((i) => [i.name, i.emoji]));
  const priceOf = (name) => ov[`ing:${name}`] ?? refPrice[name];

  const ctx = { pricePerGram, doseGrams: dose, milkPricePerMl, priceOf, packaging, additional };
  const saved = drinks.filter((d) => savedDrinks.includes(d.name));
  const cupsOf = (name) => cups[name] ?? 0;
  const srpOf = (d) => (d.name in srpMap ? srpMap[d.name] : d.srp);
  const lines = saved.map((d) => ({ drink: d, cups: cupsOf(d.name), srp: srpOf(d) }));
  const tot = tallyTotals(lines, ctx);
  // priceable ingredients actually used by the hearted drinks
  const usedIngredients = [...new Set(saved.flatMap((d) => d.ingredients))];

  // ---- persisting editors ----
  const editCost = (k, v) => setCost((c) => ({ ...c, [k]: v }));
  const commitCost = (k) => startTransition(() => setCosts({ [k]: cost[k] }));
  const editSrp = (name, v) => setSrpMap((m) => ({ ...m, [name]: v }));
  const commitSrp = (name) => {
    if (name in srpMap) startTransition(() => setSrp(name, srpMap[name]));
  };
  const editOv = (key, raw) =>
    setOv((o) => {
      const n = { ...o };
      if (raw === "") delete n[key];
      else n[key] = Number(raw) || 0;
      return n;
    });
  const commitOv = (key) =>
    startTransition(() => (key in ov ? setPriceOverride(key, ov[key]) : resetPriceOverride(key)));

  return (
    <>
      {/* ① Recipe — selectors + per-cup overhead */}
      <section className={SECTION}>
        <SectionTitle badge="①" title="Recipe" meta="matcha · milk · dose · per-cup overhead" />
        <div className="bg-kraft border-[2.2px] border-forest rounded-card shadow-hard-sm px-5 py-[18px] max-md:p-[14px]">
          {/* two selectors on top */}
          <div className="flex gap-[18px] flex-wrap max-md:gap-3">
            <SelectField
              className="flex-1 min-w-[220px] max-md:min-w-0 max-md:basis-full"
              label="🍵 Matcha powder"
              hint={usingAllPowders ? "all powders" : "♥ your picks"}
              value={sel.l}
              onChange={(e) => setMLabel(e.target.value)}
            >
              {matchaOptions.map((o) => (
                <option key={o.l} value={o.l}>
                  {CAT_EMOJI[o.cat] + " "}
                  {o.l} — ₱{o.g.toFixed(2)}/g
                </option>
              ))}
            </SelectField>
            <SelectField
              className="flex-1 min-w-[220px] max-md:min-w-0 max-md:basis-full"
              label="🥛 Milk"
              value={ki}
              onChange={(e) => setKi(+e.target.value)}
            >
              {milkOptions.map((o, i) => (
                <option key={i} value={i}>
                  {o.l}
                </option>
              ))}
            </SelectField>
          </div>
          {usingAllPowders && (
            <div className="mt-1 font-mono text-[.56rem] tracking-[.02em] text-brown-soft">
              Showing every powder —{" "}
              <a href="/powders" className="text-clay underline underline-offset-2">
                ♥ heart your picks
              </a>{" "}
              to narrow the matcha list.
            </div>
          )}
          {/* three number fields on the bottom */}
          <div className="flex gap-[18px] flex-wrap mt-3 max-md:gap-3">
            <NumberField
              className="flex-1 min-w-[150px] max-md:basis-[45%]"
              inputClassName="text-center"
              label="⚖️ Matcha dose g/cup"
              min="0"
              step="0.5"
              value={dose}
              onChange={(e) => setDose(Math.max(0, +e.target.value || 0))}
            />
            <NumberField
              className="flex-1 min-w-[150px] max-md:basis-[45%]"
              inputClassName="text-center"
              label="🥤 Packaging ₱/cup"
              min="0"
              step="0.5"
              value={packaging}
              onChange={(e) => editCost("packaging", +e.target.value || 0)}
              onBlur={() => commitCost("packaging")}
            />
            <NumberField
              className="flex-1 min-w-[150px] max-md:basis-[45%]"
              inputClassName="text-center"
              label="➕ Additional ₱/cup"
              hint="ice · sugar · misc"
              min="0"
              step="0.5"
              value={additional}
              onChange={(e) => editCost("additional", +e.target.value || 0)}
              onBlur={() => commitCost("additional")}
            />
          </div>
        </div>
      </section>

      {saved.length === 0 ? (
        <div className="paper-card p-6 text-center">
          <div className="font-doodle font-bold text-[1.2rem] text-forest mb-1">
            No drinks costed yet
          </div>
          <p className="text-[.86rem] text-olive-soft">
            ♥ heart the drinks you sell on the{" "}
            <a href="/drinks" className="text-clay underline underline-offset-2 font-semibold">
              Drinks page
            </a>{" "}
            and they’ll show up here with ingredient prices, COGS, margin &amp; totals.
          </p>
        </div>
      ) : (
        <>
          {/* ② Ingredient prices — above the drinks, only what the hearted drinks use */}
          <section className={SECTION}>
            <SectionTitle
              badge="②"
              title="Ingredient Prices"
              meta="reference baked in · override to adjust (shared)"
            />
            <div className="bg-cream-card border-[2.2px] border-forest rounded-card shadow-hard-sm px-5 py-[18px] max-md:p-[14px]">
              <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                <PriceRow
                  label={`🍵 ${sel.l}`}
                  unit="/g"
                  refVal={sel.g}
                  okey={matchaKey}
                  ov={ov}
                  editOv={editOv}
                  commitOv={commitOv}
                />
                <PriceRow
                  label={`🥛 ${milkOpt.l.split(" — ")[0]}`}
                  unit="/L"
                  refVal={milkRefPerL}
                  okey={milkKey}
                  ov={ov}
                  editOv={editOv}
                  commitOv={commitOv}
                />
                {usedIngredients.map((nm) => (
                  <PriceRow
                    key={nm}
                    label={`${emojiOf[nm]} ${nm}`}
                    unit="/cup"
                    refVal={refPrice[nm]}
                    okey={`ing:${nm}`}
                    ov={ov}
                    editOv={editOv}
                    commitOv={commitOv}
                    link={linkOf[nm]}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ③ List of drinks — cups per drink + per-cup COGS / SRP / profit + breakdown */}
          <section className={SECTION}>
            <SectionTitle
              badge="③"
              title="List of Drinks"
              meta={`${saved.length} hearted · set cups per drink`}
            />
            <div className="card-grid">
              {saved.map((d) => {
                const matchaC = d.hasMatcha ? matchaCostPerCup(pricePerGram, dose) : 0;
                const milkC = d.hasMilk ? milkCostPerCup(milkPricePerMl, d.milkMl) : 0;
                const cogs = cogsForDrink(d, ctx);
                const s = srpOf(d);
                const p = profit(s, cogs);
                const mar = marginPct(s, cogs);
                const n = cupsOf(d.name);
                const parts = [
                  d.hasMatcha && `matcha ${peso(matchaC)}`,
                  d.hasMilk && `milk ${peso(milkC)}`,
                  ...d.ingredients.map((nm) => `${nm} ${peso(priceOf(nm))}`),
                  `pkg ${peso(packaging)}`,
                  `extra ${peso(additional)}`,
                ].filter(Boolean);
                return (
                  <article
                    key={d.name}
                    className="relative bg-cream-deep border-[2.2px] border-brown rounded-card shadow-hard-brown p-[17px] flex flex-col gap-[11px]"
                  >
                    <div className="flex gap-[11px] items-center">
                      <svg className="w-[42px] h-[42px]" viewBox="0 0 64 64" aria-hidden="true">
                        <use href="#mm-glass" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-doodle font-bold text-[1.12rem] text-brown leading-tight">
                          {d.name}
                        </h3>
                        <span className="font-mono text-[.58rem] tracking-[.04em] text-brown-soft">
                          {d.note}
                        </span>
                      </div>
                      <label className="text-center font-mono text-[.5rem] tracking-[.1em] uppercase text-brown-soft">
                        cups
                        <NumberField
                          variant="underline"
                          aria-label={"Cups of " + d.name}
                          inputMode="numeric"
                          inputClassName="!w-[58px] text-center !text-forest"
                          min="0"
                          step="5"
                          value={n}
                          onChange={(e) =>
                            setCups((c) => ({ ...c, [d.name]: Math.max(0, +e.target.value || 0) }))
                          }
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-[7px]">
                      <div className="cost-cell">
                        <span className="block font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft">
                          COGS
                        </span>
                        <span className="block font-mono font-medium text-[1.05rem] text-forest mt-[3px]">
                          {peso(cogs)}
                        </span>
                      </div>
                      <div className="cost-cell">
                        <span className="block font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft">
                          SRP ✎
                        </span>
                        <NumberField
                          variant="underline"
                          inputMode="numeric"
                          min="0"
                          step="5"
                          value={s}
                          aria-label={"Selling price for " + d.name}
                          onChange={(e) => editSrp(d.name, +e.target.value || 0)}
                          onBlur={() => commitSrp(d.name)}
                        />
                      </div>
                      <div className="cost-cell cost-cell--hl">
                        <span className="block font-mono text-[.52rem] tracking-[.1em] uppercase text-onforest-mut">
                          Profit
                        </span>
                        <span className="block font-mono font-medium text-[1.05rem] text-cream-light mt-[3px]">
                          {peso(p)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between font-mono text-[.56rem] tracking-[.06em] uppercase text-brown-soft">
                      <span>
                        gross margin · <b className="text-clay">{mar}%</b>
                      </span>
                      <span>
                        {marginWord(mar)} · ×{n} = {peso(p * n)}
                      </span>
                    </div>
                    <div className="h-4 border-2 border-brown rounded-[10px] bg-cream-card overflow-hidden">
                      <div
                        className="margin-fill h-full"
                        style={{ width: Math.max(0, mar) + "%" }}
                      />
                    </div>
                    <div className="font-mono text-[.56rem] leading-relaxed tracking-[.01em] text-brown bg-cream-card border-[1.5px] border-dashed border-brown-soft rounded-[11px] px-[11px] py-[9px]">
                      🧮 {parts.join(" + ")} = <b className="text-forest">{peso(cogs)}</b>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ④ Totals — title above (section pattern), numbers in the box */}
          <section>
            <SectionTitle
              badge="④"
              title="Totals"
              meta={`${tot.cups} cups across ${saved.length} drinks`}
            />
            <div className="bg-forest text-cream-light border-[2.2px] border-forest rounded-card shadow-hard px-5 py-[18px] max-md:p-[14px]">
              <div className="grid grid-cols-3 gap-3 max-md:gap-2">
                <div>
                  <div className="font-mono text-[.54rem] tracking-[.12em] uppercase text-onforest-mut">
                    Total COGS
                  </div>
                  <div className="font-display font-bold text-2xl max-md:text-[1.2rem]">
                    {peso(tot.cogs)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[.54rem] tracking-[.12em] uppercase text-onforest-mut">
                    Total revenue
                  </div>
                  <div className="font-display font-bold text-2xl max-md:text-[1.2rem]">
                    {peso(tot.revenue)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[.54rem] tracking-[.12em] uppercase text-onforest-mut">
                    Total profit
                  </div>
                  <div className="font-display font-bold text-2xl max-md:text-[1.2rem] text-matcha-bright">
                    {peso(tot.profit)}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-[7px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                <Brk label="🍵 matcha" v={tot.matcha} />
                <Brk label="🥛 milk" v={tot.milk} />
                <Brk label="🍓 add-ons" v={tot.addons} />
                <Brk label="🥤 packaging" v={tot.packaging} />
                <Brk label="➕ additional" v={tot.additional} />
              </div>
              {Object.keys(tot.addonByName).length > 0 && (
                <div className="mt-2.5 bg-cream-light/10 border border-onforest-mut/30 rounded-[12px] p-3">
                  <div className="font-mono text-[.52rem] tracking-[.12em] uppercase text-onforest-mut mb-2">
                    🍓 add-ons breakdown · {peso(tot.addons)} total
                  </div>
                  <div className="grid gap-[7px] [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
                    {Object.entries(tot.addonByName).map(([nm, v]) => (
                      <div
                        key={nm}
                        className="flex items-center justify-between gap-2 bg-forest/40 border border-onforest-mut/25 rounded-[9px] px-2.5 py-1.5"
                      >
                        <span className="font-mono text-[.62rem] text-onforest-soft truncate">
                          {emojiOf[nm]} {nm}
                        </span>
                        <span className="font-mono text-[.72rem] font-semibold text-cream-light shrink-0">
                          {peso(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-2.5 font-mono text-[.58rem] tracking-[.02em] text-onforest-soft">
                COGS = matcha {peso(tot.matcha)} + milk {peso(tot.milk)} + add-ons{" "}
                {peso(tot.addons)} + packaging {peso(tot.packaging)} + additional{" "}
                {peso(tot.additional)} = <b className="text-cream-light">{peso(tot.cogs)}</b>.
                Ingredient cost only — excludes booth fee, labour &amp; spoilage.
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Brk({ label, v }) {
  return (
    <div className="bg-cream-light/10 border border-onforest-mut/30 rounded-[10px] px-2.5 py-1.5">
      <div className="font-mono text-[.5rem] tracking-[.08em] uppercase text-onforest-mut">
        {label}
      </div>
      <div className="font-mono text-[.82rem] font-semibold text-cream-light">{peso(v)}</div>
    </div>
  );
}

function PriceRow({ label, unit, refVal, okey, ov, editOv, commitOv, link }) {
  const overridden = okey in ov;
  return (
    <div className="ing-tile">
      <div className="font-mono text-[.56rem] tracking-[.04em] uppercase text-olive truncate">
        {label}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="font-mono text-[.62rem] text-brown-soft whitespace-nowrap">
          ref ₱{refVal}
          {unit}
        </span>
        <NumberField
          variant="underline"
          inputClassName="!text-clay !w-[72px]"
          min="0"
          step="0.5"
          placeholder={String(refVal)}
          value={overridden ? ov[okey] : ""}
          aria-label={"Override price for " + label}
          onChange={(e) => editOv(okey, e.target.value)}
          onBlur={() => commitOv(okey)}
        />
        <span className="font-mono text-[.5rem] text-brown-soft">{unit}</span>
      </div>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener"
          className="font-mono text-[.5rem] tracking-[.04em] uppercase text-clay underline underline-offset-2 mt-0.5"
        >
          reference ↗
        </a>
      )}
    </div>
  );
}
