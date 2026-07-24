"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { TextField } from "@/components/form";
import { castVote } from "@/config/actions";

// The ballot: name (required) → pick one candidate → submit → thanks.
// `candidates` comes from the server (src/config/voting.js) so the list stays a
// single source of truth. "Name only" duplicate guard: a re-vote by the same
// name overwrites the prior one server-side — no browser lock.
export default function VoteForm({ candidates }) {
  const [name, setName] = useState("");
  const [choice, setChoice] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const ready = name.trim().length > 0 && choice !== null;

  function submit() {
    if (!ready || pending) return;
    setError("");
    startTransition(async () => {
      try {
        await castVote(name.trim(), choice);
        setDone(true);
      } catch {
        setError("Couldn't record your vote. Please try again.");
      }
    });
  }

  if (done) {
    return (
      <div className="paper-card !static max-w-[520px] mx-auto p-8 text-center items-center gap-4">
        <div className="text-5xl leading-none">🍵</div>
        <h3 className="font-doodle font-bold text-[1.8rem] text-forest leading-tight">
          Thanks, {name.trim()}!
        </h3>
        <p className="text-[.9rem] text-olive-soft">
          Your vote for <b className="text-forest">{choice}</b> is in.
        </p>
        <Link
          href="/vote/results"
          className="mt-1 font-mono text-[.66rem] tracking-[.08em] uppercase text-cream-light bg-forest rounded-[12px_9px_13px_9px] px-5 py-3 no-underline shadow-hard-sm hover:bg-olive"
        >
          See the live tally →
        </Link>
      </div>
    );
  }

  return (
    <div className="paper-card !static max-w-[520px] mx-auto p-6 max-md:p-5 gap-5">
      <TextField
        id="voter-name"
        label="Your name"
        placeholder="Type your name…"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />

      <div>
        <span className="field-label">Pick your favorite</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {candidates.map((c) => {
            const active = choice === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setChoice(c)}
                className={`rounded-card border-[2.2px] shadow-hard-sm px-4 py-6 text-center transition-colors ${
                  active
                    ? "bg-forest border-forest text-cream-light"
                    : "bg-cream-card border-forest text-forest hover:bg-cream-light"
                }`}
              >
                <span className="font-doodle font-bold text-[1.5rem] leading-none">{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="font-mono text-[.7rem] text-clay">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={!ready || pending}
        className="font-mono text-[.7rem] tracking-[.08em] uppercase text-cream-light bg-forest rounded-[12px_9px_13px_9px] px-5 py-3 shadow-hard-sm transition-colors hover:bg-olive disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Submitting…" : "Submit vote"}
      </button>
    </div>
  );
}
