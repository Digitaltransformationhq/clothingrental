"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { approveListing, rejectListing, removeListing } from "@/server/actions/admin";

/**
 * Approve, reject or remove a listing.
 *
 * Rejection requires a written reason before the button becomes available. That
 * is a deliberate piece of friction: the reason is emailed to the owner, and a
 * rejection they cannot act on wastes their time and ours.
 */
export function ModerationActions({
  listingId,
  moderation,
  className,
}: {
  listingId: string;
  moderation: string;
  className?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"idle" | "rejecting" | "removing">("idle");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    key: string,
  ) => {
    setPending(key);
    setError(null);
    const result = await action();
    setPending(null);

    if (!result.ok) {
      setError(result.error?.message ?? "That didn't work.");
      return;
    }
    setMode("idle");
    setNote("");
    router.refresh();
  };

  return (
    <div className={className}>
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-3">
          {moderation !== "APPROVED" ? (
            <Button
              size="sm"
              loading={pending === "approve"}
              onClick={() => run(() => approveListing({ listingId }), "approve")}
            >
              Approve and publish
            </Button>
          ) : null}

          {moderation === "PENDING" ? (
            <Button size="sm" variant="secondary" onClick={() => setMode("rejecting")}>
              Send back
            </Button>
          ) : null}

          <Button size="sm" variant="quiet" onClick={() => setMode("removing")}>
            Remove
          </Button>
        </div>
      ) : (
        <div>
          <label htmlFor={`note-${listingId}`} className="label text-ink-2 mb-2 block">
            {mode === "rejecting" ? "What needs changing?" : "Why is this being removed?"}
          </label>
          <textarea
            id={`note-${listingId}`}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              mode === "rejecting"
                ? "The owner reads this exactly as written. Be specific and be kind."
                : "Recorded in the audit log."
            }
            className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink w-full border p-3 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              size="sm"
              disabled={note.trim().length < 10}
              loading={pending === "note"}
              onClick={() =>
                run(
                  () =>
                    mode === "rejecting"
                      ? rejectListing({ listingId, note })
                      : removeListing({ listingId, note }),
                  "note",
                )
              }
            >
              {mode === "rejecting" ? "Send back to the owner" : "Remove the listing"}
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
          {note.trim().length > 0 && note.trim().length < 10 ? (
            <p className="meta text-ink-3 mt-2">A little more detail — at least ten characters.</p>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-small text-critical mt-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}
