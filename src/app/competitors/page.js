import { repo } from "@/config/repo";
import SectionHeader from "@/components/SectionHeader";
import CompetitorsGrid from "@/features/competitors/CompetitorsGrid";

export const metadata = {
  title: "Competitors · Matcharap Eto",
  description: "Top 10 indie matcha-drink rivals around Metro Manila — for competitor study.",
};

export default async function CompetitorsPage() {
  const competitors = await repo.competitors();
  return (
    <section>
      <SectionHeader
        num="04"
        kicker="competitors"
        title="Top 10 indie matcha rivals to study"
        sub="small Metro Manila matcha-drink brands · ranked from 30 researched & validated · ⭐ ratings + open-status live-verified on Google Maps, Jun 2026"
      />
      <CompetitorsGrid competitors={competitors} />
    </section>
  );
}
