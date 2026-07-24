"use client";
import { usePoll } from "./usePoll";

// The analytics page (/vote/results): every round top-to-bottom with each
// person's picks, the tally, and the resolution; final result at the bottom.
export default function ResultsView({ state }) {
  const { session } = state;
  usePoll(session.phase !== "finished", 3000);
  const log = session.log ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-[720px] mx-auto">
      {log.length === 0 && (
        <div className="paper-card !static p-6 text-center text-olive-soft text-[.9rem]">
          No rounds yet. Each round shows up here the moment it&apos;s revealed.
        </div>
      )}

      {log.map((round, i) => (
        <RoundCard key={i} round={round} voters={state.voters} />
      ))}

      <FinalCard state={state} />
    </div>
  );
}

function RoundCard({ round, voters }) {
  const rows = Object.entries(round.counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="paper-card !static p-5 gap-3">
      <div className="font-mono text-[.66rem] uppercase tracking-[.1em] text-clay">{round.note}</div>

      {/* per-person votes */}
      <div className="flex flex-col gap-1.5">
        {voters.map((v) => {
          const picks = round.votes[v];
          return (
            <div key={v} className="flex items-baseline gap-2 text-[.8rem]">
              <span className="w-14 shrink-0 font-doodle text-forest capitalize">{v}</span>
              <span className="font-mono text-brown">
                {picks && picks.length ? picks.join(", ") : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* tally */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-ink/20">
        {rows.map(([name, n]) => {
          const out = name === round.removed;
          const win = name === round.winner;
          return (
            <span
              key={name}
              className={`font-mono text-[.7rem] px-2 py-1 rounded-pill border ${
                win
                  ? "bg-forest text-cream-light border-forest"
                  : out
                    ? "text-brown-soft border-brown-soft/40 line-through"
                    : "text-forest border-forest/40"
              }`}
            >
              {name} {n}
              {win ? " 🏆" : out ? " ✗" : ""}
            </span>
          );
        })}
      </div>

      {(round.winner || round.removed || round.tie) && (
        <div className="font-mono text-[.66rem] text-brown">
          {round.winner
            ? `Winner: ${round.winner}`
            : round.removed
              ? `Removed: ${round.removed}`
              : `Tie for last: ${round.tie.join(" & ")} → tie-breaker`}
        </div>
      )}
    </div>
  );
}

function FinalCard({ state }) {
  const { session } = state;
  if (session.phase === "finished") {
    return (
      <div className="paper-card is-star !static p-6 text-center">
        {session.winner ? (
          <>
            <div className="text-4xl">🏆</div>
            <div className="font-doodle font-bold text-[2.1rem] text-forest leading-tight mt-1">
              {session.winner}
            </div>
            <div className="font-mono text-[.62rem] uppercase tracking-[.1em] text-brown mt-1">
              final winner
            </div>
          </>
        ) : (
          <div className="font-doodle text-[1.3rem] text-forest">Tie — finalists to discuss.</div>
        )}
      </div>
    );
  }
  return (
    <div className="paper-card !static p-4 text-center">
      <span className="font-mono text-[.66rem] uppercase tracking-[.1em] text-clay">
        {state.label}
      </span>
      {session.phase === "voting" && (
        <span className="block text-[.8rem] text-olive-soft mt-1">
          {state.votedCount}/{state.voters.length} voted…
        </span>
      )}
      {session.phase === "revealed" && (
        <span className="block text-[.8rem] text-olive-soft mt-1">
          round revealed — waiting for the host to advance
        </span>
      )}
      {session.phase === "idle" && (
        <span className="block text-[.8rem] text-olive-soft mt-1">not started</span>
      )}
    </div>
  );
}
