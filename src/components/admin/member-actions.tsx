"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { reinstateMember, setMemberRole, suspendMember } from "@/server/actions/admin";
import { cn } from "@/lib/cn";

/**
 * Suspending, reinstating and granting staff access.
 *
 * Suspension asks for a reason and confirms, because it signs the member out
 * everywhere and takes their listings down — it is the most disruptive thing
 * anybody can do from this interface.
 */
export function MemberActions({
  userId,
  name,
  status,
  role,
  canSetRole,
}: {
  userId: string;
  name: string;
  status: string;
  role: string;
  canSetRole: boolean;
}) {
  const router = useRouter();
  const [suspending, setSuspending] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const act = async (run: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setPending(true);
    setError(null);
    const result = await run();
    setPending(false);
    if (!result.ok) {
      setError(result.error?.message ?? "That didn't work.");
      return;
    }
    setSuspending(false);
    setReason("");
    router.refresh();
  };

  if (suspending) {
    return (
      <div className="min-w-56">
        <label htmlFor={`reason-${userId}`} className="sr-only">
          Reason for suspending {name}
        </label>
        <textarea
          id={`reason-${userId}`}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason — the member sees this"
          className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink w-full border p-2 focus:outline-none"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={reason.trim().length < 5 || pending}
            onClick={() => act(() => suspendMember({ userId, reason }))}
            className="border-critical text-small text-critical hover:bg-critical hover:text-ink-inverse border px-2.5 py-1.5 transition-colors disabled:opacity-40"
          >
            Suspend
          </button>
          <button
            type="button"
            onClick={() => setSuspending(false)}
            className="text-small text-ink-2 hover:text-ink px-2 py-1.5"
          >
            Cancel
          </button>
        </div>
        {error ? <p className="meta text-critical mt-1.5">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {status === "ACTIVE" ? (
        <button
          type="button"
          onClick={() => setSuspending(true)}
          className="text-small text-critical hover:underline"
        >
          Suspend
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => act(() => reinstateMember({ userId }))}
          className="text-small text-positive hover:underline"
        >
          Reinstate
        </button>
      )}

      {canSetRole ? (
        <label className="meta text-ink-3">
          <span className="sr-only">Role for {name}</span>
          <select
            value={role}
            disabled={pending}
            onChange={(event) =>
              act(() =>
                setMemberRole({
                  userId,
                  role: event.target.value as "MEMBER" | "MODERATOR" | "ADMIN",
                }),
              )
            }
            className={cn(
              "border-rule bg-surface text-small text-ink-2 border px-1.5 py-1",
              "focus:border-ink focus:outline-none",
            )}
          >
            <option value="MEMBER">Member</option>
            <option value="MODERATOR">Moderator</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
      ) : null}

      {error ? <p className="meta text-critical">{error}</p> : null}
    </div>
  );
}
