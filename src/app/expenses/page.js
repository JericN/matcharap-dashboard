import { repo } from "@/config/repo";
import SectionHeader from "@/components/SectionHeader";
import ExpensesDataTable from "@/features/expenses/ExpensesDataTable";

export const dynamic = "force-dynamic"; // read the shared expense rows fresh each request

export default async function ExpensesPage() {
  const [tabs, expenses] = await Promise.all([repo.expenseTabs(), repo.expenses()]);
  return (
    // Break out of the global max-w-[1140px] container so the table gets more room
    // (mirrors the documents page).
    <section className="relative left-1/2 -translate-x-1/2 w-screen md:w-[calc(100vw_-_216px)] px-5 max-md:px-[13px]">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeader
          num="06"
          kicker="expense planner"
          title="Plan the spend"
          sub="each sheet is a table with your own columns (text · number ₱ · date · single/multi-select · checkbox) and multiple saved views — filter, sort & hide fields per view; drag to reorder columns/rows, resize by the edge · right-click a row to duplicate or delete · shared with the team"
        />
        <ExpensesDataTable initialTabs={tabs} initialExpenses={expenses} />
      </div>
    </section>
  );
}
