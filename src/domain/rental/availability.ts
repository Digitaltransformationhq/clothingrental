import {
  addDays,
  compareDates,
  type DateRange,
  dateRange,
  differenceInDays,
  eachDate,
  extendRange,
  type IsoDate,
  mergeRanges,
  rangesOverlap,
} from "@/domain/dates";

/**
 * Availability.
 *
 * Pure functions over dates and policy — no database, no clock, no framework.
 * Everything here is deterministic and exhaustively testable, which matters
 * because this is the logic that decides whether a member's money is taken for
 * a garment that somebody else already has.
 *
 * The browser calls these functions to paint the calendar. The server calls the
 * *same* functions inside the booking transaction to decide whether the request
 * is honoured. The client's answer is a courtesy; the server's is the truth.
 */

/** How far ahead the marketplace accepts bookings. */
export const BOOKING_HORIZON_DAYS = 240;

export interface AvailabilityPolicy {
  /** Shortest rental the owner accepts, in days. */
  readonly minRentalDays: number;
  /** Longest rental the owner accepts, in days. */
  readonly maxRentalDays: number;
  /**
   * Turnaround reserved after every rental for return, cleaning and
   * inspection. The garment is not rentable during it.
   */
  readonly bufferDays: number;
  /** Days of notice the owner needs before a rental may start. */
  readonly leadTimeDays: number;
}

export type OccupancyKind = "BOOKING" | "BLOCK";

/** A window in which the garment is already spoken for. */
export interface Occupancy {
  readonly range: DateRange;
  readonly kind: OccupancyKind;
  /**
   * Turnaround attached to this particular occupancy. Snapshotted per booking
   * rather than read from current policy, so that an owner shortening their
   * turnaround tomorrow cannot retroactively free a day that a garment in
   * transit still needs.
   */
  readonly bufferDays: number;
  readonly id?: string;
}

export type UnavailableReason =
  | "IN_PAST"
  | "TOO_SOON"
  | "TOO_FAR_AHEAD"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "ALREADY_BOOKED"
  | "OWNER_BLOCKED";

export interface AvailabilityFailure {
  readonly ok: false;
  readonly reason: UnavailableReason;
  /** Copy written for the member, not for the log. */
  readonly message: string;
  /** The earliest range satisfying the policy, when one can be suggested. */
  readonly suggestion?: DateRange;
}

export interface AvailabilitySuccess {
  readonly ok: true;
  readonly range: DateRange;
  readonly days: number;
}

export type AvailabilityResult = AvailabilitySuccess | AvailabilityFailure;

// ── Occupied windows ────────────────────────────────────────────────────────

/**
 * Expands each occupancy by its own turnaround and merges the result, giving
 * the minimal set of windows during which the garment cannot start or continue
 * a rental.
 */
export function occupiedRanges(occupancy: readonly Occupancy[]): DateRange[] {
  return mergeRanges(occupancy.map((entry) => extendRange(entry.range, entry.bufferDays)));
}

/**
 * The individual dates a calendar should render as unavailable, within a
 * window. Returned as a Set for O(1) lookup while painting a month grid.
 */
export function unavailableDates(occupancy: readonly Occupancy[], window: DateRange): Set<IsoDate> {
  const unavailable = new Set<IsoDate>();
  for (const range of occupiedRanges(occupancy)) {
    if (!rangesOverlap(range, window)) continue;
    const clipped = dateRange(
      range.start < window.start ? window.start : range.start,
      range.end > window.end ? window.end : range.end,
    );
    for (const date of eachDate(clipped)) unavailable.add(date);
  }
  return unavailable;
}

/** The first date a rental may start under the policy, ignoring occupancy. */
export function earliestStart(policy: AvailabilityPolicy, today: IsoDate): IsoDate {
  return addDays(today, Math.max(0, policy.leadTimeDays));
}

