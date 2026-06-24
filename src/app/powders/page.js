import { getSiteData } from "@/config/store";
import { getState } from "@/config/state";
import SectionHeader from "@/components/SectionHeader";
import PowderGrid from "@/features/powders/PowderGrid";

export const dynamic = "force-dynamic"; // read the shared state fresh each request

export default async function PowdersPage() {
  const { powders, powderImages } = await getSiteData();
  const { saved } = await getState();
  return (
    <section>
      <SectionHeader
        num="03"
        kicker="powder picks"
        title="Best matcha to source for the booth"
        sub="PH-homegrown brands, Japanese names sold in PH & authentic imports · ₱ per 2g serving"
      />
      <PowderGrid powders={powders} images={powderImages} initialSaved={saved} />
    </section>
  );
}
