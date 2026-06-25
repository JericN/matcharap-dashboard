import { CalIcon, PinIcon } from '@/components/icons';
import SaveButton from '@/components/SaveButton';

// status pill-class → stamp variant (p-rec = recurring, sage-green; p-up = default)
const STAMP_VARIANT = { 'p-up': '', 'p-rec': 'stamp--rec' };
const TAG_COLOR = { open: 'text-clay', warn: 'text-olive', wait: 'text-brown-soft' };
const LINK_META = {
  web: { icon: '🔎', label: 'Search' },
  ig: { icon: '📷', label: 'Instagram' },
  fb: { icon: '📘', label: 'Facebook' },
  tiktok: { icon: '🎵', label: 'TikTok' },
  maps: { icon: '🗺️', label: 'Map' },
  order: { icon: '🛒', label: 'Order' },
  apply: { icon: '📝', label: 'Apply' },
};

export default function EventCard({ event, saved, onToggleSave }) {
  const stampText = event.status[0].replace(/^[^A-Za-z]+/, '').trim();
  const stampVariant = STAMP_VARIANT[event.status[1]] || '';

  // Confirmed dates carry a ✓ marker in the `date` string → render a small dot;
  // "to confirm" → nothing. Either way, strip the marker so only the date shows.
  const toConfirm = /to\s*confirm/i.test(event.date);
  const confirmed = !toConfirm && event.date.includes('✓');
  const dateText = event.date
    .split('·')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('✓') && !/to\s*confirm/i.test(s))
    .join(' · ');

  return (
    <article className="paper-card">
      <SaveButton saved={saved} onToggle={onToggleSave} label={event.name} className="absolute top-[10px] right-[10px] z-[4]" />

      <div className="flex gap-[13px] items-start px-4 pt-4 pb-2.5">
        <span className="relative shrink-0 w-[50px] h-[50px]">
          <svg className="w-full h-full" viewBox="0 0 64 64" aria-hidden="true"><use href="#mm-tent" /></svg>
          {/* status overlaid on the icon (top-left) */}
          <span className={`stamp ${stampVariant} !top-[-6px] !left-[-8px] !right-auto`}>{stampText}</span>
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-doodle font-bold text-[1.18rem] text-forest leading-snug mb-[5px] pr-[40px] max-md:text-[1.1rem]">{event.name}</h3>
          <div className="font-mono text-[.58rem] tracking-[.03em] text-olive-soft mb-1.5">{event.org}</div>
          <div className="meta-line"><CalIcon /> {dateText}{confirmed && <span className="inline-block w-[6px] h-[6px] rounded-full bg-matcha align-middle ml-1.5" title="Confirmed date" aria-label="confirmed" />}</div>
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

      <div className="mt-auto border-t-2 border-dashed border-ink bg-matcha-bright/10">
        <div className="px-4 pt-[11px] pb-2 flex gap-2 items-start">
          <span className={`font-mono text-[.6rem] tracking-[.04em] leading-snug uppercase flex gap-1.5 items-start ${TAG_COLOR[event.vendor.c]}`}>
            {event.vendor.ic} {event.vendor.t}
          </span>
        </div>
        {event.links.length > 0 && (
          <div className="px-4 pb-[12px] flex flex-wrap items-center gap-[6px]">
            <span className="font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft mr-0.5">sources</span>
            {event.links.map((l) => {
              const meta = LINK_META[l.kind];
              return (
                <a
                  key={l.kind + l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener"
                  title={`${meta.label} — opens in a new tab`}
                  className="font-mono text-[.56rem] tracking-[.04em] uppercase text-forest bg-cream-light border-2 border-forest rounded-pill px-[9px] py-[4px] no-underline inline-flex items-center gap-[4px] transition-transform hover:-translate-y-px hover:bg-forest hover:text-cream-light"
                >
                  <span aria-hidden="true">{meta.icon}</span>
                  {meta.label}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
