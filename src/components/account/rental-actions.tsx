"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  availableTransitions,
  type BookingStatus,
  type TransitionActor,
} from "@/domain/rental/state-machine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  acceptBooking,
  cancelBooking,
  completeBooking,
  declineBooking,
  markDelivered,
  markReadyForPickup,
  markReturned,
  markShipped,
  requestReturn,
} from "@/server/actions/bookings";
import type { ActionResult } from "@/server/errors";

/**
 * The actions available on a booking.
 *
 * Derived from the state machine rather than hardcoded per screen: the buttons
 * a member sees are exactly the transitions the domain will permit them, so the
 * interface cannot offer something the server will refuse. Adding a transition
 * to the table adds a button here.
 */

type ActionFn = (input: { bookingId: string; reason?: string }) => Promise<ActionResult<void>>;

/** Label and handler for each transition, per side of the rental. */
const ACTIONS: Partial<
  Record<
    BookingStatus,
    { label: string; run: ActionFn; tone?: "primary" | "secondary" | "quiet"; confirm?: string }
  >
> = {
  ACCEPTED: { label: "Accept request", run: acceptBooking, tone: "primary" },
  DECLINED: {
    label: "Decline",
    run: declineBooking,
    tone: "quiet",
    confirm: "Decline this request? The dates go straight back into your calendar.",
  },
  READY_FOR_PICKUP: { label: "Ready to collect", run: markReadyForPickup, tone: "secondary" },
  SHIPPED: { label: "Mark as sent", run: markShipped, tone: "primary" },
  DELIVERED: { label: "It's arrived", run: markDelivered, tone: "primary" },
  RETURN_REQUESTED: { label: "Start the return", run: requestReturn, tone: "secondary" },
  RETURNED: { label: "It's back with me", run: markReturned, tone: "primary" },
  COMPLETED: {
    label: "All good — close it",
    run: completeBooking,
    tone: "primary",
    confirm: "Close this rental and return the deposit in full?",
  },
  CANCELLED: {
    label: "Cancel",
    run: cancelBooking,
    tone: "quiet",
    confirm: "Cancel this booking?",
  },
};

export function RentalActions({
  bookingId,
  status,
  perspective,
  className,
}: {
  bookingId: string;
  status: BookingStatus;
  perspective: "RENTER" | "OWNER";
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const actor: TransitionActor = perspective;
  const available = availableTransitions(status, actor).filter((rule) => ACTIONS[rule.to]);

  if (available.length === 0) return null;

  const run = async (to: BookingStatus) => {
    const action = ACTIONS[to];
    if (!action) return;
    if (action.confirm && !window.confirm(action.confirm)) return;

    setPending(to);
    setError(null);

    const result = await action.run({ bookingId });

    setPending(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        {available.map((rule) => {
          const action = ACTIONS[rule.to];
          if (!action) return null;
          return (
            <Button
              key={rule.to}
              variant={action.tone ?? "secondary"}
              size="sm"
              loading={pending === rule.to}
              disabled={pending !== null && pending !== rule.to}
              onClick={() => run(rule.to)}
            >
              {action.label}
            </Button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className={cn(
            "border-critical bg-critical-soft text-small text-ink mt-3 border-l-2 px-3 py-2",
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
