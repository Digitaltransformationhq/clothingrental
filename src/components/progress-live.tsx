"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the progress page live.
 *
 * Calls `router.refresh()` on an interval, which re-runs the server component
 * and streams in new markup without a full page load — so the tab can be left
 * open and simply watched. Polling rather than a socket because the thing being
 * watched is a file on disk changing every few minutes, not a high-frequency
 * stream.
 *
 * Pauses while the tab is hidden: refreshing a page nobody is looking at is
 * work for its own sake.
 */
export function ProgressLive({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [checkedAt, setCheckedAt] = React.useState<Date | null>(null);
  const [live, setLive] = React.useState(true);

  React.useEffect(() => {
    if (!live) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setCheckedAt(new Date());
    };

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs, live]);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="meta text-ink-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          className={
            live
              ? "bg-positive inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              : "bg-rule-strong inline-block h-1.5 w-1.5 rounded-full"
          }
        />
        {live ? "Updating automatically" : "Paused"}
        {checkedAt ? (
          <span>
            {" "}
            · last checked{" "}
            {checkedAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        ) : null}
      </p>

      <button
        type="button"
        onClick={() => setLive((value) => !value)}
        className="link-underline meta text-ink-2"
      >
        {live ? "Pause" : "Resume"}
      </button>

      <button
        type="button"
        onClick={() => {
          router.refresh();
          setCheckedAt(new Date());
        }}
        className="link-underline meta text-ink-2"
      >
        Refresh now
      </button>
    </div>
  );
}
