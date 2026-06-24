// Hidden inline-SVG symbol defs — referenced anywhere via <svg><use href="#mm-..."/></svg>.
// Rendered once in the root layout so every page/component can use them.
export default function Doodles() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="mm-cup" viewBox="0 0 64 64"><g fill="none" stroke="#3f5031" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 24 h28 l-3 18 q-1 8 -11 8 t-11 -8 z"/><path d="M17 30 q14 6 27 0" stroke="#8aa15a"/><path d="M44 28 q9 0 9 8 t-9 8"/><path d="M25 18 q-4 -6 2 -11 M37 18 q-4 -6 2 -11" stroke="#6b4f2f" strokeWidth="2.6"/></g></symbol>
        <symbol id="mm-whisk" viewBox="0 0 64 64"><g fill="none" stroke="#3f5031" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M32 30 v20" strokeWidth="3.6"/><ellipse cx="32" cy="29" rx="13" ry="5" strokeWidth="2.6"/><path d="M20 28 l4 -17 M26 27 l2 -18 M32 27 v-19 M38 27 l-2 -18 M44 28 l-4 -17"/><path d="M26 50 q6 5 12 0"/></g></symbol>
        <symbol id="mm-leaf" viewBox="0 0 64 64"><g fill="none" stroke="#3f5031" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 48 C15 22 33 13 49 13 C49 39 33 50 15 48 Z"/><path d="M18 45 C29 36 40 27 47 16" stroke="#8aa15a"/><path d="M27 36 l6 4 M34 28 l6 4" stroke="#56683f" strokeWidth="2.6"/></g></symbol>
        <symbol id="mm-pin" viewBox="0 0 64 64"><g fill="none" stroke="#3f5031" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M32 56 q-16 -20 -16 -32 a16 16 0 0 1 32 0 q0 12 -16 32z"/><circle cx="32" cy="24" r="6" stroke="#b9542d"/></g></symbol>
        <symbol id="mm-tent" viewBox="0 0 64 64"><g fill="none" stroke="#3f5031" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 28 q22 -14 44 0"/><path d="M10 28 l5 9 6 -8 6 9 6 -9 6 9 6 -8 5 9" stroke="#56683f"/><path d="M14 42 v18 M50 42 v18"/><rect x="22" y="44" width="20" height="16" rx="2"/><path d="M32 44 v16"/></g></symbol>
        <symbol id="mm-glass" viewBox="0 0 64 64"><g fill="none" stroke="#6b4f2f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 14 h28 l-3 42 q-1 4 -11 4 t-11 -4 z"/><path d="M20 28 q12 5 24 0" stroke="#8aa15a"/><line x1="22" y1="36" x2="42" y2="36" stroke="#a7c06a" strokeWidth="2.4"/><line x1="23" y1="44" x2="41" y2="44" stroke="#a7c06a" strokeWidth="2.4"/><path d="M40 14 l5 -9" stroke="#b9542d"/></g></symbol>
      </defs>
    </svg>
  );
}

// Small standalone mascot head — used in the navbar brand.
export function MascotMini({ className }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g stroke="#3f5031" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="36" r="17" fill="#a9c08a"/>
        <path d="M30 19 q3 -13 -6 -15 q14 0 17 14" fill="#7c9b58"/>
        <path d="M24 34 q4 -6 9 0 M35 34 q4 -6 9 0"/>
        <path d="M26 43 q6 6 12 0"/>
        <circle cx="22" cy="40" r="3" fill="#d98a63" stroke="none" opacity=".7"/>
        <circle cx="44" cy="40" r="3" fill="#d98a63" stroke="none" opacity=".7"/>
      </g>
    </svg>
  );
}
