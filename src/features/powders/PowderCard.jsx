import { perGramLabel } from "@/features/powders/pricing";

// category swatch colours (themeable via :root --c-cat-*)
const PDOT = { ph: "rgb(var(--c-cat-ph))", jp: "rgb(var(--c-cat-jp))", import: "rgb(var(--c-cat-import))" };

export default function PowderCard({ powder, img, saved, onToggleSave }) {
  const perg = perGramLabel(powder);

  return (
    <article className={`paper-card${powder.star ? " is-star" : ""}`}>
      <button
        type="button"
        onClick={onToggleSave}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${powder.name} from your selection` : `Save ${powder.name} to your selection`}
        title={saved ? "Saved — click to remove" : "Save to your selection"}
        className={`absolute top-[10px] right-[10px] z-[3] w-8 h-8 grid place-items-center rounded-full border-2 border-clay transition hover:scale-110 ${saved ? "bg-clay text-cream-light" : "bg-cream-card text-clay"}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 21s-7-4.6-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.4 12 21 12 21z" />
        </svg>
      </button>

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
        <div className="flex-1 min-w-0 pr-9">
          <div className="font-mono text-[.55rem] tracking-[.08em] uppercase text-clay mb-[3px]">
            {powder.catlabel}{powder.star ? " · ⭐ top pick" : ""}
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
          <span className="font-mono text-[.58rem] tracking-[.02em] text-onforest-soft">
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
