// Ranked bar list of {name: count}. Anonymous — just numbers. Optionally marks
// the removed name (struck) and the winner (🏆). Shared by host + voter views.
export default function CountBars({ counts, removed = null, winner = null }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="flex flex-col gap-2">
      {rows.map(([name, n]) => {
        const out = name === removed;
        const win = name === winner;
        return (
          <div key={name} className="flex items-center gap-2">
            <span
              className={`w-24 shrink-0 font-doodle text-[1.05rem] leading-none ${
                out ? "text-brown-soft line-through" : "text-forest"
              }`}
            >
              {win ? "🏆 " : ""}
              {name}
              {out ? " ✗" : ""}
            </span>
            <div className="flex-1 h-3 rounded-pill bg-cream-deep border border-ink/15 overflow-hidden">
              <div
                className={`h-full rounded-pill transition-[width] duration-500 ${
                  win ? "bg-forest" : out ? "bg-brown-soft/40" : "bg-matcha"
                }`}
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right font-mono text-[.75rem] text-brown">{n}</span>
          </div>
        );
      })}
    </div>
  );
}
