"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TextField, NumberField } from "@/components/form";

// Edit a powder's or milk's actual product PRICE + SIZE. Name is read-only (it's
// the identity key for the image/heart/calculator). ₱/g (powder) or ₱/L (milk)
// is derived live. Saves to powderOverrides / milkOverrides (shared via Redis).
// kind: "powder" → size in grams, rate ₱/g · "milk" → size in liters, rate ₱/L.
export default function PriceSizeForm({ kind, item, onSave, onClose }) {
  const sizeKey = kind === "powder" ? "grams" : "liters";
  const unit = kind === "powder" ? "g" : "L";
  const [price, setPrice] = useState(item.price);
  const [size, setSize] = useState(item[sizeKey]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = Number(price) || 0;
  const s = Number(size) || 0;
  const rate = s > 0 ? p / s : null;
  const rateLabel =
    rate == null ? "—" : "₱" + (rate < 100 ? Math.round(rate * 10) / 10 : Math.round(rate));
  const valid = p > 0 && s > 0;

  const submit = () => {
    if (!valid) return;
    onSave({ price: p, [sizeKey]: s });
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-forest/85 backdrop-blur-sm overflow-y-auto p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${item.name} price`}
    >
      <div
        className="paper-card !static w-full max-w-[400px] mx-auto my-10 p-5 max-md:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className="font-doodle font-bold text-[1.4rem] text-forest leading-none">
            Edit price
          </h3>
          <span className="font-mono text-[.56rem] tracking-[.06em] uppercase text-brown-soft">
            synced to everyone
          </span>
        </div>
        <p className="font-mono text-[.62rem] text-olive-soft mb-4">{item.name}</p>

        <div className="flex flex-col gap-3">
          <NumberField
            label="Price (actual pack)"
            id="ps-price"
            prefix="₱"
            min="0"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <NumberField
            label={`Pack size (${unit})`}
            id="ps-size"
            suffix={unit}
            min="0"
            step={kind === "powder" ? "1" : "0.01"}
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
          <div className="perg-box !mt-1">
            <span className="font-display font-bold text-[1.8rem] leading-[.9] text-cream-light whitespace-nowrap">
              {rateLabel}
            </span>
            <span className="font-mono text-[.55rem] tracking-[.16em] uppercase text-matcha-bright">
              per {kind === "powder" ? "gram" : "liter"} · derived
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="chip normal-case tracking-normal">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="chip chip--active normal-case tracking-normal disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
