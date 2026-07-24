"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetch the server component on an interval so shared Redis state stays live
// across everyone's pages. `active=false` pauses it (e.g. once the vote is done).
export function usePoll(active = true, ms = 2500) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [active, ms, router]);
}
