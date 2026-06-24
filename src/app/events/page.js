import { getSiteData } from "@/config/store";
import SectionHeader from "@/components/SectionHeader";
import EventsGrid from "@/features/events/EventsGrid";

export default async function EventsPage() {
  const { events } = await getSiteData();
  return (
    <section>
      <SectionHeader
        num="01"
        kicker="pop-up events"
        title="Where to set up a booth"
        sub="upcoming matcha pop-ups, fests & markets around Metro Manila"
      />
      <EventsGrid events={events} />
    </section>
  );
}
