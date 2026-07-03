import { useEffect, useState } from "react";
import Field, { cx } from "./Field";

// Numeric input in three skins:
//   variant="box"        boxed, matches TextField/SelectField (default)
//   variant="underline"  inline dashed-underline (cups / SRP / price overrides)
//   variant="bare"       borderless inline (expenses table)
// `prefix` (e.g. "₱") and `suffix` (e.g. "/g") render as non-interactive
// adornments inside the box variant. Spinners are stripped via CSS.
//
// Empty-while-typing: the field keeps its own draft STRING so it can be "" or a
// mid-typed value ("1.", "0.") without the parent's numeric state snapping it
// back to 0. The parent still receives the raw onChange event (and parses
// e.target.value exactly as before) — we only own what's displayed. While the
// input is focused the user's text wins; when it isn't, we mirror the incoming
// `value` so external/programmatic updates show and a blur re-normalizes "".
export default function NumberField({
  label,
  hint,
  id,
  variant = "box",
  prefix,
  suffix,
  className,
  inputClassName,
  value,
  onChange,
  onFocus,
  onBlur,
  ...rest
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  // Sync the display from `value` only when not actively editing, so typing is
  // never clobbered but outside changes (and the blur re-normalize) still land.
  useEffect(() => {
    if (!focused) setDraft(value == null ? "" : String(value));
  }, [value, focused]);

  const base =
    variant === "underline"
      ? "field-underline"
      : variant === "bare"
        ? "field-bare"
        : "field-box";
  const input = (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      className={cx(base, prefix && "!pl-6", suffix && "!pr-7", inputClassName)}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...rest}
    />
  );
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      {prefix || suffix ? (
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[.78rem] text-brown-soft pointer-events-none">
              {prefix}
            </span>
          )}
          {input}
          {suffix && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[.6rem] text-brown-soft pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
