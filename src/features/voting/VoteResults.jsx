"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// The live tally. `tally` is refetched from the server (force-dynamic) each time
// we call router.refresh() — on an interval and via the manual button — so the
// counts stay current as people vote. Rows are ranked by votes (CANDIDATES order
// breaks ties, since Array.sort is stable).
export default function VoteResults({ tally }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  function refreshNow() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 500);
  }

  const { results, total } = tally;
  const ranked = [...results].sort((a, b) => b.votes - a.votes);
  const max = Math.max(1, ...results.map((r) => r.votes));

  return (
    <div className="paper-card !static max-w-[560px] mx-auto p-6 max-md:p-5 gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[.66rem] tracking-[.1em] uppercase text-brown">
          {total} {total === 1 ? "ballot" : "ballots"} cast
        </span>
        <button
          type="button"
          onClick={refreshNow}
          className="chip !normal-case"
          aria-label="Refresh tally"
        >
          {refreshing ? "…" : "↻ refresh"}
        </button>
      </div>

      {total === 0 ? (
        <p className="text-center text-[.9rem] text-olive-soft py-6">
          No votes yet — be the first.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {ranked.map((r, i) => {
            const pct = total ? Math.round((r.votes / total) * 100) : 0;
            const lead = i === 0 && r.votes > 0;
            return (
              <li key={r.name} className="flex items-center gap-3">
                <span
                  className={`shrink-0 w-7 h-7 grid place-items-center rounded-full border-2 font-mono text-[.7rem] ${
                    lead
                      ? "bg-forest border-forest text-cream-light"
                      : "border-brown text-brown"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-doodle font-bold text-[1.25rem] text-forest leading-none">
                      {r.name}
                    </span>
                    <span className="font-mono text-[.72rem] text-brown shrink-0">
                      {r.votes} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-pill bg-cream-deep border border-ink/15 overflow-hidden">
                    <div
                      className={`h-full rounded-pill transition-[width] duration-500 ${
                        lead ? "bg-forest" : "bg-matcha"
                      }`}
                      style={{ width: `${(r.votes / max) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Link
        href="/vote"
        className="self-center font-mono text-[.62rem] tracking-[.1em] uppercase text-clay no-underline hover:text-forest"
      >
        ← cast a vote
      </Link>
    </div>
  );
}
