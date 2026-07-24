import SectionHeader from "@/components/SectionHeader";
import VoterBallot from "@/features/voting/VoterBallot";
import { getVoteState, VOTERS } from "@/config/voting";

export const dynamic = "force-dynamic"; // shared session, read fresh per request

// Note: the static /vote/results route wins over this dynamic [voter] segment,
// so "results" never lands here.
export default async function VoterPage({ params }) {
  const voter = String(params.voter || "").toLowerCase();

  if (!VOTERS.includes(voter)) {
    return (
      <section className="mt-8">
        <div className="paper-card !static max-w-[440px] mx-auto p-6 text-center">
          <div className="font-doodle text-[1.4rem] text-forest">Invalid voter link</div>
          <p className="text-[.85rem] text-olive-soft mt-2">
            This isn&apos;t one of the voter pages. Ask the host for your correct link.
          </p>
        </div>
      </section>
    );
  }

  const state = await getVoteState();
  return (
    <section className="mt-2">
      <SectionHeader
        num="★"
        kicker="brand vote"
        title="Cast your vote"
        sub="one device per person · vote each round"
      />
      <div className="mt-7">
        <VoterBallot voter={voter} state={state} />
      </div>
    </section>
  );
}
