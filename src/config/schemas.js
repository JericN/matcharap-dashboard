import { z } from "zod";
import { normalizeExpenses } from "./expenseModel.mjs";

// ---- Domain schemas. This file is the single source of truth for shapes. ----

export const VendorSchema = z.object({
  c: z.enum(["open", "warn", "wait"]), // status colour: open / nearly-full / watch
  ic: z.string(), // emoji
  t: z.string(), // vendor-call note
});

// A human-navigable source link (organizer socials, venue map, web, apply form).
export const LinkSchema = z.object({
  kind: z.enum(["web", "ig", "fb", "tiktok", "maps", "order", "apply"]),
  url: z.string().url(),
});

export const EventSchema = z.object({
  name: z.string(),
  org: z.string(),
  status: z.tuple([z.string(), z.string()]), // [label, pill-class]
  start: z.string().nullable().default(null), // ISO 'YYYY-MM-DD' for sort + month grouping; null = recurring/rolling
  theme: z.string(),
  date: z.string(),
  venue: z.string(),
  size: z.string(),
  people: z.string(),
  vendor: VendorSchema,
});

export const PowderSchema = z.object({
  cat: z.enum(["ph", "jp", "import"]),
  catlabel: z.string(),
  star: z.boolean().optional(),
  name: z.string(),
  origin: z.string(),
  taste: z.string(),
  price: z.number().nonnegative(), // ₱ for the standard retail pack
  grams: z.number().positive(), // pack size in grams; ₱/g + ~₱/2g are DERIVED (pricing.js)
  hype: z.string(),
  buy: z.string(),
  url: z.string().url(),
});

// Matcha-drink competitors (Metro Manila). Ratings/open-status are
// Google-Maps-verified; follower counts are Instagram-verified.
// tier: 'general' = the smaller local field ("Little Leaves" 🌱),
//       'giant'   = corporate / multi-branch chains ("Big Leaves" 🍃),
//       'japan'   = benchmark Japan-based brands (spotlight: unique/iconic).
export const CompetitorSchema = z.object({
  tier: z.enum(["general", "giant", "japan"]).default("general"),
  rank: z.number().int().positive(),
  name: z.string(),
  region: z.enum(["north", "central", "south", "japan"]),
  format: z.string(),
  area: z.string(),
  price: z.number().nonnegative(), // signature ~16oz matcha latte, PHP
  band: z.enum(["budget", "mid", "premium"]),
  rating: z.number(),
  reviews: z.number().int().nonnegative(),
  open: z.boolean(),
  ig: z.number().int().nullable(), // Instagram followers (research-sourced)
  sig: z.string(),
  menu: z.array(z.object({ i: z.string(), p: z.number().nullable() })),
  sourcing: z.string(),
  hook: z.string(),
  scale: z.string(),
  healthTxt: z.string(),
  note: z.string().optional(),
  opened: z.string(),
  threat: z.enum(["strong", "moderate", "niche"]),
  // Clickable source links for human follow-up research (rendered in array order).
  links: z
    .array(
      z.object({
        kind: z.enum(["web", "ig", "fb", "tiktok", "maps", "order"]),
        url: z.string().url(),
      }),
    )
    .min(1),
  // Japan-tier only: why it made the cut — '✨ unique' idea vs '🌟 iconic' must-know.
  spotlight: z.enum(["unique", "iconic"]).optional(),
});

// Milk options for matcha lattes — a researched sourcing catalog (mirrors PowderSchema).
// `price` MUST carry a "₱NN/L" token; the card's per-liter / per-cup figures AND the
// calculator's milk dropdown are DERIVED from it (src/features/milks/pricing.js).
export const MilkSchema = z.object({
  cat: z.enum(["ph", "import", "authentic", "unique"]),
  catlabel: z.string(),
  star: z.boolean().optional(),
  name: z.string(),
  type: z.string(), // "Oat · barista" / "Fresh dairy · full cream" — shown as kicker
  origin: z.string(),
  taste: z.string(), // flavor + how it behaves in a matcha latte (foam / split risk)
  price: z.number().nonnegative(), // ₱ for the retail pack
  liters: z.number().positive(), // pack size in liters (0.37 = 370ml can); ₱/L + ≈₱/cup DERIVED
  hype: z.string(),
  buy: z.string(),
  url: z.string().url(),
});

// A priced, attachable add-on ingredient (strawberry, cream foam, …). Exactly two
// fields: name + a shared ₱/cup reference price (overridable in state). Matcha &
// milk are the dropdown selectors, not ingredients.
export const IngredientSchema = z.object({
  name: z.string(),
  price: z.number().nonnegative(), // market / reference ₱ per cup (shared)
});

