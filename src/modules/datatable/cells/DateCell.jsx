"use client";
import { useEffect, useState } from "react";
import { TextField } from "@/components/form";

// Native date picker cell (yyyy-mm-dd). Commits immediately on pick/clear.
export default function DateCell({ value, onCommit }) {
  const [draft, setDraft] = useState(value ?? "");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value ?? "");
  }, [value, focused]);

  return (
    <TextField
      type="date"
      variant="bare"
      aria-label="Date cell"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onCommit(e.target.value);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}
