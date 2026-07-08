// Select / multi-select option colors — earthy tints DERIVED from the theme
// tokens (:root in globals.css) so they reskin with the palette. Store/emit the
// NAME (e.g. "clay"), never a hex; render via rgb(var(--c-<token>)/α).

export const OPTION_COLORS = [
  { name: "forest", token: "forest" },
  { name: "leaf", token: "matcha" },
  { name: "sage", token: "olive" },
  { name: "clay", token: "clay" },
  { name: "caramel", token: "cat-authentic" },
  { name: "brown", token: "brown-soft" },
  { name: "mauve", token: "cat-unique" },
  { name: "sand", token: "kraft" },
];

// Assign the next color by cycling warm↔cool so adjacent options contrast.
const ROTATION = ["clay", "leaf", "mauve", "caramel", "forest", "brown", "sage", "sand"];
export function nextOptionColor(count) {
  return ROTATION[count % ROTATION.length];
}

// Inline chip style for a color NAME: soft fill + border + solid text (forest for
// the pale "sand"). Unknown name falls back to the first color.
export function optionChip(colorName) {
  const entry = OPTION_COLORS.find((c) => c.name === colorName) ?? OPTION_COLORS[0];
  const t = entry.token;
  return {
    backgroundColor: `rgb(var(--c-${t}) / 0.18)`,
    borderColor: `rgb(var(--c-${t}) / 0.45)`,
    color: colorName === "sand" ? "rgb(var(--c-forest))" : `rgb(var(--c-${t}))`,
  };
}