export const DrinkSchema = z.object({
  name: z.string(),
  note: z.string(), // short subtitle
  desc: z.string().default(""), // long researched description (rendered under the pills)
  ingredients: z.array(z.string()).default([]), // attached add-on ingredient names
  srp: z.number().nonnegative(), // default selling price
});

// A self-hosted (or hotlinked) reference photo for a drink — rendered as a
// thumbnail that opens in a lightbox. `source` = the page it came from.
export const DrinkImageSchema = z.object({
  src: z
    .string()
    .refine((s) => /^(https?:\/\/|\/)/.test(s), "must be an absolute URL or a root-relative path"),
  source: z.string().url().nullable().default(null),
  credit: z.string().default(""), // author / license note for attribution
});

export const PricingSchema = z.object({
  packaging: z.number().nonnegative(), // ₱ per cup — cup + dome lid
  additional: z.number().nonnegative(), // ₱ per cup — ice, sugar, misc adjustments
});

// The whole config blob (the single seed object).
export const SiteDataSchema = z.object({
  events: z.array(EventSchema).min(1),
  // source links per event, keyed by event name (overlay, like powderImages)
  eventLinks: z.record(z.string(), z.array(LinkSchema)).default({}),
  powders: z.array(PowderSchema).min(1),
  competitors: z.array(CompetitorSchema).default([]),
  milks: z.array(MilkSchema).min(1),
  drinks: z.array(DrinkSchema).min(1),
  ingredients: z.array(IngredientSchema).min(1), // priced add-ons drinks attach (name + ₱)
  pricing: PricingSchema,
  // reference photos per drink, keyed by exact drink name (overlay, like powderImages)
  drinkImages: z.record(z.string(), z.array(DrinkImageSchema)).default({}),
  // absolute URL (hotlinked) or root-relative path (self-hosted under /public)
  powderImages: z.record(
    z.string(),
    z
      .string()
      .refine(
        (s) => /^(https?:\/\/|\/)/.test(s),
        "must be an absolute URL or a root-relative path",
      ),
  ),
  // brand logo per competitor, keyed by exact competitor name (overlay, like powderImages).
  // absolute URL (hotlinked) or root-relative path (self-hosted under /public). No entry ⇒ colored numbered circle.
  competitorImages: z
    .record(
      z.string(),
      z
        .string()
        .refine(
          (s) => /^(https?:\/\/|\/)/.test(s),
          "must be an absolute URL or a root-relative path",
        ),
    )
    .default({}),
  // product photo per milk, keyed by exact milk name (overlay, like powderImages).
  // absolute URL (hotlinked) or root-relative path (self-hosted under /public). No entry ⇒ colored circle.
  milkImages: z
    .record(
      z.string(),
      z
        .string()
        .refine(
          (s) => /^(https?:\/\/|\/)/.test(s),
          "must be an absolute URL or a root-relative path",
        ),
    )
    .default({}),
});

// ---- Expense-planner flexible-table shapes (Airtable-style, per-sheet columns) ----
// A cell value is one of three disjoint arms; empty cell ≡ absent key (no null).
const CellValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

// A select / multi-select option. `color` is a TOKEN NAME (e.g. "clay"), rendered
// as rgb(var(--c-clay)/α) — never a hardcoded hex.
const OptionSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  color: z.string().default(""),
});

// A user-defined column. `id` is immutable (cells key off it); `type` is immutable
// after creation. `number` is present only for type "number"; `options` only for
// "select"/"multiSelect".
const ColumnSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  type: z
    .enum(["text", "number", "date", "select", "multiSelect", "checkbox", "link", "lookup", "rollup"])
    .default("text"),
  width: z.number().default(160),
  number: z
    .object({
      style: z.enum(["plain", "currency"]).default("plain"),
      precision: z.number().int().min(0).max(4).default(0),
    })
    .optional(),
  options: z.array(OptionSchema).optional(),
  // Linked-record configs. PERMISSIVE (no cross-ref validation) — a dangling ref
  // (concurrent delete) must never throw here; derivation is defensive.
  link: z.object({ tableId: z.string(), pairColumnId: z.string(), single: z.boolean().default(false) }).optional(),
  lookup: z.object({ linkColumnId: z.string(), targetColumnId: z.string() }).optional(),
  rollup: z
    .object({
      linkColumnId: z.string(),
      targetColumnId: z.string().optional(),
      fn: z.enum(["sum", "count", "avg", "min", "max"]).default("count"),
    })
    .optional(),
});

