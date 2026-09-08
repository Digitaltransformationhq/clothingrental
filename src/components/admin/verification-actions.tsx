"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { reviewVerification } from "@/server/actions/admin";

/**
 * Approve or reject an identity check.
 *
 * Approving a government ID flips `isIdentityVerified` on the member's profile,
 * which is the badge every owner is told to trust before accepting a booking —
 * so approval is the one decision here that is not reversible by simply
 * deciding again, and it asks for confirmation.
 *
 * Rejection requires a note. The member has to know what to resubmit.
 */
export function VerificationActions({
  verificationId,
  status,
}: {
  verificationId: string;
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"idle" | "confirming" | "rejecting">("idle");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (decision: "APPROVED" | "REJECTED") => {
    setPending(decision);
    setError(null);
    const result = await reviewVerification({
      verificationId,
      decision,
      ...(note.trim() ? { notes: note.trim() } : {}),
    });
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
    <div className="border-rule mt-4 border-t pt-4">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-3">
          {status !== "APPROVED" ? (
            <Button size="sm" onClick={() => setMode("confirming")}>
              Approve
            </Button>
          ) : null}
          {status !== "REJECTED" ? (
            <Button size="sm" variant="secondary" onClick={() => setMode("rejecting")}>
              Reject
            </Button>
          ) : null}
        </div>
      ) : mode === "confirming" ? (
        <div>
          <p className="text-small text-ink-2">
            This marks the member as identity-verified across the site. Owners are told to rely on
            that badge when deciding who to lend to.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button size="sm" loading={pending === "APPROVED"} onClick={() => run("APPROVED")}>
              Yes, verify this member
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor={`verify-note-${verificationId}`} className="label text-ink-2 mb-2 block">
            What was wrong with it?
          </label>
          <textarea
            id={`verify-note-${verificationId}`}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="The member reads this and resubmits. Say what to send instead."
            className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink w-full border p-3 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              size="sm"
              disabled={note.trim().length < 10}
              loading={pending === "REJECTED"}
              onClick={() => run("REJECTED")}
            >
              Reject and ask again
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
