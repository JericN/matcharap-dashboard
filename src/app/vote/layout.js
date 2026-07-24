// Scoped to /vote, /vote/[voter], /vote/results only — the rest of the
// dashboard keeps normal zoom. Locks the viewport to device width and disables
// pinch / double-tap zoom on phones (Android honours user-scalable; iOS keeps
// accessibility pinch-zoom, which is fine — touch-action in globals.css still
// removes the double-tap zoom + tap delay). The .vote-root wrapper carries the
// tap-behaviour styles.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function VoteLayout({ children }) {
  return <div className="vote-root">{children}</div>;
}