// A saved view = a lens over its table's rows (filters + sorts + hidden fields).
// `op` is the COMPLETE de-duped union of every column type's operators — omitting
// one would brick shared getState when a stored view uses it. `value` reuses the
// permissive CellValue union and is absent for the valueless ops.
const FilterSchema = z.object({
  id: z.string(),
  columnId: z.string(),
  op: z.enum([
    "is", "isNot", "contains", "notContains", "isEmpty", "isNotEmpty", // text (+ shared is/isNot)
    "eq", "neq", "gt", "gte", "lt", "lte", // number
    "before", "after", // date
    "isAnyOf", // select multi-pick
    "hasAnyOf", "hasAllOf", "hasNoneOf", // multiSelect
    "isChecked", "isUnchecked", // checkbox
  ]),
  value: CellValue.optional(),
});
const SortSchema = z.object({
  columnId: z.string(),
  dir: z.enum(["asc", "desc"]).default("asc"),
});
const ViewSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  type: z.literal("grid").default("grid"),
  filters: z.array(FilterSchema).default([]),
  sorts: z.array(SortSchema).default([]),
  hiddenColumnIds: z.array(z.string()).default([]),
});

const ExpenseTabSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  columns: z.array(ColumnSchema).default([]), // the migration preprocess guarantees this is present
  views: z.array(ViewSchema).default([]), // the migration injects a default `view_all` on any tab without one
});

const ExpenseRowSchema = z.object({
  id: z.string(),
  tabId: z.string().default("default"),
  values: z.record(z.string(), CellValue).default({}), // { [columnId]: CellValue }; absent key = empty cell
});

// Shared mutable state (Redis `state` key) — one global record for everyone.
// Every field defaults, so an empty/fresh store parses cleanly. Wrapped below in a
// migration preprocess (StateSchema) that folds legacy expense rows/tabs into the
// columns+cells model before validation.
const StateInner = z.object({
  savedEvents: z.array(z.string()).default([]), // hearted events
  savedPowders: z.array(z.string()).default([]), // hearted powders
  savedMilks: z.array(z.string()).default([]), // hearted milks
  savedDrinks: z.array(z.string()).default([]), // hearted drinks (costed in calculator)
  savedCompetitors: z.array(z.string()).default([]), // hearted competitors
  srp: z.record(z.string(), z.number()).default({}), // drink name -> SRP override
  priceOverrides: z.record(z.string(), z.number()).default({}), // "ing:Name" | "matcha:Powder" | "milk:Label" -> unit price
  drinkIngredients: z.record(z.string(), z.array(z.string())).default({}), // drink name -> attached ingredient names (overrides seed)
  drinkBases: z
    .record(z.string(), z.object({ matcha: z.boolean(), milk: z.boolean() }).partial())
    .default({}), // drink name -> which base (matcha/milk) is removed (absent key = present)
  extraIngredients: z.record(z.string(), IngredientSchema.omit({ name: true })).default({}), // user-created: name -> { price }
  extraDrinks: z.record(z.string(), DrinkSchema.omit({ name: true })).default({}), // user-created drinks: name -> { note, desc, ingredients, srp }
  drinkOverrides: z
    .record(z.string(), DrinkSchema.pick({ note: true, desc: true }).partial())
    .default({}), // edits to a drink's text fields (seed or extra) -> { note?, desc? }
  costs: z
    .object({
      packaging: z.number().nonnegative(),
      additional: z.number().nonnegative(),
    })
    .partial()
    .default({}), // overrides of pricing defaults
  ingredientOverrides: z
    .record(z.string(), IngredientSchema.omit({ name: true }).partial())
    .default({}), // edits to a SEED ingredient's price (overlay) -> { price? }
  deletedIngredients: z.array(z.string()).default([]), // tombstoned SEED ingredient names (hidden from the catalog)
  powderOverrides: z
    .record(z.string(), PowderSchema.pick({ price: true, grams: true }).partial())
    .default({}), // edits to a powder's price/grams (overlay on seed) -> { price?, grams? }
  milkOverrides: z
    .record(z.string(), MilkSchema.pick({ price: true, liters: true }).partial())
    .default({}), // edits to a milk's price/liters (overlay on seed) -> { price?, liters? }
  // Expense-planner sheets/tabs — each owns an ordered `columns` array (per-sheet
  // schema). The migration preprocess injects the default columns onto legacy tabs.
  expenseTabs: z.array(ExpenseTabSchema).default([]),
  // Expense-planner rows — ordered array; each row is a { [columnId]: value } cell
  // map keyed by its tab's column ids. `id` is generated client-side. The
  // preprocess folds legacy { item, notes, date, price, qty } rows into `values`.
  expenses: z.array(ExpenseRowSchema).default([]),
});

// Public boundary schema: migrate the two expense keys (cross-field: columns live
// on tabs, cells key off them) BEFORE validation, then validate. Idempotent, so it
// runs safely on both getState (read) and writeState (write). All 17 other state
// fields pass through untouched.
export const StateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") raw = {};
  return { ...raw, ...normalizeExpenses(raw) };
}, StateInner);
