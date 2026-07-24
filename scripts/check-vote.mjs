// Pure test for the vote state machine — no Redis, no env. Run: node scripts/check-vote.mjs
import {
  initSession,
  applyReveal,
  applyNext,
  VOTERS,
} from "../src/config/voteMachine.mjs";

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.log("  ✗ " + msg);
  } else {
    console.log("  ✓ " + msg);
  }
}

// Build a ballots map {voter: picks[]} from a per-voter array of picks.
const ballots = (rows) => Object.fromEntries(VOTERS.map((v, i) => [v, rows[i]]));
// Close a round: reveal its ballots then advance.
const play = (session, rows) => applyNext(applyReveal(session, ballots(rows)));

const C = ["Emori", "Ember", "Patina", "Verde"];

// ── Scenario A: clean run, no ties → Emori wins ───────────────────────────
console.log("Scenario A — clean run");
{
  let s = initSession(C); // R1 pick 3 of 4
  assert(s.pick === 3 && s.candidates.length === 4, "R1 asks pick 3 of 4");
  // Verde is left out by 4 voters → fewest, removed
  s = play(s, [
    ["Emori", "Ember", "Patina"],
    ["Emori", "Ember", "Patina"],
    ["Emori", "Ember", "Patina"],
    ["Emori", "Ember", "Verde"],
    ["Emori", "Ember", "Patina"],
  ]);
  assert(s.log[0].removed === "Verde", "R1 removes Verde (fewest)");
  assert(s.pick === 2 && s.candidates.length === 3, "R2 asks pick 2 of 3");
  // Patina fewest → removed
  s = play(s, [
    ["Emori", "Ember"],
    ["Emori", "Ember"],
    ["Emori", "Ember"],
    ["Emori", "Patina"],
    ["Emori", "Ember"],
  ]);
  assert(s.log[1].removed === "Patina", "R2 removes Patina (fewest)");
  assert(s.pick === 1 && s.candidates.length === 2, "Final asks pick 1 of 2");
  // Emori 3, Ember 2 → Emori wins
  s = play(s, [["Emori"], ["Emori"], ["Emori"], ["Ember"], ["Ember"]]);
  assert(s.phase === "finished", "reaches finished");
  assert(s.winner === "Emori", "winner is Emori (3/5 majority)");
  assert(s.log.length === 3, "3 rounds logged");
}

// ── Scenario B: tie for last in R1 → tie-breaker → Emori wins ─────────────
console.log("Scenario B — tie-breaker");
{
  let s = initSession(C);
  // left out: Verde x2, Patina x2, Ember x1 → counts Emori5 Ember4 Patina3 Verde3
  s = play(s, [
    ["Emori", "Ember", "Patina"], // out: Verde
    ["Emori", "Ember", "Verde"], // out: Patina
    ["Emori", "Ember", "Patina"], // out: Verde
    ["Emori", "Ember", "Verde"], // out: Patina
    ["Emori", "Patina", "Verde"], // out: Ember
  ]);
  assert(s.roundType === "tiebreak", "R1 tie → tie-breaker opens");
  assert(
    s.candidates.length === 2 && s.candidates.includes("Patina") && s.candidates.includes("Verde"),
    "tie-breaker is Patina vs Verde",
  );
  assert(s.log[0].tie && s.log[0].removed === null, "R1 logged as an unresolved tie");
  // keep: Patina 3, Verde 2 → Verde least-kept → removed
  s = play(s, [["Patina"], ["Patina"], ["Patina"], ["Verde"], ["Verde"]]);
  assert(s.log[1].roundType === "tiebreak" && s.log[1].removed === "Verde", "tie-breaker drops Verde");
  assert(s.candidates.length === 3, "back to a 3-name main round");
  // Ember fewest → removed
  s = play(s, [
    ["Emori", "Patina"],
    ["Emori", "Patina"],
    ["Emori", "Patina"],
    ["Emori", "Ember"],
    ["Emori", "Patina"],
  ]);
  assert(s.log[2].removed === "Ember", "R2 removes Ember");
  s = play(s, [["Emori"], ["Emori"], ["Emori"], ["Patina"], ["Patina"]]);
  assert(s.winner === "Emori" && s.phase === "finished", "winner is Emori after tie-breaker");
  assert(s.log.length === 4, "4 rounds logged (incl. tie-breaker)");
}

// ── Scenario C: 3-way tie forces the tie-breaker to recurse ───────────────
console.log("Scenario C — recursive tie-breaker");
{
  // Craft a revealed main round where B,C,D all tie for last.
  const revealed = {
    ...initSession(["A", "B", "C", "D"]),
    counts: { A: 5, B: 1, C: 1, D: 1 },
    currentVotes: {},
    phase: "revealed",
  };
  let s = applyNext(revealed);
  assert(
    s.roundType === "tiebreak" && s.candidates.length === 3,
    "3-way tie opens a 3-name tie-breaker",
  );
  // keeps: B1 C1 D3 → B,C still tie for least-kept → recurse to a 2-name break
  s = applyNext({ ...s, counts: { B: 1, C: 1, D: 3 }, currentVotes: {}, phase: "revealed" });
  assert(
    s.roundType === "tiebreak" && s.candidates.length === 2,
    "still-tied → recurses to a 2-name tie-breaker",
  );
  // keeps: B3 C2 → C least-kept → removed, exactly one eliminated
  s = applyNext({ ...s, counts: { B: 3, C: 2 }, currentVotes: {}, phase: "revealed" });
  assert(!s.alive.includes("C") && s.alive.length === 3, "exactly one (C) removed after recursion");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
