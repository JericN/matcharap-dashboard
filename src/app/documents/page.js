import SectionHeader from "@/components/SectionHeader";
import DocumentsApp from "@/features/documents/DocumentsApp";
import { listIndex } from "@/config/documents";

export const dynamic = "force-dynamic"; // shared docs, read fresh per request

export default async function DocumentsPage() {
  const index = await listIndex();
  return (
    // Break out of the global max-w-[1140px] container so docs get more room.
    <section className="relative left-1/2 -translate-x-1/2 w-screen md:w-[calc(100vw_-_216px)] px-5 max-md:px-[13px]">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeader
          num="07"
          kicker="documents"
          title="Notes & docs"
          sub="simple shared markdown docs — checklists, SOPs & ideas · everyone sees the same"
        />
        <DocumentsApp initialIndex={index} />
      </div>
    </section>
  );
}
