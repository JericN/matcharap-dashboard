"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { perGramLabel, priceLabel, servingLabel } from "@/features/powders/pricing";
import SaveButton from "@/components/SaveButton";

// category swatch colours (themeable via :root --c-cat-*)
const PDOT = {
  ph: "rgb(var(--c-cat-ph))",
  jp: "rgb(var(--c-cat-jp))",
  import: "rgb(var(--c-cat-import))",
};

export default function PowderCard({ powder, img, saved, onToggleSave, onEdit }) {
  const [menu, setMenu] = useState(null); // {x,y} right-click context menu
  return (
    <article
      className={`paper-card${powder.star ? " is-star" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <SaveButton
        saved={saved}
        onToggle={onToggleSave}
        label={powder.name}
        className="absolute top-[10px] right-[10px] z-[3]"
      />

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
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </span>
        <div className="flex-1 min-w-0 pr-9">
          <div className="font-mono text-[.55rem] tracking-[.08em] uppercase text-clay mb-[3px]">
            {powder.catlabel}
            {powder.star ? " · ⭐ top pick" : ""}
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
          {perGramLabel(powder)}
        </span>
        <span className="flex flex-col gap-px">
          <span className="font-mono text-[.5rem] tracking-[.18em] uppercase text-matcha-bright">
            per gram
          </span>
          <span className="font-mono text-[.58rem] tracking-[.02em] text-onforest-soft">
            ☕ {servingLabel(powder)} / 2g
          </span>
        </span>
      </div>
      <p className="text-[.82rem] text-olive px-4 mb-2">{powder.taste}</p>
      <div className="px-4 pb-3 flex flex-col gap-[5px]">
        <div className="meta-line normal-case tracking-normal items-start">💴 {priceLabel(powder)}</div>
        <div className="meta-line normal-case tracking-normal items-start">🔥 {powder.hype}</div>
      </div>
      <a className="buylink" href={powder.url} target="_blank" rel="noopener">
        🛒 Where to buy ↗
        <span className="opacity-80 normal-case tracking-normal text-[.55rem]">{powder.buy}</span>
      </a>

      {menu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(null);
              }}
            />
            <div
              className="fixed z-[56] paper-card !static p-1.5 min-w-[150px]"
              style={{ top: menu.y, left: menu.x }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  onEdit();
                }}
                className="w-full text-left px-3 py-1.5 rounded-[7px] font-mono text-[.66rem] text-forest hover:bg-cream-light transition"
              >
                ✎ Edit price &amp; size
              </button>
            </div>
          </>,
          document.body,
        )}
    </article>
  );
}
