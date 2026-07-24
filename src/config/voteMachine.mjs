// ============================================================================
// VOTE MACHINE — pure, dependency-free reducer for the live brand-name vote.
//
// Protocol (5 voters, no abstain, 4 candidates):
//   Round 1: pick 3 of 4  → drop the fewest        → 3 left
//   Round 2: pick 2 of 3  → drop the fewest        → 2 left
//   Final:   pick 1 of 2  → most votes wins (5 voters ⇒ always a 3/5+ majority)
//   Tie for fewest ⇒ a tie-breaker sub-round: pick 1 to keep among the tied
//     names; the least-kept is dropped. If the tie-breaker itself ties, it
//     recurses on the still-tied names until exactly one is removed.
//
// A "main" round always asks for (candidates − 1) picks = "leave out one".
// Shared verbatim by the DAL (src/config/voting.js) and the Node test
// (scripts/check-vote.mjs). No I/O here.
// ============================================================================

export const VOTERS = ["jeric", "jade", "mikan", "bea", "tin"];

function fewest(candidates, counts) {
  const min = Math.min(...candidates.map((c) => counts[c] ?? 0));
  return candidates.filter((c) => (counts[c] ?? 0) === min);
}
function most(candidates, counts) {
  const max = Math.max(...candidates.map((c) => counts[c] ?? 0));
  return candidates.filter((c) => (counts[c] ?? 0) === max);
}

// Human label for whatever round is currently open (or the terminal states).
export function currentLabel(session) {
  if (session.phase === "idle") return "Not started";
  if (session.phase === "finished") return "Finished";
  if (session.roundType === "tiebreak")
    return `Tie-breaker · pick 1 to keep · ${session.candidates.join(" vs ")}`;
  const n = session.candidates.length;
  const which = n >= 4 ? "Round 1" : n === 3 ? "Round 2" : "Final round";
  return `${which} · pick ${session.pick} of ${n}`;
}

export function idleSession() {
  return {
    phase: "idle",
    roundNo: 0,
    roundKey: "",
    roundType: "main",
    candidates: [],
    pick: 0,
    alive: [],
    counts: null,
    currentVotes: null,
    log: [],
    winner: null,
  };
}

export function initSession(candidates) {
  return {
    phase: "voting",
    roundNo: 1,
    roundKey: "r1",
    roundType: "main",
    candidates: [...candidates],
    pick: candidates.length - 1,
    alive: [...candidates],
    counts: null,
    currentVotes: null,
    log: [],
    winner: null,
  };
}

// Tally: for each candidate, how many voters included it in their picks.
export function computeCounts(candidates, ballots) {
  const counts = Object.fromEntries(candidates.map((c) => [c, 0]));
  for (const picks of Object.values(ballots)) {
    for (const p of picks) if (p in counts) counts[p] += 1;
  }
  return counts;
}

// voting → revealed: attach the tally + the raw ballots (for the results page).
export function applyReveal(session, ballots) {
  return {
    ...session,
    counts: computeCounts(session.candidates, ballots),
    currentVotes: ballots,
    phase: "revealed",
  };
}

function entry(session, extra) {
  return {
    roundNo: session.roundNo,
    roundType: session.roundType,
    candidates: [...session.candidates],
    pick: session.pick,
    votes: session.currentVotes ?? {},
    counts: session.counts ?? {},
    note: currentLabel(session),
    removed: null,
    winner: null,
    finalists: null,
    tie: null,
    ...extra,
  };
}

function openMainRound(session, roundNo) {
  const candidates = [...session.alive];
  return {
    ...session,
    phase: "voting",
    roundNo,
    roundKey: "r" + roundNo,
    roundType: "main",
    candidates,
    pick: candidates.length - 1,
    counts: null,
    currentVotes: null,
  };
}

function openTiebreak(session, roundNo, tied) {
  return {
    ...session,
    phase: "voting",
    roundNo,
    roundKey: "r" + roundNo,
    roundType: "tiebreak",
    candidates: [...tied],
    pick: 1,
    counts: null,
    currentVotes: null,
  };
}

// revealed → next voting round OR finished. Pushes the just-closed round to the
// log with its resolution (who was removed / who won).
export function applyNext(session) {
  const { candidates, counts, roundType } = session;
  const nextNo = session.roundNo + 1;

  // FINAL: a main round on the last 2 candidates — most votes wins outright.
  if (roundType === "main" && candidates.length === 2) {
    const top = most(candidates, counts);
    const winner = top.length === 1 ? top[0] : null; // 5 no-abstain voters ⇒ unique
    const log = [
      ...session.log,
      entry(session, { winner, finalists: top.length === 1 ? null : top }),
    ];
    return { ...session, phase: "finished", winner, counts: null, currentVotes: null, log };
  }

  const tied = fewest(candidates, counts);

  if (roundType === "main") {
    if (tied.length === 1) {
      const loser = tied[0];
      const alive = session.alive.filter((x) => x !== loser);
      const log = [...session.log, entry(session, { removed: loser })];
      return openMainRound({ ...session, alive, log }, nextNo);
    }
    // tie for last → resolve with a tie-breaker among the tied names
    const log = [...session.log, entry(session, { tie: tied })];
    return openTiebreak({ ...session, log }, nextNo, tied);
  }

  // tiebreak: counts are "keeps"; the least-kept is the loser.
  const loserSet = fewest(candidates, counts);
  if (loserSet.length === 1) {
    const loser = loserSet[0];
    const alive = session.alive.filter((x) => x !== loser);
    const log = [...session.log, entry(session, { removed: loser })];
    return openMainRound({ ...session, alive, log }, nextNo);
  }
  // still tied → recurse on the still-tied names
  const log = [...session.log, entry(session, { tie: loserSet })];
  return openTiebreak({ ...session, log }, nextNo, loserSet);
}
