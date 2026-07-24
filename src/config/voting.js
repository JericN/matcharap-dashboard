import { z } from "zod";
import { redis } from "./redis";
import {
  VOTERS,
  idleSession,
  initSession,
  applyReveal,
  applyNext,
  currentLabel,
} from "./voteMachine.mjs";

// ============================================================================
// LIVE BRAND-NAME VOTE — shared session state, stored OUTSIDE the global
// `state` record. Two kinds of keys:
//   vote:session          — ONE JSON record: phase, current round, alive set,
//                           per-round log, winner. Mutated only by the host
//                           actions (start/reveal/next/reset) → no write races.
//   vote:ballots:<rNN>    — a Redis HASH per round, field = voter, value =
//                           "Name|Name|Name". Each voter's submit is an atomic
//                           hset, so 5 people voting at once never clobber, and
//                           x/5 = HLEN. Read + folded into the log on reveal.
//
// No fallback: if Redis isn't configured we throw loudly. Candidates are a const
// below — the 4th ("Verde") is a PLACEHOLDER; swap it for the real 4th name.
// ============================================================================

export const CANDIDATES = ["Emori", "Ember", "Patina", "Verde"];
export { VOTERS };

const SKEY = "vote:session";
const ballotsKey = (roundKey) => "vote:ballots:" + roundKey;
const SEP = "|";

const PicksSchema = z.array(z.string());
const RoundLogSchema = z.object({
  roundNo: z.number(),
  roundType: z.enum(["main", "tiebreak"]),
  candidates: z.array(z.string()),
  pick: z.number(),
  votes: z.record(PicksSchema),
  counts: z.record(z.number()),
  note: z.string(),
  removed: z.string().nullable().default(null),
  winner: z.string().nullable().default(null),
  finalists: z.array(z.string()).nullable().default(null),
  tie: z.array(z.string()).nullable().default(null),
});
const SessionSchema = z.object({
  phase: z.enum(["idle", "voting", "revealed", "finished"]),
  roundNo: z.number(),
  roundKey: z.string(),
  roundType: z.enum(["main", "tiebreak"]),
  candidates: z.array(z.string()),
  pick: z.number(),
  alive: z.array(z.string()),
  counts: z.record(z.number()).nullable().default(null),
  currentVotes: z.record(PicksSchema).nullable().default(null),
  log: z.array(RoundLogSchema).default([]),
  winner: z.string().nullable().default(null),
});

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

async function readSession() {
  const raw = await client().get(SKEY);
  return raw ? SessionSchema.parse(raw) : idleSession();
}
async function writeSession(next) {
  const value = SessionSchema.parse(next);
  await client().set(SKEY, value);
  return value;
}

// The one read every page uses. Adds who has voted this round (x/5).
export async function getVoteState() {
  const session = await readSession();
  let voted = [];
  if (session.phase === "voting" && session.roundKey) {
    voted = (await client().hkeys(ballotsKey(session.roundKey))) ?? [];
  }
  return {
    session,
    voters: VOTERS,
    voted,
    votedCount: voted.length,
    label: currentLabel(session),
  };
}

// Host: open Round 1.
export async function start() {
  const s = initSession(CANDIDATES);
  await client().del(ballotsKey(s.roundKey));
  return writeSession(s);
}

// Voter: record exactly `pick` valid, distinct names for the open round.
export async function submit(voter, picks) {
  if (!VOTERS.includes(voter)) throw new Error("Unknown voter");
  const session = await readSession();
  if (session.phase !== "voting") throw new Error("No round is open");
  const valid = [...new Set(picks.filter((p) => session.candidates.includes(p)))];
  if (valid.length !== session.pick) throw new Error(`Pick exactly ${session.pick}`);
  await client().hset(ballotsKey(session.roundKey), { [voter]: valid.join(SEP) });
  return valid;
}

// Host: close the open round and reveal its tally.
export async function reveal() {
  const session = await readSession();
  if (session.phase !== "voting") return session;
  const raw = (await client().hgetall(ballotsKey(session.roundKey))) ?? {};
  const ballots = {};
  for (const [voter, val] of Object.entries(raw)) {
    ballots[voter] = String(val).split(SEP).filter(Boolean);
  }
  return writeSession(applyReveal(session, ballots));
}

// Host: advance — eliminate / start the next round / crown the winner.
export async function next() {
  const session = await readSession();
  if (session.phase !== "revealed") return session;
  const advanced = applyNext(session);
  if (advanced.phase === "voting") await client().del(ballotsKey(advanced.roundKey));
  return writeSession(advanced);
}

// Host: wipe everything back to idle (clears all round ballots).
export async function reset() {
  const session = await readSession();
  const maxRound = Math.max(session.roundNo, 12);
  for (let i = 1; i <= maxRound; i++) await client().del(ballotsKey("r" + i));
  return writeSession(idleSession());
}
