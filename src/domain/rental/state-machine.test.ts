import { describe, expect, it } from "vitest";

import { BookingStatus, RentalStatus } from "@/generated/prisma/enums";

import {
  assertTransition,
  availableTransitions,
  canTransition,
  deriveRentalStatus,
  InvalidTransitionError,
  isTerminal,
  journeyPosition,
  occupiesDates,
  OCCUPYING_STATUSES,
  RELEASING_STATUSES,
  statusTone,
  transitionsFrom,
} from "./state-machine";

const ALL_STATUSES = Object.values(BookingStatus);

describe("transition table", () => {
  it("covers every status in the schema", () => {
    // A status added to the Prisma enum without a rule here would silently
    // become an unreachable dead end.
    for (const status of ALL_STATUSES) {
      expect(transitionsFrom(status)).toBeDefined();
    }
  });

  it("never transitions to a status that does not exist", () => {
    for (const status of ALL_STATUSES) {
      for (const rule of transitionsFrom(status)) {
        expect(ALL_STATUSES).toContain(rule.to);
      }
    }
  });

  it("never allows a status to transition to itself", () => {
    for (const status of ALL_STATUSES) {
      expect(transitionsFrom(status).some((rule) => rule.to === status)).toBe(false);
    }
  });

  it("gives every transition at least one permitted actor", () => {
    for (const status of ALL_STATUSES) {
      for (const rule of transitionsFrom(status)) {
        expect(rule.actors.length).toBeGreaterThan(0);
      }
    }
  });

  it("treats declined, cancelled and completed as terminal", () => {
    expect(isTerminal(BookingStatus.DECLINED)).toBe(true);
    expect(isTerminal(BookingStatus.CANCELLED)).toBe(true);
    expect(isTerminal(BookingStatus.COMPLETED)).toBe(true);
    expect(isTerminal(BookingStatus.REQUESTED)).toBe(false);
  });

  it("makes every status reachable from REQUESTED", () => {
    const reached = new Set<BookingStatus>([BookingStatus.REQUESTED]);
    const queue: BookingStatus[] = [BookingStatus.REQUESTED];
    while (queue.length > 0) {
      const status = queue.shift() as BookingStatus;
      for (const rule of transitionsFrom(status)) {
        if (!reached.has(rule.to)) {
          reached.add(rule.to);
          queue.push(rule.to);
        }
      }
    }
    for (const status of ALL_STATUSES) {
      expect(reached.has(status)).toBe(true);
    }
  });
});

describe("the happy path", () => {
  it("runs request → accept → ship → deliver → active → return → complete", () => {
    const path: Array<[BookingStatus, BookingStatus, "RENTER" | "OWNER" | "PLATFORM"]> = [
      [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, "OWNER"],
      [BookingStatus.ACCEPTED, BookingStatus.SHIPPED, "OWNER"],
      [BookingStatus.SHIPPED, BookingStatus.DELIVERED, "RENTER"],
      [BookingStatus.DELIVERED, BookingStatus.ACTIVE, "PLATFORM"],
      [BookingStatus.ACTIVE, BookingStatus.RETURN_REQUESTED, "RENTER"],
      [BookingStatus.RETURN_REQUESTED, BookingStatus.RETURNED, "OWNER"],
      [BookingStatus.RETURNED, BookingStatus.COMPLETED, "OWNER"],
    ];

    for (const [from, to, actor] of path) {
      expect(() => assertTransition(from, to, actor)).not.toThrow();
    }
  });
});

