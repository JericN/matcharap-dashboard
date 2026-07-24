import SectionHeader from "@/components/SectionHeader";
import VoteResults from "@/features/voting/VoteResults";
import { getTally } from "@/config/voting";

export const dynamic = "force-dynamic"; // shared tally, read fresh per request

export const metadata = { title: "Live tally · brand vote" };

export default async function VoteResultsPage() {
  const tally = await getTally();
  return (
    <section className="mt-2">
      <SectionHeader
        num="★"
        kicker="brand vote"
        title="Live tally"
        sub="updates as votes come in · refreshes automatically"
      />
      <div className="mt-8">
        <VoteResults tally={tally} />
      </div>
    </section>
  );
}
