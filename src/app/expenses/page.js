import { repo } from "@/config/repo";
import SectionHeader from "@/components/SectionHeader";
import ExpensesPlanner from "@/features/expenses/ExpensesPlanner";

export const dynamic = "force-dynamic"; // read the shared expense rows fresh each request

export default async function ExpensesPage() {
  const [tabs, expenses] = await Promise.all([repo.expenseTabs(), repo.expenses()]);
  return (
    <section>
      <SectionHeader
        num="06"
        kicker="expense planner"
        title="Plan the spend"
        sub="group costs into sheets/tabs — add a line per cost (item, notes, date, price & qty); drag to reorder · right-click to duplicate or delete · totals, shares & a grand total auto-calculate · shared with the team"
      />
      <ExpensesPlanner initialTabs={tabs} initialExpenses={expenses} />
    </section>
  );
}
