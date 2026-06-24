import { get } from '@vercel/edge-config';
import { z } from 'zod';

// ============================================================================
// SHARED STATE — one centralized record for everyone (NOT per-user).
// Lives under the Edge Config `state` key: the saved selling prices and the
// selected powders. Reads come from Edge Config; writes go through the Vercel
// API. Locally (no creds) it falls back to .data/state.json so dev still works.
// ============================================================================

const StateSchema = z.object({
  srp: z.record(z.string(), z.number()), // drink name -> selling price
  saved: z.array(z.string()),            // selected powder names
});
const DEFAULT = { srp: {}, saved: [] };
const FILE = '.data/state.json';

const canEdgeWrite = () => !!(process.env.EDGE_CONFIG_ID && process.env.VERCEL_API_TOKEN);

export async function getState() {
  if (process.env.EDGE_CONFIG) {
    const value = await get('state');
    return StateSchema.parse(value ?? DEFAULT);
  }
  try {
    const fs = await import('node:fs/promises');
    return StateSchema.parse(JSON.parse(await fs.readFile(FILE, 'utf8')));
  } catch {
    return DEFAULT;
  }
}

export async function writeState(next) {
  const value = StateSchema.parse(next);
  if (canEdgeWrite()) {
    const team = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
    const res = await fetch(`https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items${team}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ operation: 'upsert', key: 'state', value }] }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Edge Config write failed (${res.status})`);
    return value;
  }
  const fs = await import('node:fs/promises');
  await fs.mkdir('.data', { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(value, null, 2));
  return value;
}
