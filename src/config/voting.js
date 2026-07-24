import { z } from "zod";
import { redis } from "./redis";

// ============================================================================
// BRAND-NAME VOTE — a tiny, temporary single-pick poll, stored OUTSIDE the
// global `state` record (mirrors documents.js). One Redis HASH, `vote:ballots`:
//   field = voter name (trimmed)   value = the candidate they picked.
//
// A hash gives us two things for free: each ballot is an ATOMIC per-name write
// (many people can vote at once with no read-modify-write clobber), and the
// field-key naturally enforces ONE VOTE PER NAME — a re-vote just overwrites.
//
// No fallback, no silent errors: if Redis isn't configured we throw loudly.
// ============================================================================

// The candidates. Source of truth for both routes — edit this list to change
// the poll (the round-robin is gone; it's a straight "pick your favorite").
export const CANDIDATES = ["Emori", "Ember", "Patina"];

const KEY = "vote:ballots";

// Boundary validation. Names are trimmed + length-capped; the pick must be one
// of CANDIDATES. Bad input is rejected here, never coerced.
const NameSchema = z.string().trim().min(1, "Enter your name").max(60);
const CandidateSchema = z.enum(CANDIDATES);

function client() {
  if (!redis) {
    throw new Error(
      "Redis is not configured. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN " +
        "(or the KV_REST_API_* pair) in .env.local (dev) and the Vercel project env (prod). " +
        "The vote requires it — there is no local fallback.",
    );
  }
  return redis;
}

// Record one ballot. Returns the normalized name that was stored.
export async function castVote(name, candidate) {
  const voter = NameSchema.parse(name);
  const pick = CandidateSchema.parse(candidate);
  await client().hset(KEY, { [voter]: pick }); // overwrites any prior ballot by this name
  return voter;
}

// The live tally: per-candidate counts (in CANDIDATES order) + total ballots.
// Stray values not in CANDIDATES are ignored, so editing the list never breaks.
export async function getTally() {
  const ballots = (await client().hgetall(KEY)) ?? {};
  const counts = Object.fromEntries(CANDIDATES.map((c) => [c, 0]));
  for (const pick of Object.values(ballots)) {
    if (pick in counts) counts[pick] += 1;
  }
  const results = CANDIDATES.map((name) => ({ name, votes: counts[name] }));
  const total = results.reduce((sum, r) => sum + r.votes, 0);
  return { results, total };
}
