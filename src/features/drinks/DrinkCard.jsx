"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import SaveButton from "@/components/SaveButton";

// One pill. Base pills (matcha/milk) get a filled green look so they read as the
// drink's foundation; add-on pills are outlined cream. Both are removable.
function Pill({ emoji, label, base, onRemove }) {
  const skin = base
    ? "bg-matcha-fill border-olive text-forest"
    : "bg-cream-light border-forest text-forest";
  return (
    <span
      className={`font-mono text-[.58rem] uppercase tracking-[.04em] border-2 ${skin} rounded-pill px-[9px] py-[4px] inline-flex items-center gap-[5px]`}
    >
      {emoji ? emoji + " " : ""}{label}
      <button
        aria-label={"Remove " + label}
        onClick={onRemove}
        className="text-clay hover:text-forest leading-none"
      >
        ✕
      </button>
    </span>
  );
}

export default function DrinkCard({
  drink,
  saved,
  onToggleSave,
  catalog,
  onAttach,
  onDetach,
  onToggleBase,
  onEdit,
  onDelete,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addPos, setAddPos] = useState(null); // viewport coords for the portaled "+ add" menu
  const addBtnRef = useRef(null);
  const [lightbox, setLightbox] = useState(null); // image index, or null
  const [menu, setMenu] = useState(null); // right-click context menu position {x, y}, or null

  // Open the "+ add" menu as a portal anchored to the button, clamped to the
  // viewport — `.paper-card` is overflow-hidden, so an in-card dropdown clips.
  const openAdd = () => {
    const r = addBtnRef.current?.getBoundingClientRect();
    if (r) {
      const W = 200,
        H = 240,
        pad = 8;
      setAddPos({
        left: Math.max(pad, Math.min(r.left, window.innerWidth - W - pad)),
        top: Math.max(pad, Math.min(r.bottom + 4, window.innerHeight - H - pad)),
      });
    }
    setAddOpen(true);
  };
  const attached = drink.ingredients;
  const unattached = catalog.filter((i) => !attached.includes(i.name));

  // the "+ add" menu: removed bases first (to re-add), then unattached add-ons
  const addItems = [
    ...(!drink.hasMatcha
      ? [{ key: "b:matcha", label: "🍵 Matcha", pick: () => onToggleBase("matcha") }]
      : []),
    ...(!drink.hasMilk
      ? [{ key: "b:milk", label: "🥛 Milk", pick: () => onToggleBase("milk") }]
      : []),
    ...unattached.map((i) => ({
      key: "i:" + i.name,
      label: `${i.name} — ₱${i.price}`,
      pick: () => onAttach(i.name),
    })),
  ];

  const images = drink.images;
  const move = (delta) => setLightbox((i) => (i + delta + images.length) % images.length);

  // keyboard control for the open lightbox: Escape closes, arrows page photos
  useEffect(() => {
    if (lightbox == null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowLeft" && images.length > 1)
        setLightbox((i) => (i - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight" && images.length > 1)
        setLightbox((i) => (i + 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length]);

  return (
    <article
      className={`paper-card${saved ? " is-star" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <SaveButton
        saved={saved}
        onToggle={onToggleSave}
        label={drink.name}
        className="absolute top-[10px] right-[10px] z-[3]"
      />

      {/* title + subtitle */}
      <div className="flex gap-[13px] items-start px-4 pt-4 pb-2.5">
        <svg className="shrink-0 w-14 h-14" viewBox="0 0 64 64" aria-hidden="true">
          <use href="#mm-glass" />
        </svg>
        <div className="flex-1 min-w-0 pr-9">
          <h3 className="font-doodle font-bold text-[1.18rem] text-forest leading-snug">
            {drink.name}
          </h3>
          <div className="font-mono text-[.58rem] tracking-[.03em] text-olive-soft mt-1">
            {drink.note}
          </div>
        </div>
      </div>

      {/* ingredient pills (matcha + milk bases, then add-ons, then + add) */}
      <div className="px-4 pb-3 flex flex-wrap gap-[6px] items-center">
        {drink.hasMatcha && (
          <Pill emoji="🍵" label="Matcha" base onRemove={() => onToggleBase("matcha")} />
        )}
        {drink.hasMilk && (
          <Pill emoji="🥛" label="Milk" base onRemove={() => onToggleBase("milk")} />
        )}
        {attached.map((name) => (
          <Pill key={name} label={name} onRemove={() => onDetach(name)} />
        ))}

        {addItems.length > 0 && (
          <button
            ref={addBtnRef}
            type="button"
            onClick={() => (addOpen ? setAddOpen(false) : openAdd())}
            aria-expanded={addOpen}
            aria-label={"Add to " + drink.name}
            className="font-mono text-[.58rem] uppercase tracking-[.06em] text-olive bg-cream-card border-2 border-dashed border-olive rounded-pill px-[10px] py-[4px] hover:border-forest hover:text-forest transition"
          >
            ＋ add
          </button>
        )}
      </div>

      {/* long description */}
      {drink.desc && (
        <p className="px-4 pb-3 text-[.8rem] leading-relaxed text-brown">{drink.desc}</p>
      )}

      {/* reference-photo thumbnail grid → lightbox */}
      {images.length > 0 && (
        <div className="px-4 pb-4">
          <div className="font-mono text-[.5rem] tracking-[.1em] uppercase text-brown-soft mb-1.5">
            on the market — tap to enlarge
          </div>
          <div className="grid grid-cols-4 gap-[6px]">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLightbox(i)}
                aria-label={`Open ${drink.name} reference photo ${i + 1}`}
                className="relative aspect-square rounded-[8px] overflow-hidden border-2 border-brown-soft hover:border-forest transition"
              >
                <img
                  src={img.src}
                  alt={`${drink.name} reference ${i + 1}`}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {addOpen &&
        addPos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              onClick={() => setAddOpen(false)}
              aria-hidden="true"
            />
            <div
              className="fixed z-[56] min-w-[190px] max-h-[230px] overflow-auto bg-cream-card border-2 border-forest rounded-[11px] shadow-hard-sm p-1"
              style={{ left: addPos.left, top: addPos.top }}
            >
              {addItems.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => {
                    it.pick();
                    setAddOpen(false);
                  }}
                  className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-forest hover:bg-cream-light transition"
                >
                  {it.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}

      {lightbox != null &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] bg-forest/85 backdrop-blur-sm grid place-items-center p-6"
            onClick={() => setLightbox(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${drink.name} photo`}
          >
            <div className="relative max-w-[680px] w-full" onClick={(e) => e.stopPropagation()}>
              <img
                src={images[lightbox].src}
                alt={drink.name}
                referrerPolicy="no-referrer"
                className="w-full max-h-[78vh] object-contain rounded-card border-[3px] border-cream-light shadow-hard"
              />
              <div className="flex items-center justify-between gap-3 mt-2 text-cream-light font-mono text-[.62rem]">
                <span className="truncate">
                  {drink.name} · {lightbox + 1}/{images.length}
                  {images[lightbox].credit ? " · " + images[lightbox].credit : ""}
                </span>
                {images[lightbox].source && (
                  <a
                    href={images[lightbox].source}
                    target="_blank"
                    rel="noopener"
                    className="shrink-0 text-onforest-soft underline underline-offset-2"
                  >
                    view source ↗
                  </a>
                )}
              </div>
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => move(-1)}
                    aria-label="Previous photo"
                    className="absolute left-[-14px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-cream-light text-forest border-2 border-forest grid place-items-center text-lg leading-none"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => move(1)}
                    aria-label="Next photo"
                    className="absolute right-[-14px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-cream-light text-forest border-2 border-forest grid place-items-center text-lg leading-none"
                  >
                    ›
                  </button>
                </>
              )}
              <button
                onClick={() => setLightbox(null)}
                aria-label="Close"
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-cream-light text-forest border-2 border-forest grid place-items-center"
              >
                ✕
              </button>
            </div>
          </div>,
          document.body,
        )}

      {menu &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(null);
              }}
              aria-hidden="true"
            />
            <div
              className="fixed z-[56] min-w-[150px] bg-cream-card border-2 border-forest rounded-[10px] shadow-hard-sm p-1"
              style={{ top: menu.y, left: menu.x }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  onEdit();
                }}
                className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-forest hover:bg-cream-light transition"
              >
                ✎ Edit drink
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    onDelete();
                  }}
                  className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-clay hover:bg-cream-light transition"
                >
                  🗑 Delete drink
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </article>
  );
}
