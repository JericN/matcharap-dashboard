"use client";
import AnchoredPopover from "./AnchoredPopover";

// Column-visibility editor for a view — a checklist of ALL columns (checked =
// visible, unchecked = hidden, i.e. its id lives in hiddenColumnIds). The FIRST
// column is the primary and can never be hidden: it renders checked + disabled.
// "Hide all" hides every column EXCEPT the primary; "Show all" clears the list.
// Every edit emits the full next hiddenColumnIds array via onChange.
export default function HideFieldsMenu({ view, columns, rect, onClose, onChange }) {
  const hidden = new Set(view.hiddenColumnIds ?? []);
  const primaryId = columns[0]?.id;

  const toggle = (id) => {
    if (id === primaryId) return; // primary is always visible
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  const hideAll = () => onChange(columns.slice(1).map((c) => c.id));
  const showAll = () => onChange([]);

  return (
    <AnchoredPopover rect={rect} onClose={onClose} width={240}>
      <div className="font-mono text-[.52rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1.5">
        Fields
      </div>

      <div className="flex flex-col gap-0.5 mb-2">
        {columns.map((c, i) => {
          const isPrimary = i === 0;
          const visible = isPrimary || !hidden.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              disabled={isPrimary}
              className={
                "flex items-center gap-2 w-full text-left px-1.5 py-1 rounded-[7px] transition " +
                (isPrimary ? "opacity-70 cursor-default" : "hover:bg-cream-light")
              }
            >
              <span
                className={
                  "w-[15px] h-[15px] rounded-[4px] border-2 flex items-center justify-center text-[.55rem] leading-none shrink-0 " +
                  (visible ? "bg-forest border-forest text-cream-light" : "border-olive")
                }
              >
                {visible ? "✓" : ""}
              </span>
              <span className="font-mono text-[.68rem] text-forest truncate">{c.name}</span>
              {isPrimary && (
                <span className="ml-auto font-mono text-[.5rem] uppercase tracking-[.08em] text-brown-soft/70 shrink-0">
                  primary
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-1 border-t border-dashed border-brown-soft/30 pt-1.5">
        <button type="button" onClick={hideAll} className="chip flex-1 justify-center py-1 text-[.6rem]">
          Hide all
        </button>
        <button type="button" onClick={showAll} className="chip flex-1 justify-center py-1 text-[.6rem]">
          Show all
        </button>
      </div>
    </AnchoredPopover>
  );
}
