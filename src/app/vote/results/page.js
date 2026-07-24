import SectionHeader from "@/components/SectionHeader";
import ResultsView from "@/features/voting/ResultsView";
import { getVoteState } from "@/config/voting";

export const dynamic = "force-dynamic"; // live results, read fresh per request

export const metadata = { title: "Brand vote · results" };

export default async function VoteResultsPage() {
  const state = await getVoteState();
  return (
    <section className="mt-2">
      <SectionHeader
        num="★"
        kicker="brand vote"
        title="Results & analytics"
        sub="every round · every ballot · final result at the bottom"
      />
      <div className="mt-7">
        <ResultsView state={state} />
      </div>
    </section>
  );
}
