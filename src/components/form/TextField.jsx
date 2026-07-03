import Field, { cx } from "./Field";

// Text-style input (no dropdown chevron). `type` allows url/email/search/date
// etc. `variant="bare"` drops the box for a borderless inline skin (expenses
// table). `inputClassName` tweaks the control; everything else passes straight
// to the <input> (value, onChange, placeholder, aria-label, onKeyDown, …).
export default function TextField({
  label,
  hint,
  id,
  type = "text",
  variant = "box",
  className,
  inputClassName,
  ...rest
}) {
  const base = variant === "bare" ? "field-bare" : "field-box";
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <input id={id} type={type} className={cx(base, inputClassName)} {...rest} />
    </Field>
  );
}
