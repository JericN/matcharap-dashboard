import { get } from '@vercel/edge-config';
import { SiteDataSchema } from './schemas';
import { seed } from './seed';

// ============================================================================
// LAYER 1 — the only place that talks to the data source and validates it.
// Reads Vercel Edge Config when connected (EDGE_CONFIG env), else the local
// seed. Whatever the source, it is Zod-parsed here, so every consumer above
// this line receives guaranteed-valid data and never needs to re-check.
// ============================================================================

let cache;

async function loadRaw() {
  if (!process.env.EDGE_CONFIG) return seed;
  const fromEdge = await get('siteData');
  return fromEdge ?? seed;
}

export async function getSiteData() {
  if (cache) return cache;
  cache = SiteDataSchema.parse(await loadRaw());
  return cache;
}
