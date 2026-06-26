import { repo } from "@/config/repo";
import SectionHeader from "@/components/SectionHeader";
import PowderGrid from "@/features/powders/PowderGrid";

export const dynamic = "force-dynamic"; // read the shared saved state fresh each request

export default async function PowdersPage() {
  const powders = await repo.powders();
  const powderImages = await repo.powderImages();
  const saved = await repo.savedPowders();
  return (
    <section>
      <SectionHeader
        num="03"
        kicker="powder picks"
        title="Best matcha to source for the booth"
        sub="PH-homegrown brands, Japanese names sold in PH & authentic imports · ₱ per 2g serving · right-click a card to edit price & size"
      />
      <PowderGrid powders={powders} images={powderImages} initialSaved={saved} />
    </section>
  );
}
