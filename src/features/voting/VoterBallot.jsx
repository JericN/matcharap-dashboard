"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePoll } from "./usePoll";
import CountBars from "./CountBars";
import { voteSubmit } from "@/config/actions";

// A single voter's page (/vote/<name>). Reflects the shared round; lets them
// pick and submit; shows the anonymized round summary; then waits.
export default function VoterBallot({ voter, state }) {
  const router = useRouter();
  const { session, voted, votedCount, voters } = state;
  const phase = session.phase;
  usePoll(phase !== "finished");

  const roundKey = session.roundKey;
  const need = session.pick;
  const isTie = session.roundType === "tiebreak";

  const [picks, setPicks] = useState([]);
  const [continued, setContinued] = useState(false);
  const [submittedRound, setSubmittedRound] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // New round (or reveal) → reset the per-round local UI.
  useEffect(() => {
    setPicks([]);
    setContinued(false);
    setError("");
  }, [roundKey, phase]);

  const hasVoted = voted.includes(voter) || submittedRound === roundKey;

  function toggle(name) {
    setPicks((cur) => {
      if (cur.includes(name)) return cur.filter((x) => x !== name);
      if (cur.length >= need) return cur; // can't exceed the required count
      return [...cur, name];
    });
  }

  async function submit() {
    if (picks.length !== need || busy) return;
    setBusy(true);
    setError("");
    try {
      await voteSubmit(voter, picks);
      setSubmittedRound(roundKey);
      router.refresh();
    } catch {
      setError("Couldn't submit — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paper-card !static max-w-[480px] mx-auto p-6 max-md:p-5 gap-4">
      <div className="flex items-center justify-between">
        <span className="font-doodle text-[1.2rem] text-forest capitalize">Hi, {voter} 👋</span>
        <span className="font-mono text-[.6rem] uppercase tracking-[.08em] text-brown">
          {votedCount}/{voters.length} voted
        </span>
      </div>

      {phase === "idle" && <Waiting>Waiting for the host to start the vote…</Waiting>}

      {phase === "voting" &&
        (hasVoted ? (
          <Waiting>
            ✓ Your vote is in. Waiting for the others… ({votedCount}/{voters.length})
          </Waiting>
        ) : (
          <>
            <div>
              <div className="font-mono text-[.66rem] uppercase tracking-[.1em] text-clay">
                {state.label}
              </div>
              <div className="text-[.85rem] text-olive-soft mt-1">
                {isTie
                  ? "Tie-breaker — tap the ONE name you want to keep."
                  : `Tap exactly ${need} name${need > 1 ? "s" : ""}.`}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {session.candidates.map((c) => {
                const on = picks.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(c)}
                    aria-pressed={on}
                    className={`rounded-card border-[2.2px] shadow-hard-sm px-4 py-4 text-center font-doodle text-[1.4rem] leading-none transition-colors ${
                      on
                        ? "bg-forest border-forest text-cream-light"
                        : "bg-cream-card border-forest text-forest hover:bg-cream-light"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {error && <p className="font-mono text-[.7rem] text-clay">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={picks.length !== need || busy}
              className="font-mono text-[.72rem] tracking-[.06em] uppercase text-cream-light bg-forest rounded-[12px_9px_13px_9px] px-5 py-3 shadow-hard-sm transition-colors hover:bg-olive disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Submitting…" : `Submit vote  ·  ${picks.length}/${need}`}
            </button>
          </>
        ))}

      {phase === "revealed" &&
        (continued ? (
          <Waiting>Waiting for the next round…</Waiting>
        ) : (
          <>
            <div className="font-mono text-[.66rem] uppercase tracking-[.1em] text-clay">
              Round results
            </div>
            <CountBars counts={session.counts ?? {}} />
            <button
              type="button"
              onClick={() => setContinued(true)}
              className="font-mono text-[.72rem] tracking-[.06em] uppercase text-cream-light bg-forest rounded-[12px_9px_13px_9px] px-5 py-3 shadow-hard-sm transition-colors hover:bg-olive"
            >
              Continue →
            </button>
          </>
        ))}

      {phase === "finished" && (
        <div className="text-center py-4">
          {session.winner ? (
            <>
              <div className="text-4xl">🏆</div>
              <div className="font-doodle font-bold text-[1.9rem] text-forest leading-tight mt-1">
                {session.winner}
              </div>
              <div className="font-mono text-[.6rem] uppercase tracking-[.1em] text-brown mt-1">
                the winning name
              </div>
            </>
          ) : (
            <div className="font-doodle text-[1.2rem] text-forest">
              It&apos;s a tie — the host will discuss the finalists.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Waiting({ children }) {
  return <p className="text-center text-[.9rem] text-olive-soft py-5">{children}</p>;
}
