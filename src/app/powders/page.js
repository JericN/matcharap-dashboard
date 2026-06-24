import { getSiteData } from "@/config/store";
import SectionHeader from "@/components/SectionHeader";
import PowderGrid from "@/features/powders/PowderGrid";

export default async function PowdersPage() {
  const { powders, powderImages } = await getSiteData();
  return (
    <section>
      <SectionHeader
        num="03"
        kicker="powder picks"
        title="Best matcha to source for the booth"
        sub="PH-homegrown brands, Japanese names sold in PH & authentic imports · ₱ per 2g serving"
      />
      <PowderGrid powders={powders} images={powderImages} />
    </section>
  );
}
