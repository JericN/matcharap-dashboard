"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TextField, NumberField } from "@/components/form";

// Edit an add-on ingredient — the name is the catalog key (read-only); only the
// shared ₱ price is editable.
export default function IngredientForm({ ingredient, onSave, onClose }) {
  const [price, setPrice] = useState(ingredient.price);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => onSave({ price: Number(price) || 0 });

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-forest/85 backdrop-blur-sm overflow-y-auto p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${ingredient.name}`}
    >
      <div
        className="paper-card !static w-full max-w-[460px] mx-auto my-6 p-5 max-md:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-2 mb-4">
          <h3 className="font-doodle font-bold text-[1.4rem] text-forest leading-none">
            Edit ingredient
          </h3>
          <span className="font-mono text-[.56rem] tracking-[.06em] uppercase text-brown-soft">
            synced to everyone
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <TextField
            label="Name"
            id="if-name"
            value={ingredient.name}
            disabled
            inputClassName="opacity-60 cursor-not-allowed"
          />
          <NumberField
            label="Price"
            id="if-price"
            prefix="₱"
            min="0"
            step="0.5"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="chip normal-case tracking-normal">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="chip chip--active normal-case tracking-normal"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
