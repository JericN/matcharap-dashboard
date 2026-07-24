import Link from "next/link";
import SectionHeader from "@/components/SectionHeader";
import VoteForm from "@/features/voting/VoteForm";
import { CANDIDATES } from "@/config/voting";

// The ballot is static (candidates are a const); the tally page reads Redis.
export const metadata = { title: "Name the brand · vote" };

export default function VotePage() {
  return (
    <section className="mt-2">
      <SectionHeader
        num="★"
        kicker="brand vote"
        title="Name the brand"
        sub="one pick each — help choose the name · anyone can join"
      />
      <div className="mt-8">
        <VoteForm candidates={CANDIDATES} />
        <p className="mt-5 text-center">
          <Link
            href="/vote/results"
            className="font-mono text-[.62rem] tracking-[.1em] uppercase text-clay no-underline hover:text-forest"
          >
            see the live tally →
          </Link>
        </p>
      </div>
    </section>
  );
}
