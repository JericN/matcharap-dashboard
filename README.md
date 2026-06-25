# Matcharap Eto · Vendor Board

A one-stop board for running a matcha pop-up booth in Metro Manila — pop-up
**events**, a drink **cost calculator**, a matcha **powder sourcing guide**, a
**drink menu**, and a **competitor** scan.

Built with **Next.js (App Router)**, **Tailwind**, **Zod**, and **Upstash Redis**.

---

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (runs the Zod parse → catches bad data)
npm run check:redis  # verify the Upstash connection (set→get→del round-trip)
```

The landing/content renders from the bundled seed with no setup. The pages that
read **shared saved state** (`/events`, `/powders`, `/drinks`, `/calculator`)
need Upstash Redis credentials in `web/.env.local` — without them those pages
error (there is no local fallback). See **Shared state** below.

---

## Architecture

Two layers with a hard validation boundary between them.

```
src/
  config/                 ← LAYER 1 — produces validated data; the only data boundary
    schemas.js            Zod schemas (single source of truth for shapes)
    seed.js               all content (events, powders, drinks, competitors, …)
    store.js              getSiteData(): Zod-parses seed, memoized per request
    redis.js              Upstash client (null when unconfigured)
    state.js              getState()/writeState(): the shared `state` record in Redis
    repo.js               the DAL — the single interface the app reads/writes through
    actions.js            'use server' wrappers (client → repo) + revalidatePath
  features/               ← LAYER 2 — trusts validated data, renders + interactivity
    events/ calculator/ powders/ drinks/ competitors/
  components/             shared UI (Navbar, Hero, Footer, SectionHeader, SaveButton, form/, icons, Doodles)
  app/                    routes: / · /events · /calculator · /powders · /drinks · /competitors
```

- **Layer 1 validates everything** (Zod) at the boundary, once, memoized per request.
- **Layer 2 assumes data is valid** — no defensive re-checks.
- **Server components read** (`await repo.*()`); **client components** (grids,
  calculator) handle interactivity and call server actions to persist.

---

## Theming

The entire palette is a **single block of CSS variables** in
`src/app/globals.css` (`:root`), exposed to Tailwind via `tailwind.config.js` as
`rgb(var(--c-*) / <alpha-value>)`.

- **Reskin the whole site** → edit those values. Every utility (`bg-forest`,
  `text-clay`, `bg-matcha-bright/10`), every `@apply` class, and every component
  follows.
- Fonts / radii / shadows live in `tailwind.config.js` → `theme.extend`.
- The hand-drawn mascot/logo SVGs keep their own illustration colours by design.

---

## Data

All content (events, eventLinks, powders, powderImages, competitors, milkOptions,
drinks, drinkImages, ingredients, pricing) lives in **`src/config/seed.js`** and
is validated by `SiteDataSchema`. `store.js` Zod-parses the seed; content edits go
through `seed.js` + a redeploy.

## Shared state (Upstash Redis)

The mutable, everyone-sees-the-same data — saved events/powders/drinks, SRP &
price overrides, drink↔ingredient attachments, base toggles, user-added
ingredients, packaging/additional cost overrides — is one record under the Redis
**`state`** key. It's read/written in `state.js` via the client in `redis.js`,
behind server actions (`actions.js`).

> Why Redis (not Edge Config): Edge Config's free tier caps writes at ~250/month
> — far too low for interactive saves. Upstash free is 256 MB / 500K commands/mo.

### Setup

1. Provision **Upstash for Redis** (Vercel → Storage → Marketplace, or the
   Upstash console). Free tier is plenty.
2. Set both in `web/.env.local` (local) **and** the Vercel project env (prod):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
     (`KV_REST_API_URL` / `KV_REST_API_TOKEN` are also accepted.)
3. Restart `npm run dev` / redeploy. Verify with `npm run check:redis`.

`/events`, `/powders`, `/drinks`, `/calculator` are `force-dynamic` so saved
state is read fresh each request and shows up for everyone.

---

## Deploy

Import the repo at **vercel.com → Add New → Project** (auto-detects Next.js), add
the two `UPSTASH_REDIS_REST_*` env vars, and deploy.
