import { describe, expect, it } from "vitest";

import {
  addDays,
  dateRange,
  DateError,
  differenceInDays,
  eachDate,
  extendRange,
  formatDateRange,
  isIsoDate,
  mergeRanges,
  monthGrid,
  rangesOverlap,
  shiftMonth,
  today,
  toIsoDate,
  toUtcDate,
} from "./dates";

describe("calendar dates are zone-independent", () => {
  it("round-trips through the database representation unchanged", () => {
    // Prisma hands back a Date at UTC midnight for a `date` column. Reading it
    // with local getters is the classic off-by-one: in any zone behind UTC,
    // `getDate()` returns the previous day.
    const stored = toUtcDate("2026-09-12");
    expect(stored.toISOString()).toBe("2026-09-12T00:00:00.000Z");
    expect(toIsoDate(stored)).toBe("2026-09-12");
  });

  it("resolves today in the marketplace's own zone", () => {
    // 21:00 UTC on the 11th is already the 12th in Kolkata (UTC+5:30). A
    // rental's "earliest start" must follow the member, not the server.
    const instant = new Date("2026-09-11T21:00:00.000Z");
    expect(today("Asia/Kolkata", instant)).toBe("2026-09-12");
    expect(today("UTC", instant)).toBe("2026-09-11");
  });

  it("survives a daylight-saving boundary", () => {
    // Arithmetic is done on calendar days, so a 23- or 25-hour day in some
    // other zone cannot shift a rental.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(differenceInDays("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("rejects dates that look valid but are not", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("12-09-2026")).toBe(false);
    expect(isIsoDate("2026-09-12")).toBe(true);
  });
});

describe("half-open ranges", () => {
  it("refuses a range that ends before it starts", () => {
    expect(() => dateRange("2026-09-15", "2026-09-12")).toThrow(DateError);
    expect(() => dateRange("2026-09-12", "2026-09-12")).toThrow(DateError);
  });

  it("lets back-to-back rentals touch without overlapping", () => {
    // This is the entire reason the convention is half-open.
    const first = dateRange("2026-09-12", "2026-09-15");
    const second = dateRange("2026-09-15", "2026-09-18");
    expect(rangesOverlap(first, second)).toBe(false);
  });

  it("detects a genuine overlap in both directions", () => {
    const a = dateRange("2026-09-12", "2026-09-16");
    const b = dateRange("2026-09-15", "2026-09-18");
    expect(rangesOverlap(a, b)).toBe(true);
    expect(rangesOverlap(b, a)).toBe(true);
  });

  it("counts the days a renter actually holds the garment", () => {
    expect(eachDate(dateRange("2026-09-12", "2026-09-15"))).toEqual([
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
    ]);
  });

  it("extends a range by its turnaround", () => {
    expect(extendRange(dateRange("2026-09-12", "2026-09-15"), 2)).toEqual({
      start: "2026-09-12",
      end: "2026-09-17",
    });
  });

  it("merges overlapping and adjacent ranges", () => {
    expect(
      mergeRanges([
        dateRange("2026-09-12", "2026-09-15"),
        dateRange("2026-09-15", "2026-09-18"),
        dateRange("2026-09-25", "2026-09-28"),
      ]),
    ).toEqual([
      { start: "2026-09-12", end: "2026-09-18" },
      { start: "2026-09-25", end: "2026-09-28" },
    ]);
  });
});

describe("presentation", () => {
  it("renders a range as compactly as it can be read", () => {
    expect(formatDateRange(dateRange("2026-09-12", "2026-09-15"))).toBe("12–15 Sep");
    expect(formatDateRange(dateRange("2026-09-28", "2026-10-03"))).toBe("28 Sep – 3 Oct");
    expect(formatDateRange(dateRange("2026-12-28", "2027-01-03"))).toBe(
      "28 December 2026 – 3 January 2027",
    );
  });
});

describe("month grid", () => {
  it("offsets the first day onto the right weekday for a Monday-start week", () => {
    // 1 September 2026 is a Tuesday, so one blank cell precedes it.
    const grid = monthGrid(2026, 9);
    expect(grid.label).toBe("September 2026");
    expect(grid.leadingBlanks).toBe(1);
    expect(grid.dates).toHaveLength(30);
    expect(grid.dates[0]).toBe("2026-09-01");
  });

  it("handles a leap February", () => {
    expect(monthGrid(2028, 2).dates).toHaveLength(29);
  });

  it("steps across a year boundary", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