/** The last date a rental may start. */
export function latestStart(today: IsoDate): IsoDate {
  return addDays(today, BOOKING_HORIZON_DAYS);
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Decides whether a requested range can be booked.
 *
 * Checks run in the order a member would care about them: first whether the
 * dates make sense at all, then whether the owner's policy allows the
 * duration, and only then whether the garment is free. A member who asked for
 * one day on a three-day-minimum listing should be told about the minimum, not
 * about a conflict five weeks away.
 */
export function checkAvailability(input: {
  policy: AvailabilityPolicy;
  occupancy: readonly Occupancy[];
  requested: DateRange;
  today: IsoDate;
}): AvailabilityResult {
  const { policy, occupancy, requested, today } = input;
  const days = differenceInDays(requested.start, requested.end);

  if (compareDates(requested.start, today) < 0) {
    return {
      ok: false,
      reason: "IN_PAST",
      message: "Those dates have already passed. Choose a start date from today onwards.",
    };
  }

  const minimumStart = earliestStart(policy, today);
  if (compareDates(requested.start, minimumStart) < 0) {
    return {
      ok: false,
      reason: "TOO_SOON",
      message:
        policy.leadTimeDays === 1
          ? "This piece needs a day's notice. The earliest start is tomorrow."
          : `This piece needs ${policy.leadTimeDays} days' notice before a rental begins.`,
      suggestion: safeRange(minimumStart, Math.max(days, policy.minRentalDays)),
    };
  }

  if (compareDates(requested.start, latestStart(today)) > 0) {
    return {
      ok: false,
      reason: "TOO_FAR_AHEAD",
      message: `Bookings open ${BOOKING_HORIZON_DAYS} days ahead. Try a nearer date.`,
    };
  }

  if (days < policy.minRentalDays) {
    return {
      ok: false,
      reason: "TOO_SHORT",
      message: `This piece rents for a minimum of ${policy.minRentalDays} days.`,
      suggestion: safeRange(requested.start, policy.minRentalDays),
    };
  }

  if (days > policy.maxRentalDays) {
    return {
      ok: false,
      reason: "TOO_LONG",
      message: `This piece rents for up to ${policy.maxRentalDays} days at a time.`,
      suggestion: safeRange(requested.start, policy.maxRentalDays),
    };
  }

  // The requested range must clear existing occupancy, and must also leave its
  // own turnaround before the next one begins — otherwise a garment could be
  // booked out again while it is still in the wash.
  const requestedWithBuffer = extendRange(requested, policy.bufferDays);
  const conflict = occupancy.find((entry) =>
    rangesOverlap(extendRange(entry.range, entry.bufferDays), requestedWithBuffer),
  );

  if (conflict) {
    const suggestion = nextAvailableRange({
      policy,
      occupancy,
      days,
      from: requested.start,
      today,
    });
    return {
      ok: false,
      reason: conflict.kind === "BLOCK" ? "OWNER_BLOCKED" : "ALREADY_BOOKED",
      message:
        conflict.kind === "BLOCK"
          ? "The owner has kept these dates for themselves."
          : "This piece is already out on those dates.",
      ...(suggestion ? { suggestion } : {}),
    };
  }

  return { ok: true, range: requested, days };
}

function safeRange(start: IsoDate, days: number): DateRange {
  return dateRange(start, addDays(start, Math.max(1, days)));
}

/**
 * Finds the first range of `days` length, at or after `from`, that satisfies
 * both the policy and current occupancy.
 *
 * Rather than testing every date in the horizon, it jumps to the end of each
 * blocking window — a garment booked for a fortnight is skipped in one step
 * instead of fourteen.
 */
export function nextAvailableRange(input: {
  policy: AvailabilityPolicy;
  occupancy: readonly Occupancy[];
  days: number;
  from: IsoDate;
  today: IsoDate;
}): DateRange | undefined {
  const { policy, occupancy, today } = input;
  const days = Math.min(Math.max(input.days, policy.minRentalDays), policy.maxRentalDays);

  const blocked = occupiedRanges(occupancy).sort((a, b) => compareDates(a.start, b.start));
  const horizonEnd = addDays(today, BOOKING_HORIZON_DAYS);

  let cursor =
    compareDates(input.from, earliestStart(policy, today)) < 0
      ? earliestStart(policy, today)
      : input.from;

  while (compareDates(cursor, horizonEnd) <= 0) {
    const candidate = extendRange(dateRange(cursor, addDays(cursor, days)), policy.bufferDays);
    const blocker = blocked.find((range) => rangesOverlap(range, candidate));

    if (!blocker) return dateRange(cursor, addDays(cursor, days));

    // Resume the search the day the blocking window releases.
    cursor = blocker.end;
  }

  return undefined;
}

/**
 * Condenses occupancy into the contiguous free windows in a period, which is
 * what an owner's calendar and a listing's "available from" line both need.
 */
export function availableWindows(input: {
  occupancy: readonly Occupancy[];
  window: DateRange;
  minimumDays: number;
}): DateRange[] {
  const { occupancy, window, minimumDays } = input;
  const blocked = occupiedRanges(occupancy)
    .filter((range) => rangesOverlap(range, window))
    .sort((a, b) => compareDates(a.start, b.start));

  const free: DateRange[] = [];
  let cursor = window.start;

  for (const range of blocked) {
    if (compareDates(range.start, cursor) > 0) {
      const end = range.start < window.end ? range.start : window.end;
      if (differenceInDays(cursor, end) >= minimumDays) free.push(dateRange(cursor, end));
    }
    if (compareDates(range.end, cursor) > 0) cursor = range.end;
  }

  if (compareDates(cursor, window.end) < 0 && differenceInDays(cursor, window.end) >= minimumDays) {
    free.push(dateRange(cursor, window.end));
  }

  return free;
}

/**
 * A coarse signal for listing cards: is this piece free soon, or is it out for
 * the foreseeable future? Used for the availability dot in the shop grid,
 * where a full calendar would be far too much information.
 */
export type AvailabilitySignal = "AVAILABLE_NOW" | "AVAILABLE_SOON" | "HEAVILY_BOOKED";

export function availabilitySignal(input: {
  policy: AvailabilityPolicy;
  occupancy: readonly Occupancy[];
  today: IsoDate;
}): { signal: AvailabilitySignal; from: IsoDate | undefined } {
  const next = nextAvailableRange({
    policy: input.policy,
    occupancy: input.occupancy,
    days: input.policy.minRentalDays,
    from: earliestStart(input.policy, input.today),
    today: input.today,
  });

  if (!next) return { signal: "HEAVILY_BOOKED", from: undefined };

  const wait = differenceInDays(input.today, next.start);
  if (wait <= input.policy.leadTimeDays + 1) return { signal: "AVAILABLE_NOW", from: next.start };
  if (wait <= 21) return { signal: "AVAILABLE_SOON", from: next.start };
  return { signal: "HEAVILY_BOOKED", from: next.start };
}
