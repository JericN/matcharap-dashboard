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

**Shared state** — the saved selling prices and the ♥-selected powders are a
single centralized record (key **`state`** = `{ srp, saved }`), so *everyone
sees the same thing*. Reads come from Edge Config (`src/config/state.js`);
writes go through the Vercel API behind server actions (`src/config/actions.js`).
Locally, with no creds, it falls back to `.data/state.json` so dev still works.
Config still supplies the default SRPs.

### Setup

1. Create an Edge Config store in the Vercel dashboard and connect it to the
   project — this sets `EDGE_CONFIG` automatically (used for **reads**).
2. Add an item with key **`siteData`** whose value matches `seed`
   (`src/config/seed.js`) — the site content.
3. For **writes** (saving prices / selections), add two env vars:
   - `EDGE_CONFIG_ID` — the store id (`ecfg_…`)
   - `VERCEL_API_TOKEN` — a Vercel token with access (plus `VERCEL_TEAM_ID` if the project is in a team)
   The `state` key is created automatically on first save.

Missing keys fall back to defaults; `/events`, `/calculator`, `/powders` read
fresh each request so changes show up for all users.

---

## Deploy

Import the repo at **vercel.com → Add New → Project**. Vercel auto-detects
Next.js — no configuration needed.