describe("authorisation", () => {
  it("stops a renter accepting their own request", () => {
    // The single most obvious way to defraud a marketplace like this.
    expect(canTransition(BookingStatus.REQUESTED, BookingStatus.ACCEPTED, "RENTER")).toBe(false);
    expect(() =>
      assertTransition(BookingStatus.REQUESTED, BookingStatus.ACCEPTED, "RENTER"),
    ).toThrow(InvalidTransitionError);
  });

  it("stops an owner marking a garment delivered before it has shipped", () => {
    expect(canTransition(BookingStatus.ACCEPTED, BookingStatus.DELIVERED, "OWNER")).toBe(false);
  });

  it("stops anyone skipping straight to completed", () => {
    expect(canTransition(BookingStatus.REQUESTED, BookingStatus.COMPLETED, "OWNER")).toBe(false);
    expect(canTransition(BookingStatus.REQUESTED, BookingStatus.COMPLETED, "ADMIN")).toBe(false);
  });

  it("stops a terminal booking from moving at all", () => {
    for (const actor of ["RENTER", "OWNER", "ADMIN", "PLATFORM"] as const) {
      expect(() => assertTransition(BookingStatus.COMPLETED, BookingStatus.ACTIVE, actor)).toThrow(
        InvalidTransitionError,
      );
    }
  });

  it("explains itself in language a member can act on", () => {
    try {
      assertTransition(BookingStatus.REQUESTED, BookingStatus.ACCEPTED, "RENTER");
      expect.unreachable("the transition should have been refused");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect((error as Error).message).toMatch(/only the owner/i);
    }
  });

  it("lets only an administrator close a dispute", () => {
    expect(availableTransitions(BookingStatus.DISPUTED, "OWNER")).toHaveLength(0);
    expect(availableTransitions(BookingStatus.DISPUTED, "ADMIN").length).toBeGreaterThan(0);
  });
});

describe("occupancy", () => {
  it("partitions every status into occupying or releasing", () => {
    // The availability query and the database trigger both read this
    // partition. A status in neither list would leak a garment's dates.
    for (const status of ALL_STATUSES) {
      const occupying = OCCUPYING_STATUSES.includes(status);
      const releasing = RELEASING_STATUSES.includes(status);
      expect(occupying !== releasing).toBe(true);
    }
  });

  it("frees the dates only once a booking is declined, cancelled or completed", () => {
    expect(occupiesDates(BookingStatus.REQUESTED)).toBe(true);
    expect(occupiesDates(BookingStatus.DISPUTED)).toBe(true);
    expect(occupiesDates(BookingStatus.CANCELLED)).toBe(false);
    expect(occupiesDates(BookingStatus.COMPLETED)).toBe(false);
  });
});

describe("presentation", () => {
  it("gives every status a tone", () => {
    for (const status of ALL_STATUSES) {
      expect(["neutral", "positive", "caution", "critical"]).toContain(statusTone(status));
    }
  });

  it("keeps the progress trail from moving backwards on side paths", () => {
    expect(journeyPosition(BookingStatus.READY_FOR_PICKUP)).toBe(
      journeyPosition(BookingStatus.SHIPPED),
    );
    expect(journeyPosition(BookingStatus.INSPECTION)).toBe(journeyPosition(BookingStatus.RETURNED));
    expect(journeyPosition(BookingStatus.CANCELLED)).toBe(-1);
  });
});

describe("deriveRentalStatus", () => {
  it("is payment pending until the basket is paid", () => {
    expect(deriveRentalStatus([BookingStatus.REQUESTED], false)).toBe(RentalStatus.PAYMENT_PENDING);
  });

  it("is a draft with nothing in it", () => {
    expect(deriveRentalStatus([], false)).toBe(RentalStatus.DRAFT);
  });

  it("is active while any garment is with the renter", () => {
    expect(deriveRentalStatus([BookingStatus.COMPLETED, BookingStatus.ACTIVE], true)).toBe(
      RentalStatus.ACTIVE,
    );
  });

  it("completes only when every booking has closed", () => {
    expect(deriveRentalStatus([BookingStatus.COMPLETED, BookingStatus.COMPLETED], true)).toBe(
      RentalStatus.COMPLETED,
    );
    expect(deriveRentalStatus([BookingStatus.COMPLETED, BookingStatus.CANCELLED], true)).toBe(
      RentalStatus.COMPLETED,
    );
  });

  it("cancels when nothing survived", () => {
    expect(deriveRentalStatus([BookingStatus.CANCELLED, BookingStatus.DECLINED], true)).toBe(
      RentalStatus.CANCELLED,
    );
  });

  it("lets one dispute take precedence over everything else", () => {
    expect(deriveRentalStatus([BookingStatus.COMPLETED, BookingStatus.DISPUTED], true)).toBe(
      RentalStatus.DISPUTED,
    );
  });
});
