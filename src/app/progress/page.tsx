import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

import { cn } from "@/lib/cn";
import { ProgressLive } from "@/components/progress-live";
import { isProduction } from "@/env";

export const metadata: Metadata = {
  title: "Build progress",
  robots: { index: false, follow: false },
};

// Always read fresh: the whole point is to reflect the file as it stands now.
export const dynamic = "force-dynamic";

type State = "done" | "doing" | "todo";

interface ProgressFile {
  updated: string;
  note: string;
  groups: Array<{ title: string; items: Array<{ label: string; state: State }> }>;
}

/**
 * Build progress.
 *
 * A development-only page, so that the state of the work can be checked at a
 * glance rather than asked for. It reads `progress.json` at the repository root
 * on every request — leave the tab open and refresh.
 *
 * Not part of the product: it returns a 404 in production, and it is the one
 * page on this site that is allowed to look like a status board.
 */
export default async function ProgressPage() {
  if (isProduction) notFound();

  let data: ProgressFile;
  try {
    const raw = await readFile(path.join(process.cwd(), "progress.json"), "utf8");
    data = JSON.parse(raw) as ProgressFile;
  } catch {
    notFound();
  }

  const all = data.groups.flatMap((group) => group.items);
  const done = all.filter((item) => item.state === "done").length;
  const doing = all.filter((item) => item.state === "doing").length;
  const percent = Math.round((done / all.length) * 100);

  return (
    <div className="page-gutter pt-12 pb-24">
      <div className="page-width max-w-4xl">
        <p className="label text-ink-3">Almirah · build progress</p>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="numeric font-display text-ink text-[clamp(3rem,8vw,5rem)] leading-none">
            {percent}%
          </p>
          <p className="body-lg">
            <span className="numeric text-ink">{done}</span> of{" "}
            <span className="numeric text-ink">{all.length}</span> complete
            {doing > 0 ? <span className="text-ink-3"> · {doing} in progress</span> : null}
          </p>
        </div>

        <div className="bg-rule mt-6 h-1 w-full">
          <div
            className="bg-ink h-full transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="meta text-ink-3 mt-4">
          Currently: {data.updated}. {data.note}
        </p>

        <ProgressLive />

        <div className="mt-14 space-y-10">
          {data.groups.map((group) => {
            const groupDone = group.items.filter((item) => item.state === "done").length;

            return (
              <section key={group.title}>
                <div className="border-rule mb-4 flex items-baseline justify-between gap-4 border-b pb-2">
                  <h2 className="label text-ink">{group.title}</h2>
                  <p className="numeric meta text-ink-3">
                    {groupDone}/{group.items.length}
                  </p>
                </div>

                <ul>
                  {group.items.map((item) => (
                    <li
                      key={item.label}
                      className="border-rule flex items-baseline gap-3 border-b py-2.5 last:border-b-0"
                    >
                      <Marker state={item.state} />
                      <span
                        className={cn(
                          "text-small",
                          item.state === "done"
                            ? "text-ink-2"
                            : item.state === "doing"
                              ? "text-ink"
                              : "text-ink-3",
                        )}
                      >
                        {item.label}
                      </span>
                      {item.state === "doing" ? (
                        <span className="meta text-claret ml-auto shrink-0">in progress</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="meta border-rule text-ink-3 mt-14 border-t pt-6">
          This page exists only in development and is not part of the product.
        </p>
      </div>
    </div>
  );
}

function Marker({ state }: { state: State }) {
  if (state === "done") {
    return (
      <span aria-label="Done" className="text-positive mt-0.5 shrink-0">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
          <path
            d="M2 6.2 4.6 8.8 10 3.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (state === "doing") {
    return (
      <span
        aria-label="In progress"
        className="bg-claret mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full"
      />
    );
  }

  return (
    <span
      aria-label="Not started"
      className="border-rule-strong mt-1 h-2 w-2 shrink-0 rounded-full border"
    />
  );
}
