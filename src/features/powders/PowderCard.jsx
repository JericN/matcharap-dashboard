const PDOT = { ph: "#5e7b3a", jp: "#7a9447", import: "#9bb15c" };

export default function PowderCard({ powder, img }) {
  const m = powder.price.match(/₱[\d.]+(?:[–-][\d.]+)?\s*\/\s*g/);
  const perg = (m ? m[0] : "—").replace(/\s*\/\s*g/, "");

  return (
    <article
      className="paper-card"
      style={powder.star ? { background: "linear-gradient(180deg,#f9f3e4,#f7f1e3)" } : undefined}
    >
      {powder.star && <span className="stamp">top pick</span>}
      <div className="flex gap-[13px] items-start px-4 pt-4 pb-2.5">
        <span
          className="shrink-0 w-14 h-14 rounded-full border-[2.4px] border-forest overflow-hidden"
          style={{ background: PDOT[powder.cat] }}
        >
          {img && (
            <img
              src={img}
              alt={powder.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover block"
              onError={(e) => e.currentTarget.remove()}
            />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[.55rem] tracking-[.08em] uppercase text-clay mb-[3px]">
            {powder.catlabel}
          </div>
          <h3 className="font-doodle font-bold text-[1.18rem] text-forest leading-snug">
            {powder.name}
          </h3>
          <div className="font-mono text-[.58rem] tracking-[.03em] text-olive-soft mt-1">
            🌿 {powder.origin}
          </div>
        </div>
      </div>
      <div className="perg-box">
        <span className="font-display font-bold text-[2rem] leading-[.9] text-cream-light whitespace-nowrap">
          {perg}
        </span>
        <span className="flex flex-col gap-px">
          <span className="font-mono text-[.5rem] tracking-[.18em] uppercase text-matcha-bright">
            per gram
          </span>
          <span className="font-mono text-[.58rem] tracking-[.02em] text-[#dfe6d2]">
            ☕ {powder.serving} / serving
          </span>
        </span>
      </div>
      <p className="text-[.82rem] text-olive px-4 mb-2">{powder.taste}</p>
      <div className="px-4 pb-3 flex flex-col gap-[5px]">
        <div className="meta-line normal-case tracking-normal items-start">💴 {powder.price}</div>
        <div className="meta-line normal-case tracking-normal items-start">🔥 {powder.hype}</div>
      </div>
      <a className="buylink" href={powder.url} target="_blank" rel="noopener">
        🛒 Where to buy ↗
        <span className="opacity-80 normal-case tracking-normal text-[.55rem]">{powder.buy}</span>
      </a>
    </article>
  );
}
