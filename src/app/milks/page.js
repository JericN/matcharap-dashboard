import { repo } from "@/config/repo";
import SectionHeader from "@/components/SectionHeader";
import MilkGrid from "@/features/milks/MilkGrid";

export const dynamic = "force-dynamic"; // read the shared saved state fresh each request

export default async function MilksPage() {
  const milks = await repo.milks();
  const milkImages = await repo.milkImages();
  const saved = await repo.savedMilks();
  return (
    <section>
      <SectionHeader
        num="06"
        kicker="milk picks"
        title="Best milk to pour for matcha"
        sub="PH-made & supermarket milks, imported barista cartons, authentic pairings & specialty milks · ₱ per liter (≈ per 180 ml cup) · right-click a card to edit price & size"
      />
      <MilkGrid milks={milks} images={milkImages} initialSaved={saved} />
    </section>
  );
}
