import SaveButton from "@/components/SaveButton";

// region swatch colours reuse the powder-category greens (themeable via :root --c-cat-*)
const RDOT = { north: "rgb(var(--c-cat-ph))", central: "rgb(var(--c-cat-jp))", south: "rgb(var(--c-cat-import))" };
const BAND = { budget: "₱", mid: "₱₱", premium: "₱₱₱" };
const LINK_META = {
  web: { icon: "🌐", label: "Website" },
  ig: { icon: "📷", label: "Instagram" },
  fb: { icon: "📘", label: "Facebook" },
  tiktok: { icon: "🎵", label: "TikTok" },
  maps: { icon: "🗺️", label: "Reviews" },
  order: { icon: "🛒", label: "Order" },
};
// top-left badge — PH = competitive threat, Japan = why it made the cut. Opaque so it reads over anything.
const THREAT = {
  strong: { label: "🎯 Strong" },
  moderate: { label: "🎯 Moderate" },
  niche: { label: "🎯 Niche" },
};
const SPOTLIGHT = {
  unique: { label: "✨ Unique" },
  iconic: { label: "🌟 Iconic" },
};
const JPY_TO_PHP = 0.379; // ¥→₱ conversion rate (open.er-api, Jun 2026)

function fmtK(n) {
  if (n == null) return "—";
  if (n < 1000) return "" + n;
  const k = (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "");
  return k + "K";
}

export default function CompetitorCard({ c, saved, onToggleSave }) {
  const isGiant = c.tier === "giant";
  const isJapan = c.tier === "japan";
  const toPeso = (n) => (isJapan ? Math.round(n * JPY_TO_PHP) : n); // Japan menu data is stored in ¥
  const menuTxt = c.menu.map((m) => `${m.i}${m.p ? ` ₱${toPeso(m.p)}` : ""}`).join(" · ");
  const prices = c.menu.map((m) => m.p).filter((p) => typeof p === "number").map(toPeso);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;
  const range = prices.length ? (lo === hi ? `₱${lo}` : `₱${lo}–${hi}`) : "—";
  const stamp = isJapan ? SPOTLIGHT[c.spotlight] : THREAT[c.threat];
  const dotBg = isJapan ? "rgb(var(--c-clay))" : isGiant ? "rgb(var(--c-brown))" : RDOT[c.region];
  const leaf = isJapan
    ? { txt: "🇯🇵 Japan", cls: "text-clay" }
    : isGiant
    ? { txt: "🍃 Big Leaf", cls: "text-brown" }
    : { txt: "🌱 Little Leaf", cls: "text-olive" };
  // every top-row pill shares one colour (aligned), regardless of threat/health value
  const PILL = "font-mono text-[.55rem] font-medium uppercase tracking-[.06em] px-[9px] py-[3px] rounded-pill border-2 bg-cream-card text-forest border-forest";
  const META = "meta-line normal-case tracking-normal items-start";

  return (
    <article className="paper-card">
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-1">
        <div className="flex flex-wrap items-center gap-[6px] min-w-0">
          <span className={PILL}>{stamp.label}</span>
          <span className={PILL}>{c.healthTxt}</span>
          <span title="Verified · Jun 2026" aria-label="Verified June 2026" className="shrink-0 grid place-items-center w-[19px] h-[19px] rounded-full border-2 border-forest bg-cream-card text-forest text-[.62rem] font-bold leading-none">✓</span>
        </div>
        <SaveButton saved={saved} onToggle={onToggleSave} label={c.name} className="shrink-0" />
      </div>

      <div className="flex gap-[13px] items-center px-4 pt-1 pb-1.5">
        <span
          className="shrink-0 w-14 h-14 rounded-full border-[2.4px] border-forest grid place-items-center font-display font-bold text-[1.7rem] text-cream-light leading-none"
          style={{ background: dotBg }}
        >
          {c.rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[.55rem] tracking-[.08em] uppercase text-clay mb-[3px]">
            <span className={`${leaf.cls} font-medium`}>{leaf.txt}</span> · {c.format}
          </div>
          <h3 className="font-doodle font-bold text-[1.18rem] text-forest leading-snug">{c.name}</h3>
        </div>
      </div>
      <p className="font-body text-[.82rem] text-olive-soft px-4 pb-2 leading-snug">{c.hook}</p>

      <div className="perg-box">
        <span className="font-display font-bold text-[2rem] leading-[.9] text-cream-light whitespace-nowrap">
          {isJapan ? "≈" : ""}₱{toPeso(c.price)}
        </span>
        <span className="flex flex-col gap-px min-w-0">
          <span className="font-mono text-[.5rem] tracking-[.14em] uppercase text-matcha-bright truncate">
            {BAND[c.band]} · {c.sig}
          </span>
          <span className="font-mono text-[.58rem] tracking-[.02em] text-onforest-soft">
            ⭐ {c.rating} ({c.reviews}) · {c.open ? "open ✓" : "closed"}
          </span>
          <span className="font-mono text-[.55rem] tracking-[.02em] text-onforest-mut">
            menu {range} · 📅 {c.opened}
          </span>
        </span>
      </div>

      <p className="text-[.82rem] text-olive px-4 mt-2.5 mb-2">🍵 {c.sourcing}</p>

      <div className="px-4 pb-3 flex flex-col gap-[5px]">
        <div className={META}>📍 {c.area}</div>
        <div className={META}>📋 {menuTxt}</div>
        <div className={META}>
          {c.ig != null ? <>👥 IG {fmtK(c.ig)} · {c.scale}</> : <>🏠 {c.scale}</>}
        </div>
        {c.note && (
          <div className={`${META} text-clay`}>⚠️ {c.note}</div>
        )}
      </div>

      {/* links — the only tappable, pill-shaped elements */}
      <div className="px-4 pb-4 flex flex-wrap gap-[6px]">
        {c.links.map((l) => {
          const meta = LINK_META[l.kind];
          return (
            <a
              key={l.kind + l.url}
              href={l.url}
              target="_blank"
              rel="noopener"
              title={`${meta.label} — opens in a new tab`}
              className="font-mono text-[.56rem] tracking-[.04em] uppercase text-forest bg-cream-light border-2 border-forest rounded-pill px-[9px] py-[5px] no-underline inline-flex items-center gap-[4px] transition-transform hover:-translate-y-px hover:bg-forest hover:text-cream-light"
            >
              <span aria-hidden="true">{meta.icon}</span>
              {meta.label}
            </a>
          );
        })}
      </div>
    </article>
  );
}
