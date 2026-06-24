import { z } from 'zod';

// ---- Domain schemas. This file is the single source of truth for shapes. ----

export const VendorSchema = z.object({
  c: z.enum(['open', 'warn', 'wait']), // status colour: open / nearly-full / watch
  ic: z.string(), // emoji
  t: z.string(), // vendor-call note
});

export const EventSchema = z.object({
  name: z.string(),
  org: z.string(),
  tags: z.array(z.enum(['upcoming', 'recurring', 'star'])),
  status: z.tuple([z.string(), z.string()]), // [label, pill-class]
  star: z.boolean().optional(),
  theme: z.string(),
  date: z.string(),
  venue: z.string(),
  size: z.string(),
  people: z.string(),
  vendor: VendorSchema,
});

export const PowderSchema = z.object({
  cat: z.enum(['ph', 'jp', 'import']),
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

// Indie matcha-drink competitors (Metro Manila). Ratings/open-status are
// Google-Maps-verified; follower counts are research-sourced.
export const CompetitorSchema = z.object({
  rank: z.number().int().positive(),
  name: z.string(),
  region: z.enum(['north', 'central', 'south']),
  format: z.string(),
  area: z.string(),
  price: z.number().nonnegative(),        // signature ~16oz matcha latte, PHP
  band: z.enum(['budget', 'mid', 'premium']),
  rating: z.number(),                     // Google Maps stars
  reviews: z.number().int().nonnegative(),
  open: z.boolean(),                      // currently operating
  ig: z.number().int().nullable(),        // Instagram followers (research-sourced)
  tt: z.number().int().nullable(),        // TikTok followers
  sig: z.string(),
  menu: z.array(z.object({ i: z.string(), p: z.number().nullable() })),
  sourcing: z.string(),
  hook: z.string(),
  scale: z.string(),
  channels: z.string(),
  health: z.enum(['go', 'warn', 'wait']),
  healthTxt: z.string(),
  note: z.string().optional(),
  // Clickable channels for human follow-up research (rendered in array order).
  links: z.array(z.object({
    kind: z.enum(['web', 'ig', 'fb', 'tiktok', 'maps', 'order']),
    url: z.string().url(),
  })).min(1),
  star: z.boolean().optional(),
});

export const MilkOptionSchema = z.object({ l: z.string(), ml: z.number().positive() });

export const DrinkSchema = z.object({
  name: z.string(),
  note: z.string(),
  flavor: z.string(),
  milkMl: z.number().nonnegative(),
  fl: z.number().nonnegative(), // flavour add-on cost
  srp: z.number().nonnegative(), // default selling price
});

export const IngredientSchema = z.object({
  il: z.string(), // label
  iv: z.string(), // value
  url: z.string().url(),
});

export const PricingSchema = z.object({
  extras: z.number().nonnegative(), // cup + lid + ice + sugar per cup
});

// The whole config blob (one Edge Config key / one seed object).
export const SiteDataSchema = z.object({
  events: z.array(EventSchema).min(1),
  powders: z.array(PowderSchema).min(1),
  competitors: z.array(CompetitorSchema).default([]),
  // matchaOptions is no longer stored — the calculator derives it from `powders`
  // (single source of truth) in app/calculator/page.js.
  milkOptions: z.array(MilkOptionSchema).min(1),
  drinks: z.array(DrinkSchema).min(1),
  ingredients: z.array(IngredientSchema).min(1),
  pricing: PricingSchema,
  powderImages: z.record(z.string(), z.string().url()),
});

// Shared mutable state (Edge Config `state` key) — saved prices + selections.
export const StateSchema = z.object({
  srp: z.record(z.string(), z.number()), // drink name -> selling price
  saved: z.array(z.string()),            // selected powder names
});
