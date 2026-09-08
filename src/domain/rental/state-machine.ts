import { BookingStatus, RentalStatus } from "@/generated/prisma/enums";

/**
 * The booking state machine.
 *
 * Booking status is the most safety-critical field in the marketplace: it
 * decides whether a garment is occupied, whether an owner is owed money, and
 * whether a deposit may be released. Scattering `status === "CONFIRMED"` checks
 * across route handlers is how that field ends up in a state nobody designed —
 * a booking marked returned that was never shipped, a payout for a rental that
 * was declined.
 *
 * So transitions are declared once, here, as data. Every status change in the
 * application goes through `assertTransition`, and any move that is not in this
 * table is refused before it reaches the database.
 */

export type { BookingStatus, RentalStatus };

/** Who is permitted to make a given move. */
export type TransitionActor = "RENTER" | "OWNER" | "PLATFORM" | "ADMIN";

export interface TransitionRule {
  readonly to: BookingStatus;
  /** Roles allowed to perform this transition. */
  readonly actors: readonly TransitionActor[];
  /** What this move means, used for the audit trail and system messages. */
  readonly description: string;
}

/**
 * Permitted moves, keyed by current status.
 *
 * Terminal states — DECLINED, CANCELLED, COMPLETED — have no outgoing
 * transitions and are deliberately absent from the table's value side except
 * where a dispute may reopen the money question.
 */
const TRANSITIONS: Readonly<Record<BookingStatus, readonly TransitionRule[]>> = {
  [BookingStatus.REQUESTED]: [
    {
      to: BookingStatus.ACCEPTED,
      actors: ["OWNER", "PLATFORM"],
      description: "The owner accepted the request",
    },
    {
      to: BookingStatus.DECLINED,
      actors: ["OWNER", "PLATFORM", "ADMIN"],
      description: "The owner declined the request",
    },
    {
      to: BookingStatus.CANCELLED,
      actors: ["RENTER", "PLATFORM", "ADMIN"],
      description: "The renter withdrew the request",
    },
  ],

  [BookingStatus.ACCEPTED]: [
    {
      to: BookingStatus.READY_FOR_PICKUP,
      actors: ["OWNER"],
      description: "The garment is ready to collect",
    },
    {
      to: BookingStatus.SHIPPED,
      actors: ["OWNER"],
      description: "The garment is on its way",
    },
    {
      to: BookingStatus.CANCELLED,
      actors: ["RENTER", "OWNER", "PLATFORM", "ADMIN"],
      description: "The booking was cancelled before handover",
    },
  ],

  [BookingStatus.READY_FOR_PICKUP]: [
    {
      to: BookingStatus.DELIVERED,
      actors: ["OWNER", "RENTER"],
      description: "The garment was collected",
    },
    {
      to: BookingStatus.CANCELLED,
      actors: ["OWNER", "PLATFORM", "ADMIN"],
      description: "The booking was cancelled before collection",
    },
  ],

  [BookingStatus.SHIPPED]: [
    {
      to: BookingStatus.DELIVERED,
      actors: ["RENTER", "PLATFORM"],
      description: "The garment arrived",
    },
    {
      to: BookingStatus.DISPUTED,
      actors: ["RENTER", "OWNER", "ADMIN"],
      description: "Something went wrong in transit",
    },
  ],

  [BookingStatus.DELIVERED]: [
    {
      to: BookingStatus.ACTIVE,
      actors: ["PLATFORM", "RENTER"],
      description: "The rental period began",
    },
    {
      to: BookingStatus.DISPUTED,
      actors: ["RENTER", "OWNER", "ADMIN"],
      description: "The garment was not as described",
    },
  ],

  [BookingStatus.ACTIVE]: [
    {
      to: BookingStatus.RETURN_REQUESTED,
      actors: ["RENTER", "PLATFORM"],
      description: "The renter started the return",
    },
    {
      to: BookingStatus.RETURNED,
      actors: ["OWNER"],
      description: "The owner has the garment back",
    },
    {
      to: BookingStatus.DISPUTED,
      actors: ["RENTER", "OWNER", "ADMIN"],
      description: "A problem was raised during the rental",
    },
  ],

  [BookingStatus.RETURN_REQUESTED]: [
    {
      to: BookingStatus.RETURNED,
      actors: ["OWNER", "PLATFORM"],
      description: "The garment was received back",
    },
    {
      to: BookingStatus.DISPUTED,
      actors: ["OWNER", "RENTER", "ADMIN"],
      description: "The return did not go to plan",
    },
  ],

  [BookingStatus.RETURNED]: [
    {
      to: BookingStatus.INSPECTION,
      actors: ["OWNER", "PLATFORM"],
      description: "The owner is checking the garment",
    },
    {
      to: BookingStatus.COMPLETED,
      actors: ["OWNER", "PLATFORM"],
      description: "Returned in good order",
    },
  ],

  [BookingStatus.INSPECTION]: [
    {
      to: BookingStatus.COMPLETED,
      actors: ["OWNER", "PLATFORM", "ADMIN"],
      description: "Inspection passed",
    },
    {
      to: BookingStatus.DISPUTED,
      actors: ["OWNER", "ADMIN"],
      description: "Damage was reported",
    },
  ],

  [BookingStatus.DISPUTED]: [
    {
      to: BookingStatus.COMPLETED,
      actors: ["ADMIN"],
      description: "The dispute was resolved and the rental closed",
    },
    {
      to: BookingStatus.CANCELLED,
      actors: ["ADMIN"],
      description: "The dispute was resolved by cancelling the rental",
    },
  ],

  // Terminal.
  [BookingStatus.DECLINED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.COMPLETED]: [],
};

