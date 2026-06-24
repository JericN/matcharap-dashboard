import { CalIcon, PinIcon } from '@/components/icons';

// status pill-class -> stamp visual variant
const STAMP_VARIANT = { 'p-up': '', 'p-rec': 'stamp--soon', 'p-soon': 'stamp--live' };
const TAG_COLOR = { open: 'text-clay', warn: 'text-olive', wait: 'text-brown-soft' };

export default function EventCard({ event }) {
  const stampText = event.status[0].replace(/^[^A-Za-z]+/, '').trim();
  const stampVariant = STAMP_VARIANT[event.status[1]] || '';

  return (
    <article className="paper-card" style={event.star ? { background: 'linear-gradient(180deg,#f9f3e4,#f7f1e3)' } : undefined}>
      <span className={`stamp ${stampVariant}`}>{stampText}</span>

      <div className="flex gap-[13px] items-start px-4 pt-4 pb-2.5">
        <svg className="shrink-0 w-[50px] h-[50px]" viewBox="0 0 64 64" aria-hidden="true"><use href="#mm-tent" /></svg>
        <div className="flex-1 min-w-0">
          <h3 className="font-doodle font-bold text-[1.18rem] text-forest leading-snug mb-[5px] pr-[60px] max-md:text-[1.1rem] max-md:pr-[54px]">{event.name}</h3>
          <div className="font-mono text-[.58rem] tracking-[.03em] text-olive-soft mb-1.5">{event.org}</div>
          <div className="meta-line"><CalIcon /> {event.date}</div>
          <div className="meta-line"><PinIcon /> {event.venue}</div>
        </div>
      </div>

      <div className="px-4 pt-0.5 pb-3">
        <p className="text-[.84rem] text-olive mt-1 mb-2.5">{event.theme}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="font-mono text-[.56rem] tracking-[.04em] uppercase text-brown bg-matcha-bright/15 border-[1.5px] border-ink rounded-[9px] px-2 py-[3px]">🎪 {event.size}</span>
          <span className="font-mono text-[.56rem] tracking-[.04em] uppercase text-brown bg-matcha-bright/15 border-[1.5px] border-ink rounded-[9px] px-2 py-[3px]">👥 {event.people}</span>
        </div>
      </div>

      <div className="mt-auto border-t-2 border-dashed border-ink px-4 py-[11px] flex gap-2 items-center bg-matcha-bright/10">
        <span className={`font-mono text-[.6rem] tracking-[.04em] leading-snug uppercase flex gap-1.5 items-start ${TAG_COLOR[event.vendor.c]}`}>
          {event.vendor.ic} {event.vendor.t}
        </span>
        {event.star && (
          <span className="font-mono text-[.55rem] tracking-[.06em] uppercase text-clay bg-clay/10 border-[1.5px] border-clay rounded-lg px-[7px] py-[3px] ml-auto whitespace-nowrap">⭐ fit</span>
        )}
      </div>
    </article>
  );
}
