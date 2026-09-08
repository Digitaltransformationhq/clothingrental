"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { resolveReport } from "@/server/actions/admin";

/**
 * Action or dismiss a report.
 *
 * Two outcomes, both requiring a note. Dismissing needs a reason as much as
 * actioning does: the note is what a second moderator reads when the same
 * member is reported again, and "dismissed" with no reason tells them nothing.
 */
export function ReportActions({ reportId, status }: { reportId: string; status: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"idle" | "ACTIONED" | "DISMISSED">("idle");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status !== "PENDING" && mode === "idle") {
    return (
      <div className="mt-4">
        <Button size="sm" variant="quiet" onClick={() => setMode("ACTIONED")}>
          Revisit
        </Button>
      </div>
    );
  }

  const submit = async () => {
    if (mode === "idle") return;
    setPending(true);
    setError(null);
    const result = await resolveReport({ reportId, status: mode, note: note.trim() });
    setPending(false);

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
          <Button size="sm" onClick={() => setMode("ACTIONED")}>
            Act on this
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMode("DISMISSED")}>
            Dismiss
          </Button>
        </div>
      ) : (
        <div>
          <label htmlFor={`report-note-${reportId}`} className="label text-ink-2 mb-2 block">
            {mode === "ACTIONED" ? "What did you do?" : "Why is this being dismissed?"}
          </label>
          <textarea
            id={`report-note-${reportId}`}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Recorded against the report and in the audit log."
            className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink w-full border p-3 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button size="sm" disabled={note.trim().length < 10} loading={pending} onClick={submit}>
              {mode === "ACTIONED" ? "Mark as actioned" : "Dismiss the report"}
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
