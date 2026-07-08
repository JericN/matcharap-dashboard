"use client";
import { useEffect, useRef, useState } from "react";
import { TextField } from "@/components/form";

// Borderless text cell. Local draft; commits on blur only when changed; Escape
// reverts to the stored value. NOTE: Escape calls blur() which fires onBlur
// synchronously (before the revert re-render), so a ref flag tells onBlur to skip
// the commit — otherwise the discarded text would be saved.
export default function TextCell({ value, onCommit }) {
  const [draft, setDraft] = useState(value ?? "");
  const [focused, setFocused] = useState(false);
  const reverting = useRef(false);
  useEffect(() => {
    if (!focused) setDraft(value ?? "");
  }, [value, focused]);

  return (
    <TextField
      variant="bare"
      aria-label="Text cell"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (!reverting.current && draft !== (value ?? "")) onCommit(draft);
        reverting.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          reverting.current = true;
          setDraft(value ?? "");
          e.currentTarget.blur();
        }
      }}
    />
  );
}
