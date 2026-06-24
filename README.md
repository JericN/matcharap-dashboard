# Matcharap Eto · Vendor Board

A one-stop board for running a matcha pop-up booth in Metro Manila — upcoming
**events**, a drink **cost calculator**, and a matcha **powder sourcing guide**.
A BriarBear project.

Built with **Next.js (App Router)**, **Tailwind**, **Zod**, and **Vercel Edge Config**.

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

No env vars are required for local dev — the app falls back to the bundled seed
data (see *Data* below).

---

## Architecture

Two layers, with a hard validation boundary between them.

```
src/
  config/                 ← LAYER 1 — the only place that loads & validates data
    schemas.js            Zod schemas (the single source of truth for shapes)
    seed.js               local data, used when Edge Config isn't connected
    store.js              getSiteData(): Edge Config → else seed, Zod-parsed once
  features/               ← LAYER 2 — trusts validated data, just renders
    events/               EventsGrid (filter) + EventCard
    calculator/           Calculator (state) + cost.js (pure pricing math)
    powders/              PowderGrid (filter) + PowderCard
  components/             shared UI (Navbar, Hero, Footer, SectionHeader, icons, Doodles)
  app/                    routes: / (landing) · /events · /calculator · /powders
```

- **Layer 1 validates everything** (Zod) at the data boundary, once, and caches.
- **Layer 2 assumes data is valid** — no defensive checks, no fallbacks.
- **Server components fetch + validate** (`await getSiteData()`); **client components**
  (grids, calculator) only handle interactivity.

---

## Theming

The entire palette is a **single block of CSS variables** in
`src/app/globals.css` (`:root`), exposed to Tailwind via
`tailwind.config.js` as `rgb(var(--c-*) / <alpha-value>)`.

```css
:root {
  --c-forest: 63 80 49;     /* RGB channel triplets (work with /opacity) */
  --c-clay:   185 84 45;
  --c-cream:  239 231 211;
  ...
}
```

- **Reskin the whole site** → edit those values. Every Tailwind utility
  (`bg-forest`, `text-clay`, `bg-matcha-bright/10`), every `@apply` class, and
  every component updates automatically.
- Fonts / radii / shadows live in `tailwind.config.js` → `theme.extend`.
- The hand-drawn mascot/logo SVGs keep their own illustration colours by design.

---

## Data (Vercel Edge Config)

All content (events, powders, drinks, pricing, ingredients, images) is config,
validated by `SiteDataSchema`. The store reads it from **Vercel Edge Config**
when connected, otherwise from `src/config/seed.js`.

To use Edge Config in production:

1. Create an Edge Config store in the Vercel dashboard and connect it to the
   project (this sets the `EDGE_CONFIG` env var automatically).
2. Add one item with key **`siteData`** whose value is the same shape as
   `seed` (export it from `src/config/seed.js`).
3. Deploys then read live data from Edge Config; editing it updates the site
   without a code change. If the key is missing, it falls back to the seed.

---

## Deploy

Import the repo at **vercel.com → Add New → Project**. Vercel auto-detects
Next.js — no configuration needed.
