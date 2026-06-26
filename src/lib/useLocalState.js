import { useEffect, useState } from "react";

// useState that remembers its value in the browser (localStorage), keyed by
// `key`. For PER-BROWSER working values (calculator selections, etc.) — NOT
// shared team state (that lives in Redis). `initial` accepts a value or a lazy
// initializer, exactly like useState.
//
// SSR/hydration-safe: the first render uses `initial` (matching the server
// HTML), then we read localStorage in an effect after mount — so there's no
// hydration mismatch.
//
// `hydrated` is STATE, not a ref, on purpose: the persist effect must NOT write
// during the mount render (its closure sees hydrated === false and bails). If
// it were a ref it would flip synchronously and the persist effect would write
// the *default* value before the loaded one applied — clobbering the stored
// value on every reload. Persisting only starts on the re-render after the
// stored value has landed.
export function useLocalState(key, initial) {
  const [value, setValue] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  // load once on mount (post-hydration, so it can't cause a mismatch)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw));
    } catch {
      // ignore unavailable/corrupt storage — keep the initial value
    }
    setHydrated(true);
  }, [key]);

  // persist on change, but only once hydrated (so the default can't clobber a
  // stored value on first paint)
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota/availability errors
    }
  }, [key, value, hydrated]);

  return [value, setValue];
}
