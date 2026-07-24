"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePoll } from "./usePoll";
import CountBars from "./CountBars";
import { voteStart, voteReveal, voteNext, voteReset } from "@/config/actions";

// The host page (/vote): share links, start, drive each round, reset.
export default function HostConsole({ state }) {
  const router = useRouter();
  const { session, voters, voted, votedCount } = state;
  const phase = session.phase;
  usePoll(phase !== "finished");

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function run(fn) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  function copy(name) {
    navigator.clipboard?.writeText(`${origin}/vote/${name}`);
    setCopied(name);
    setTimeout(() => setCopied(""), 1200);
  }

  const allVoted = votedCount === voters.length;
  const isFinalReveal =
    phase === "revealed" && session.roundType === "main" && session.candidates.length === 2;

  return (
    <div className="flex flex-col gap-6 max-w-[620px] mx-auto">
      {/* Voter links */}
      <div className="paper-card !static p-5 gap-3">
        <div className="field-label !mb-0">Send each person their own link</div>
        <div className="flex flex-col gap-2">
          {voters.map((name) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-14 shrink-0 font-doodle text-forest capitalize">{name}</span>
              <code className="flex-1 min-w-0 truncate font-mono text-[.7rem] text-brown bg-cream-light border border-ink/15 rounded-[8px] px-2 py-1.5">
                {origin ? `${origin}/vote/${name}` : `/vote/${name}`}
              </code>
              <button
                type="button"
                onClick={() => copy(name)}
                className="chip !normal-case shrink-0"
              >
                {copied === name ? "copied ✓" : "copy"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Round console */}
      <div className="paper-card !static p-5 gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[.66rem] tracking-[.1em] uppercase text-clay">
            {state.label}
          </span>
          <Link
            href="/vote/results"
            className="font-mono text-[.6rem] tracking-[.08em] uppercase text-brown no-underline hover:text-forest"
          >
            results →
          </Link>
        </div>

        {phase === "idle" && (
          <ActionButton onClick={() => run(voteStart)} busy={busy}>
            ▶ Start voting
          </ActionButton>
        )}

        {phase === "voting" && (
          <>
            <VotedTracker voters={voters} voted={voted} />
            <ActionButton onClick={() => run(voteReveal)} busy={busy} disabled={!allVoted}>
              {allVoted ? "Show results" : `Waiting… ${votedCount}/${voters.length} voted`}
            </ActionButton>
          </>
        )}

        {phase === "revealed" && (
          <>
            <div className="field-label !mb-0">This round&apos;s votes</div>
            <CountBars counts={session.counts ?? {}} />
            <ActionButton onClick={() => run(voteNext)} busy={busy}>
              {isFinalReveal ? "🏆 Reveal winner" : "Continue to next stage →"}
            </ActionButton>
          </>
        )}

        {phase === "finished" && (
          <div className="text-center py-3">
            {session.winner ? (
              <>
                <div className="text-4xl">🏆</div>
                <div className="font-doodle font-bold text-[2rem] text-forest leading-tight mt-1">
                  {session.winner}
                </div>
                <div className="font-mono text-[.62rem] uppercase tracking-[.1em] text-brown mt-1">
                  winner
                </div>
              </>
            ) : (
              <div className="font-doodle text-[1.3rem] text-forest">
                It&apos;s a tie — discuss the finalists.
              </div>
            )}
          </div>
        )}

        {/* Restart / reset — available mid-vote (abort) and after it ends
            (start a fresh vote). Two-step confirm so nobody nukes a live vote
            by accident. Hidden while idle (nothing to reset yet). */}
        {phase !== "idle" && (
          <div
            className={`pt-2 border-t border-dashed border-ink/20 ${
              phase === "finished" ? "flex flex-col items-center gap-2" : "flex justify-end"
            }`}
          >
            {confirmReset ? (
              <span className="flex items-center gap-2 font-mono text-[.62rem] uppercase tracking-[.08em]">
                <span className="text-clay">
                  {phase === "finished"
                    ? "clear results & start a new vote?"
                    : "reset the current vote?"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    run(voteReset);
                  }}
                  className="text-clay font-bold"
                >
                  yes
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className="text-brown">
                  no
                </button>
              </span>
            ) : phase === "finished" ? (
              <ActionButton onClick={() => setConfirmReset(true)} busy={busy}>
                ↻ Start a new vote
              </ActionButton>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="font-mono text-[.6rem] uppercase tracking-[.08em] text-brown-soft hover:text-clay"
              >
                reset &amp; start over
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, busy, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="font-mono text-[.72rem] tracking-[.06em] uppercase text-cream-light bg-forest rounded-[12px_9px_13px_9px] px-5 py-3 shadow-hard-sm transition-colors hover:bg-olive disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function VotedTracker({ voters, voted }) {
  return (
    <div className="flex flex-wrap gap-2">
      {voters.map((v) => {
        const done = voted.includes(v);
        return (
          <span
            key={v}
            className={`font-mono text-[.66rem] px-2.5 py-1.5 rounded-pill border-2 capitalize ${
              done
                ? "bg-forest text-cream-light border-forest"
                : "text-brown-soft border-brown-soft/40"
            }`}
          >
            {done ? "✓ " : "○ "}
            {v}
          </span>
        );
      })}
    </div>
  );
}
