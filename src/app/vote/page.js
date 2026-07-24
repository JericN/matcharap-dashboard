import SectionHeader from "@/components/SectionHeader";
import HostConsole from "@/features/voting/HostConsole";
import { getVoteState } from "@/config/voting";

export const dynamic = "force-dynamic"; // shared session, read fresh per request

export const metadata = { title: "Brand vote · host" };

export default async function VotePage() {
  const state = await getVoteState();
  return (
    <section className="mt-2">
      <SectionHeader
        num="★"
        kicker="brand vote"
        title="Vote console"
        sub="send everyone their link, start the vote, and drive each round"
      />
      <div className="mt-7">
        <HostConsole state={state} />
      </div>
    </section>
  );
}
