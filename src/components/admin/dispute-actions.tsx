"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatMoney, money } from "@/domain/money";
import { resolveDispute } from "@/server/actions/admin";

type Outcome = "RENTER_FAVOURED" | "OWNER_FAVOURED" | "SPLIT" | "NO_ACTION";

const OUTCOMES: ReadonlyArray<{ value: Outcome; label: string; detail: string }> = [
  {
    value: "RENTER_FAVOURED",
    label: "For the renter",
    detail: "The deposit goes back to the renter.",
  },
  {
    value: "OWNER_FAVOURED",
    label: "For the owner",
    detail: "The settlement is paid to the owner from the deposit.",
  },
  { value: "SPLIT", label: "Split", detail: "Part of the deposit is paid, the rest returned." },
  { value: "NO_ACTION", label: "No action", detail: "Nothing is charged and nothing withheld." },
];

/**
 * Settle a dispute.
 *
 * The note is the product here, not the outcome. Both members read it, and the
 * server holds it to twenty characters for that reason; the same floor is
 * mirrored on the button so the writing happens before the submit rather than
 * after a round trip.
 *
 * The settlement is only asked for on the two outcomes that move money, and it
 * is capped at the deposit actually held — a settlement larger than the deposit
 * is money nobody is holding.
 */
export function DisputeActions({
  disputeId,
  status,
  depositMinor,
}: {
  disputeId: string;
  status: string;
  depositMinor: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [settlement, setSettlement] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const depositRupees = Math.round(depositMinor / 100);
  const movesMoney = outcome === "OWNER_FAVOURED" || outcome === "SPLIT";
  const settlementValue = settlement === "" ? null : Number(settlement);
  const settlementTooLarge = settlementValue !== null && settlementValue > depositRupees;
  const ready =
    outcome !== null &&
    note.trim().length >= 20 &&
    !settlementTooLarge &&
    (!movesMoney || (settlementValue !== null && settlementValue > 0));

  if (status === "RESOLVED" && !open) return null;

  const submit = async () => {
    if (!outcome) return;
    setPending(true);
    setError(null);
    const result = await resolveDispute({
      disputeId,
      outcome,
      note: note.trim(),
      ...(movesMoney && settlementValue !== null ? { settlementRupees: settlementValue } : {}),
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error?.message ?? "That didn't work.");
      return;
    }
    setOpen(false);
    setOutcome(null);
    setSettlement("");
    setNote("");
    router.refresh();
  };

  return (
    <div className="border-rule mt-4 border-t pt-4">
      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          Resolve this dispute
        </Button>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="label text-ink-2 mb-2">Outcome</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {OUTCOMES.map((option) => (
                <label
                  key={option.value}
                  className={
                    "border-rule flex cursor-pointer gap-3 border p-3 transition-colors " +
                    (outcome === option.value ? "border-ink bg-paper-2" : "hover:border-ink")
                  }
                >
                  <input
                    type="radio"
                    name={`outcome-${disputeId}`}
                    value={option.value}
                    checked={outcome === option.value}
                    onChange={() => setOutcome(option.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-small text-ink block">{option.label}</span>
                    <span className="meta text-ink-3 mt-0.5 block">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {movesMoney ? (
            <div>
              <label htmlFor={`settlement-${disputeId}`} className="label text-ink-2 mb-2 block">
                Settlement to the owner
              </label>
              <div className="border-rule bg-surface focus-within:border-ink flex h-12 items-center border">
                <span className="text-body text-ink-3 pl-3.5">₹</span>
                <input
                  id={`settlement-${disputeId}`}
                  type="number"
                  min={0}
                  max={depositRupees}
                  value={settlement}
                  onChange={(event) => setSettlement(event.target.value)}
                  className="numeric text-body text-ink w-full bg-transparent px-2 focus:outline-none"
                />
              </div>
              <p className="meta text-ink-3 mt-2">
                Deposit held: {formatMoney(money(depositMinor, "INR"))}. The remainder goes back to
                the renter.
              </p>
              {settlementTooLarge ? (
                <p role="alert" className="meta text-critical mt-1">
                  That is more than the deposit being held.
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label htmlFor={`dispute-note-${disputeId}`} className="label text-ink-2 mb-2 block">
              How you reached this
            </label>
            <textarea
              id={`dispute-note-${disputeId}`}
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Both members read this exactly as written. Set out what you looked at and why you decided this way."
              className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink w-full border p-3 focus:outline-none"
            />
            {note.trim().length > 0 && note.trim().length < 20 ? (
              <p className="meta text-ink-3 mt-2">
                {20 - note.trim().length} more characters — both members will read this.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button size="sm" disabled={!ready} loading={pending} onClick={submit}>
              Resolve and notify both members
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
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
