"use client";
import { useState } from "react";
import EventCard from "@/features/events/EventCard";

export default function EventsGrid({ events }) {
  const [f, setF] = useState("all");
  return (
    <>
      <div className="chiprow flex flex-wrap gap-[9px] mb-[22px]">
        <button className={"chip" + (f === "all" ? " chip--active" : "")} onClick={() => setF("all")}>All</button>
        <button className={"chip" + (f === "upcoming" ? " chip--active" : "")} onClick={() => setF("upcoming")}>Upcoming</button>
        <button className={"chip" + (f === "recurring" ? " chip--active" : "")} onClick={() => setF("recurring")}>Recurring</button>
        <button className={"chip" + (f === "star" ? " chip--active" : "")} onClick={() => setF("star")}>Best fit</button>
      </div>
      <div className="card-grid">
        {events.filter((e) => f === "all" || e.tags.includes(f)).map((e) => (
          <EventCard key={e.name} event={e} />
        ))}
      </div>
    </>
  );
}
