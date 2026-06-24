import { repo } from "@/config/repo";
import { toMatchaOptions } from "@/features/powders/pricing";
import SectionHeader from "@/components/SectionHeader";
import Calculator from "@/features/calculator/Calculator";

export const dynamic = "force-dynamic"; // read the shared state fresh each request

export default async function CalculatorPage() {
  // The matcha list is derived from the powder guide (single source of truth),
  // so it always spans the full price range and never drifts.
  const matchaOptions = toMatchaOptions(await repo.powders());
  const milkOptions = await repo.milkOptions();
  const drinks = await repo.drinks();
  const ingredients = await repo.ingredients();
  const pricing = await repo.pricing();
  const srp = await repo.prices.map();
  return (
    <section>
      <SectionHeader
        num="02"
        kicker="cost calculator"
        title="Choose your matcha & milk → costs auto-calculate"
        sub="₱ per 16oz iced cup · tap the SRP box to set your own price · verified vs PH store data, June 2026"
      />
      <Calculator
        matchaOptions={matchaOptions}
        milkOptions={milkOptions}
        drinks={drinks}
        ingredients={ingredients}
        extras={pricing.extras}
        initialSrp={srp}
      />
    </section>
  );
}
