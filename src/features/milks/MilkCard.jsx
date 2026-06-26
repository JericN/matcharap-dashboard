"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { perLiterLabel, perCupLabel, priceLabel } from "@/features/milks/pricing";
import SaveButton from "@/components/SaveButton";

// category swatch colours (themeable via :root --c-cat-*) — fallback behind the logo
const MDOT = {
  ph: "rgb(var(--c-cat-ph))",
  import: "rgb(var(--c-cat-import))",
  authentic: "rgb(var(--c-cat-authentic))",
  unique: "rgb(var(--c-cat-unique))",
};

export default function MilkCard({ milk, img, saved, onToggleSave, onEdit }) {
  const [menu, setMenu] = useState(null); // {x,y} right-click context menu
  return (
    <article
      className={`paper-card${milk.star ? " is-star" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <SaveButton
        saved={saved}
        onToggle={onToggleSave}
        label={milk.name}
        className="absolute top-[10px] right-[10px] z-[3]"
      />

      <div className="flex gap-[13px] items-start px-4 pt-4 pb-2.5">
        <span
          className="shrink-0 w-14 h-14 rounded-full border-[2.4px] border-forest overflow-hidden"
          style={{ background: MDOT[milk.cat] }}
        >
          {img && (
            <img
              src={img}
              alt={milk.name}
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
            {milk.catlabel}
            {milk.star ? " · ⭐ top pick" : ""}
          </div>
          <h3 className="font-doodle font-bold text-[1.18rem] text-forest leading-snug">
            {milk.name}
          </h3>
          <div className="font-mono text-[.58rem] tracking-[.03em] text-olive-soft mt-1">
            🥛 {milk.type}
          </div>
        </div>
      </div>
      <div className="perg-box">
        <span className="font-display font-bold text-[2rem] leading-[.9] text-cream-light whitespace-nowrap">
          {perLiterLabel(milk)}
        </span>
        <span className="flex flex-col gap-px">
          <span className="font-mono text-[.5rem] tracking-[.18em] uppercase text-matcha-bright">
            per liter
          </span>
          <span className="font-mono text-[.58rem] tracking-[.02em] text-onforest-soft">
            ☕ ≈{perCupLabel(milk)} / cup
          </span>
        </span>
      </div>
      <p className="text-[.82rem] text-olive px-4 mb-2">{milk.taste}</p>
      <div className="px-4 pb-3 flex flex-col gap-[5px]">
        <div className="meta-line normal-case tracking-normal items-start">🌿 {milk.origin}</div>
        <div className="meta-line normal-case tracking-normal items-start">💴 {priceLabel(milk)}</div>
        <div className="meta-line normal-case tracking-normal items-start">🔥 {milk.hype}</div>
      </div>
      <a className="buylink" href={milk.url} target="_blank" rel="noopener">
        🛒 Where to buy ↗
        <span className="opacity-80 normal-case tracking-normal text-[.55rem]">{milk.buy}</span>
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
