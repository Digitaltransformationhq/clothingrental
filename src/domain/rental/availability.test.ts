import { describe, expect, it } from "vitest";

import { dateRange, type IsoDate } from "@/domain/dates";

import {
  type AvailabilityPolicy,
  availabilitySignal,
  availableWindows,
  checkAvailability,
  nextAvailableRange,
  type Occupancy,
  occupiedRanges,
  unavailableDates,
} from "./availability";

const TODAY: IsoDate = "2026-09-01";

const policy: AvailabilityPolicy = {
  minRentalDays: 3,
  maxRentalDays: 14,
  bufferDays: 1,
  leadTimeDays: 1,
};

function booking(start: IsoDate, end: IsoDate, bufferDays = 1): Occupancy {
  return { range: dateRange(start, end), kind: "BOOKING", bufferDays };
}

function block(start: IsoDate, end: IsoDate): Occupancy {
  return { range: dateRange(start, end), kind: "BLOCK", bufferDays: 0 };
}

describe("occupied ranges", () => {
  it("extends each booking by its own turnaround", () => {
    // A garment returned on the 15th is not rentable again on the 15th; it has
    // to be cleaned first.
    expect(occupiedRanges([booking("2026-09-12", "2026-09-15", 1)])).toEqual([
      { start: "2026-09-12", end: "2026-09-16" },
    ]);
  });

  it("merges windows that touch after buffering", () => {
    const merged = occupiedRanges([
      booking("2026-09-12", "2026-09-15", 1),
      booking("2026-09-16", "2026-09-19", 1),
    ]);
    expect(merged).toEqual([{ start: "2026-09-12", end: "2026-09-20" }]);
  });

  it("keeps a genuine gap open", () => {
    const merged = occupiedRanges([
      booking("2026-09-12", "2026-09-15", 1),
      booking("2026-09-20", "2026-09-23", 1),
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("checkAvailability", () => {
  it("accepts a clear range", () => {
    const result = checkAvailability({
      policy,
      occupancy: [],
      requested: dateRange("2026-09-12", "2026-09-15"),
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days).toBe(3);
  });

  it("refuses dates in the past", () => {
    const result = checkAvailability({
      policy,
      occupancy: [],
      requested: dateRange("2026-08-20", "2026-08-24"),
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "IN_PAST" });
  });

  it("enforces the owner's notice period", () => {
    const result = checkAvailability({
      policy: { ...policy, leadTimeDays: 3 },
      occupancy: [],
      requested: dateRange("2026-09-02", "2026-09-06"),
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "TOO_SOON" });
    if (!result.ok) expect(result.suggestion?.start).toBe("2026-09-04");
  });

  it("enforces the minimum and maximum duration", () => {
    const short = checkAvailability({
      policy,
      occupancy: [],
      requested: dateRange("2026-09-12", "2026-09-13"),
      today: TODAY,
    });
    expect(short).toMatchObject({ ok: false, reason: "TOO_SHORT" });
    // The suggestion must itself satisfy the policy it was rejected for.
    if (!short.ok) expect(short.suggestion).toEqual({ start: "2026-09-12", end: "2026-09-15" });

    const long = checkAvailability({
      policy,
      occupancy: [],
      requested: dateRange("2026-09-12", "2026-10-12"),
      today: TODAY,
    });
    expect(long).toMatchObject({ ok: false, reason: "TOO_LONG" });
  });

  it("reports duration problems before conflicts", () => {
    // A member who asked for one day on a three-day minimum should hear about
    // the minimum, not about a booking they never asked for.
    const result = checkAvailability({
      policy,
      occupancy: [booking("2026-09-12", "2026-09-20")],
      requested: dateRange("2026-09-12", "2026-09-13"),
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "TOO_SHORT" });
  });

  it("refuses a range that overlaps a live booking", () => {
    const result = checkAvailability({
      policy,
      occupancy: [booking("2026-09-12", "2026-09-15")],
      requested: dateRange("2026-09-14", "2026-09-18"),
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "ALREADY_BOOKED" });
  });

  it("refuses a range that only collides with the turnaround", () => {
    // Booking ends the 15th, buffer runs to the 16th. Starting on the 15th
    // would collect a garment that has not been cleaned.
    const result = checkAvailability({
      policy,
      occupancy: [booking("2026-09-12", "2026-09-15", 1)],
      requested: dateRange("2026-09-15", "2026-09-18"),
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "ALREADY_BOOKED" });
  });

  it("allows a start immediately after the turnaround clears", () => {
    const result = checkAvailability({
      policy,
      occupancy: [booking("2026-09-12", "2026-09-15", 1)],
      requested: dateRange("2026-09-16", "2026-09-19"),
      today: TODAY,
    });
    expect(result.ok).toBe(true);
  });

  it("accounts for the new booking's own turnaround before the next one", () => {
    // Free window is 16th–20th. A rental ending on the 20th needs a buffer day
    // to the 21st, which collides with the booking starting on the 20th.
    const result = checkAvailability({
      policy,
      occupancy: [booking("2026-09-12", "2026-09-15", 1), booking("2026-09-20", "2026-09-24", 1)],
      requested: dateRange("2026-09-16", "2026-09-20"),
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "ALREADY_BOOKED" });
  });

  it("distinguishes an owner block from a booking", () => {
    const result = checkAvailability({
      policy,
      occupancy: [block("2026-09-12", "2026-09-20")],
      requested: dateRange("2026-09-13", "2026-09-16"),
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "OWNER_BLOCKED" });
    if (!result.ok) expect(result.message).not.toMatch(/already out/i);
  });

  it("refuses dates beyond the booking horizon", () => {
    const result = checkAvailability({
      policy,
      occupancy: [],
      requested: dateRange("2028-09-12", "2028-09-15"),
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "TOO_FAR_AHEAD" });
  });

  it("suggests a range that is itself bookable", () => {
    const occupancy = [booking("2026-09-12", "2026-09-15"), booking("2026-09-18", "2026-09-25")];
    const result = checkAvailability({
      policy,
      occupancy,
      requested: dateRange("2026-09-13", "2026-09-16"),
      today: TODAY,
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.suggestion) {
      const retry = checkAvailability({
        policy,
        occupancy,
        requested: result.suggestion,
        today: TODAY,
      });
      expect(retry.ok).toBe(true);
    }
  });
});

describe("unavailableDates", () => {
  it("marks every day a garment is spoken for, buffer included", () => {
    const dates = unavailableDates(
      [booking("2026-09-12", "2026-09-15", 1)],
      dateRange("2026-09-01", "2026-10-01"),
    );
    expect([...dates].sort()).toEqual(["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15"]);
  });

  it("clips to the requested window", () => {
    const dates = unavailableDates(
      [booking("2026-08-25", "2026-09-05", 0)],
      dateRange("2026-09-01", "2026-10-01"),
    );
    expect([...dates].every((date) => date >= "2026-09-01")).toBe(true);
    expect(dates.has("2026-09-04")).toBe(true);
    expect(dates.has("2026-09-05")).toBe(false);
  });
});

describe("nextAvailableRange", () => {
  it("skips past a blocking window in one step", () => {
    const next = nextAvailableRange({
      policy,
      occupancy: [booking("2026-09-02", "2026-09-20", 1)],
      days: 3,
      from: "2026-09-02",
      today: TODAY,
    });
    expect(next).toEqual({ start: "2026-09-21", end: "2026-09-24" });
  });

  it("respects the owner's minimum when asked for less", () => {
    const next = nextAvailableRange({
      policy,
      occupancy: [],
      days: 1,
      from: "2026-09-10",
      today: TODAY,
    });
    expect(next).toEqual({ start: "2026-09-10", end: "2026-09-13" });
  });

  it("returns nothing when the horizon is entirely booked", () => {
    const next = nextAvailableRange({
      policy,
      occupancy: [booking("2026-09-01", "2027-09-01", 1)],
      days: 3,
      from: TODAY,
      today: TODAY,
    });
    expect(next).toBeUndefined();
  });
});

describe("availableWindows", () => {
  it("returns the gaps that are long enough to be useful", () => {
    const windows = availableWindows({
      occupancy: [booking("2026-09-05", "2026-09-08", 0), booking("2026-09-09", "2026-09-20", 0)],
      window: dateRange("2026-09-01", "2026-09-30"),
      minimumDays: 3,
    });
    // The single day between the 8th and the 9th is too short to offer.
    expect(windows).toEqual([
      { start: "2026-09-01", end: "2026-09-05" },
      { start: "2026-09-20", end: "2026-09-30" },
    ]);
  });
});

describe("availabilitySignal", () => {
  it("reads as available when the garment is free now", () => {
    expect(availabilitySignal({ policy, occupancy: [], today: TODAY }).signal).toBe(
      "AVAILABLE_NOW",
    );
  });

  it("reads as heavily booked when nothing frees up for months", () => {
    const result = availabilitySignal({
      policy,
      occupancy: [booking("2026-09-01", "2026-12-01", 1)],
      today: TODAY,
    });
    expect(result.signal).toBe("HEAVILY_BOOKED");
    expect(result.from).toBe("2026-12-02");
  });
});
