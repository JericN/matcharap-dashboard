import { getSiteData } from "@/config/store";
import SectionHeader from "@/components/SectionHeader";
import Calculator from "@/features/calculator/Calculator";

export default async function CalculatorPage() {
  const { matchaOptions, milkOptions, drinks, ingredients, pricing } = await getSiteData();
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
      />
    </section>
  );
}
