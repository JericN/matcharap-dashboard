// Heart/save toggle shared by every card (powders, drinks, events, competitors).
// `className` sets positioning — an absolute corner on most cards, inline on the
// competitor card. The visual + a11y wording live here so all four stay in sync.
const HEART_PATH = "M12 21s-7-4.6-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.4 12 21 12 21z";

export default function SaveButton({ saved, onToggle, label, className = "" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from your selection` : `Save ${label} to your selection`}
      title={saved ? "Saved — click to remove" : "Save to your selection"}
      className={`w-8 h-8 grid place-items-center rounded-full border-2 border-clay transition hover:scale-110 ${saved ? "bg-clay text-cream-light" : "bg-cream-card text-clay"} ${className}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d={HEART_PATH} />
      </svg>
    </button>
  );
}
