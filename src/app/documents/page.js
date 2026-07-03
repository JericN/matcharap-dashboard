import SectionHeader from "@/components/SectionHeader";
import DocumentsApp from "@/features/documents/DocumentsApp";
import { listIndex } from "@/config/documents";

export const dynamic = "force-dynamic"; // shared docs, read fresh per request

export default async function DocumentsPage() {
  const index = await listIndex();
  return (
    <section>
      <SectionHeader
        num="07"
        kicker="documents"
        title="Notes & docs"
        sub="simple shared markdown docs — checklists, SOPs & ideas · everyone sees the same"
      />
      <DocumentsApp initialIndex={index} />
    </section>
  );
}
