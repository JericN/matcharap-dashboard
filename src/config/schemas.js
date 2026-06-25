import { z } from "zod";

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
  price: z.string(),
  serving: z.string(),
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

export const MilkOptionSchema = z.object({ l: z.string(), ml: z.number().positive() });

// A priced, attachable add-on ingredient (strawberry, cream foam, …) — one
// self-contained object: emoji + market price (₱/cup reference, overridable in
// state) + an optional reference link. Matcha & milk are the dropdown selectors,
// not ingredients. May be created partially-filled (e.g. no link yet).
export const IngredientSchema = z.object({
  name: z.string(),
  emoji: z.string().default(""),
  price: z.number().nonnegative(), // market / reference ₱ per cup
  link: z.string().url().nullable().default(null), // reference source URL (optional)
});

export const DrinkSchema = z.object({
  name: z.string(),
  note: z.string(), // short subtitle
  desc: z.string().default(""), // long researched description (rendered under the pills)
  milkMl: z.number().nonnegative(), // milk volume per cup
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
  milkOptions: z.array(MilkOptionSchema).min(1),
  drinks: z.array(DrinkSchema).min(1),
  ingredients: z.array(IngredientSchema).min(1), // priced add-ons drinks attach (each carries its own link)
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
});

// Shared mutable state (Redis `state` key) — one global record for everyone.
// Every field defaults, so an empty/fresh store parses cleanly.
export const StateSchema = z.object({
  savedEvents: z.array(z.string()).default([]), // hearted events
  savedPowders: z.array(z.string()).default([]), // hearted powders
  savedDrinks: z.array(z.string()).default([]), // hearted drinks (costed in calculator)
  savedCompetitors: z.array(z.string()).default([]), // hearted competitors
  srp: z.record(z.string(), z.number()).default({}), // drink name -> SRP override
  priceOverrides: z.record(z.string(), z.number()).default({}), // "ing:Name" | "matcha:Powder" | "milk:Label" -> unit price
  drinkIngredients: z.record(z.string(), z.array(z.string())).default({}), // drink name -> attached ingredient names (overrides seed)
  drinkBases: z
    .record(z.string(), z.object({ matcha: z.boolean(), milk: z.boolean() }).partial())
    .default({}), // drink name -> which base (matcha/milk) is removed (absent key = present)
  extraIngredients: z.record(z.string(), IngredientSchema.omit({ name: true })).default({}), // user-created: name -> { emoji, price, link }
  extraDrinks: z.record(z.string(), DrinkSchema.omit({ name: true })).default({}), // user-created drinks: name -> { note, desc, milkMl, ingredients, srp }
  drinkOverrides: z
    .record(z.string(), DrinkSchema.pick({ note: true, desc: true, milkMl: true }).partial())
    .default({}), // edits to a drink's text/milk fields (seed or extra) -> { note?, desc?, milkMl? }
  costs: z
    .object({
      packaging: z.number().nonnegative(),
      additional: z.number().nonnegative(),
    })
    .partial()
    .default({}), // overrides of pricing defaults
});