export class InvalidTransitionError extends Error {
  readonly from: BookingStatus;
  readonly to: BookingStatus;
  readonly actor: TransitionActor;

  constructor(from: BookingStatus, to: BookingStatus, actor: TransitionActor, detail?: string) {
    super(detail ?? `A booking cannot move from ${from} to ${to} as ${actor}.`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
    this.actor = actor;
  }
}

/** Every move available from a status, regardless of who is asking. */
export function transitionsFrom(status: BookingStatus): readonly TransitionRule[] {
  return TRANSITIONS[status] ?? [];
}

/** The moves a particular actor may make from a status. */
export function availableTransitions(
  status: BookingStatus,
  actor: TransitionActor,
): readonly TransitionRule[] {
  return transitionsFrom(status).filter((rule) => rule.actors.includes(actor));
}

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: TransitionActor,
): boolean {
  return transitionsFrom(from).some((rule) => rule.to === to && rule.actors.includes(actor));
}

/**
 * The guard every status change in the application passes through.
 * Throws rather than returning false, because a caller that ignores the result
 * of a permission check is a security bug waiting to happen.
 */
export function assertTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: TransitionActor,
): TransitionRule {
  const rule = transitionsFrom(from).find((candidate) => candidate.to === to);

  if (!rule) {
    if (isTerminal(from)) {
      throw new InvalidTransitionError(
        from,
        to,
        actor,
        `This booking is already ${describeStatus(from).toLowerCase()} and cannot change.`,
      );
    }
    throw new InvalidTransitionError(from, to, actor);
  }

  if (!rule.actors.includes(actor)) {
    throw new InvalidTransitionError(
      from,
      to,
      actor,
      `Only ${rule.actors.map(describeActor).join(" or ")} can do that.`,
    );
  }

  return rule;
}

export function isTerminal(status: BookingStatus): boolean {
  return transitionsFrom(status).length === 0;
}

/**
 * Statuses in which the garment is committed and its dates are unavailable.
 *
 * This list is the single definition of occupancy. It is used by the
 * availability query, and mirrored by the `RentalItem_reject_overlap` database
 * trigger — the two must always agree.
 */
export const OCCUPYING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.REQUESTED,
  BookingStatus.ACCEPTED,
  BookingStatus.READY_FOR_PICKUP,
  BookingStatus.SHIPPED,
  BookingStatus.DELIVERED,
  BookingStatus.ACTIVE,
  BookingStatus.RETURN_REQUESTED,
  BookingStatus.RETURNED,
  BookingStatus.INSPECTION,
  BookingStatus.DISPUTED,
];

/** Statuses that release the dates. The complement of the list above. */
export const RELEASING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.DECLINED,
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
];

export function occupiesDates(status: BookingStatus): boolean {
  return OCCUPYING_STATUSES.includes(status);
}

/** Statuses in which the owner has earned their money, pending settlement. */
export function isEarned(status: BookingStatus): boolean {
  return status === BookingStatus.COMPLETED;
}

/** Whether the renter may still cancel without involving support. */
export function isCancellableByRenter(status: BookingStatus): boolean {
  return canTransition(status, BookingStatus.CANCELLED, "RENTER");
}

// ── Presentation ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.REQUESTED]: "Requested",
  [BookingStatus.ACCEPTED]: "Confirmed",
  [BookingStatus.DECLINED]: "Declined",
  [BookingStatus.READY_FOR_PICKUP]: "Ready to collect",
  [BookingStatus.SHIPPED]: "On its way",
  [BookingStatus.DELIVERED]: "Delivered",
  [BookingStatus.ACTIVE]: "With you",
  [BookingStatus.RETURN_REQUESTED]: "Return started",
  [BookingStatus.RETURNED]: "Returned",
  [BookingStatus.INSPECTION]: "Being checked",
  [BookingStatus.COMPLETED]: "Completed",
  [BookingStatus.CANCELLED]: "Cancelled",
  [BookingStatus.DISPUTED]: "In dispute",
};

