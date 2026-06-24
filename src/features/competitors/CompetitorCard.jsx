// region swatch colours reuse the powder-category greens (themeable via :root --c-cat-*)
const RDOT = { north: "rgb(var(--c-cat-ph))", central: "rgb(var(--c-cat-jp))", south: "rgb(var(--c-cat-import))" };
const BAND = { budget: "₱", mid: "₱₱", premium: "₱₱₱" };

function fmtK(n) {
  if (n == null) return "—";
  return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : "" + n;
}

export default function CompetitorCard({ c }) {
  const menuTxt = c.menu.map((m) => `${m.i}${m.p ? ` ₱${m.p}` : ""}`).join(" · ");
  const ttTxt = c.tt ? ` · TT ${fmtK(c.tt)}` : "";
  const healthCls =
    c.health === "warn"
      ? "text-clay border-clay bg-clay/10"
      : c.health === "wait"
      ? "text-brown-soft border-brown-soft"
      : "text-olive border-olive bg-olive/10";

  return (
    <article className={`paper-card${c.star ? " is-star" : ""}`}>
      <div className="flex gap-[13px] items-start px-4 pt-4 pb-2.5">
        <span
          className="shrink-0 w-14 h-14 rounded-full border-[2.4px] border-forest grid place-items-center font-display font-bold text-[1.7rem] text-cream-light leading-none"
          style={{ background: RDOT[c.region] }}
        >
          {c.rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[.55rem] tracking-[.08em] uppercase text-clay mb-[3px]">
            {c.format} · 📍 {c.area}
          </div>
          <h3 className="font-doodle font-bold text-[1.18rem] text-forest leading-snug">{c.name}</h3>
          <div className="font-body text-[.74rem] text-olive-soft mt-1 leading-snug">{c.hook}</div>
        </div>
      </div>

      <div className="perg-box">
        <span className="font-display font-bold text-[2rem] leading-[.9] text-cream-light whitespace-nowrap">
          ₱{c.price}
        </span>
        <span className="flex flex-col gap-px min-w-0">
          <span className="font-mono text-[.5rem] tracking-[.14em] uppercase text-matcha-bright truncate">
            {BAND[c.band]} · {c.sig}
          </span>
          <span className="font-mono text-[.58rem] tracking-[.02em] text-onforest-soft">
            ⭐ {c.rating} ({c.reviews}) · {c.open ? "open ✓" : "closed"}
          </span>
        </span>
      </div>

      <p className="text-[.82rem] text-olive px-4 mb-2">🍵 {c.sourcing}</p>

      <div className="px-4 pb-3 flex flex-col gap-[5px]">
        <div className="meta-line normal-case tracking-normal items-start">📋 {menuTxt}</div>
        <div className="meta-line normal-case tracking-normal items-start">
          👥 IG {fmtK(c.ig)}{ttTxt} · {c.scale}
        </div>
        <div className="meta-line normal-case tracking-normal items-start">🛒 {c.channels}</div>
        {c.note && (
          <div className="meta-line normal-case tracking-normal items-start text-clay">⚠️ {c.note}</div>
        )}
      </div>

      <div className="px-4 pb-3 mt-auto flex items-center justify-between gap-2">
        <span className={`font-mono text-[.55rem] tracking-[.06em] uppercase px-[9px] py-[4px] rounded-pill border-2 ${healthCls}`}>
          {c.healthTxt}
        </span>
        <span className="font-mono text-[.52rem] tracking-[.08em] uppercase text-olive-soft">Maps ✓</span>
      </div>

      <a className="buylink !mt-0" href={c.url} target="_blank" rel="noopener">
        🔗 Store / menu ↗
        <span className="opacity-80 normal-case tracking-normal text-[.55rem]">{c.linkLabel}</span>
      </a>
    </article>
  );
}