/**
 * The same status reads differently depending on which side of the rental you
 * are on: "With you" is right for the renter and wrong for the owner.
 */
const OWNER_STATUS_LABELS: Partial<Record<BookingStatus, string>> = {
  [BookingStatus.ACTIVE]: "Out on rental",
  [BookingStatus.DELIVERED]: "With the renter",
  [BookingStatus.REQUESTED]: "Awaiting your reply",
};

export function describeStatus(status: BookingStatus, perspective: "RENTER" | "OWNER" = "RENTER") {
  if (perspective === "OWNER" && OWNER_STATUS_LABELS[status]) {
    return OWNER_STATUS_LABELS[status] as string;
  }
  return STATUS_LABELS[status];
}

/** Tone for the status indicator. Kept out of components so it stays uniform. */
export type StatusTone = "neutral" | "positive" | "caution" | "critical";

export function statusTone(status: BookingStatus): StatusTone {
  switch (status) {
    case BookingStatus.ACCEPTED:
    case BookingStatus.DELIVERED:
    case BookingStatus.ACTIVE:
    case BookingStatus.COMPLETED:
      return "positive";
    case BookingStatus.REQUESTED:
    case BookingStatus.READY_FOR_PICKUP:
    case BookingStatus.SHIPPED:
    case BookingStatus.RETURN_REQUESTED:
    case BookingStatus.INSPECTION:
    case BookingStatus.RETURNED:
      return "caution";
    case BookingStatus.DECLINED:
    case BookingStatus.CANCELLED:
    case BookingStatus.DISPUTED:
      return "critical";
    default:
      return "neutral";
  }
}

/**
 * The ordered journey shown as a progress trail on a rental. Terminal
 * exceptions (declined, cancelled, disputed) are not steps on a path and are
 * rendered separately.
 */
export const BOOKING_JOURNEY: readonly BookingStatus[] = [
  BookingStatus.REQUESTED,
  BookingStatus.ACCEPTED,
  BookingStatus.SHIPPED,
  BookingStatus.DELIVERED,
  BookingStatus.ACTIVE,
  BookingStatus.RETURNED,
  BookingStatus.COMPLETED,
];

export function journeyPosition(status: BookingStatus): number {
  const index = BOOKING_JOURNEY.indexOf(status);
  if (index >= 0) return index;
  // Statuses off the happy path still map onto the nearest milestone so the
  // trail does not jump backwards.
  switch (status) {
    case BookingStatus.READY_FOR_PICKUP:
      return BOOKING_JOURNEY.indexOf(BookingStatus.SHIPPED);
    case BookingStatus.RETURN_REQUESTED:
    case BookingStatus.INSPECTION:
      return BOOKING_JOURNEY.indexOf(BookingStatus.RETURNED);
    default:
      return -1;
  }
}

function describeActor(actor: TransitionActor): string {
  switch (actor) {
    case "RENTER":
      return "the renter";
    case "OWNER":
      return "the owner";
    case "ADMIN":
      return "an administrator";
    case "PLATFORM":
      return "Almirah";
  }
}

// ── Order-level status ──────────────────────────────────────────────────────

/**
 * Derives the basket's status from its bookings.
 *
 * The order-level status is never set directly; it is always a function of the
 * bookings inside it, so the two can never disagree.
 */
export function deriveRentalStatus(
  bookingStatuses: readonly BookingStatus[],
  paid: boolean,
): RentalStatus {
  if (bookingStatuses.length === 0) return RentalStatus.DRAFT;
  if (!paid) return RentalStatus.PAYMENT_PENDING;

  const every = (predicate: (status: BookingStatus) => boolean) => bookingStatuses.every(predicate);
  const some = (predicate: (status: BookingStatus) => boolean) => bookingStatuses.some(predicate);

  if (some((status) => status === BookingStatus.DISPUTED)) return RentalStatus.DISPUTED;

  if (every((status) => status === BookingStatus.CANCELLED || status === BookingStatus.DECLINED)) {
    return RentalStatus.CANCELLED;
  }

  if (every((status) => RELEASING_STATUSES.includes(status))) {
    return some((status) => status === BookingStatus.COMPLETED)
      ? RentalStatus.COMPLETED
      : RentalStatus.CANCELLED;
  }

  if (
    some(
      (status) =>
        status === BookingStatus.ACTIVE ||
        status === BookingStatus.DELIVERED ||
        status === BookingStatus.RETURN_REQUESTED,
    )
  ) {
    return RentalStatus.ACTIVE;
  }

  return RentalStatus.CONFIRMED;
}
