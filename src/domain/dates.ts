/**
 * Calendar dates.
 *
 * A rental is measured in calendar days, not in instants. "12 September to 15
 * September" means the same thing to a member in Vadodara and to a server in
 * Frankfurt, and it must not shift because one of them is six hours behind.
 *
 * So dates in the rental domain are `IsoDate` strings — `YYYY-MM-DD` — with no
 * time and no zone. `Date` objects appear only at the database boundary, where
 * Prisma maps a PostgreSQL `date` to a `Date` pinned to UTC midnight, and this
 * module is the only place that conversion happens.
 *
 * Ranges are half-open: `[start, end)`. The renter collects the garment on
 * `start` and returns it on `end`, so the duration is exactly `end - start`
 * days and two rentals may touch at a boundary without overlapping. Every
 * availability calculation in the codebase depends on that convention holding
 * everywhere.
 */

/** A calendar date with no time and no zone: `2026-09-12`. */
export type IsoDate = string;

/** The zone the marketplace's "today" is anchored to. */
export const MARKETPLACE_TIME_ZONE = "Asia/Kolkata";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export class DateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateError";
  }
}

// ── Parsing and validation ──────────────────────────────────────────────────

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  // Rejects 2026-02-30, which passes the pattern but is not a date.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
}

export function assertIsoDate(value: unknown, label = "date"): asserts value is IsoDate {
  if (!isIsoDate(value)) {
    throw new DateError(`Expected ${label} as YYYY-MM-DD; received ${JSON.stringify(value)}.`);
  }
}

/** Converts a `Date` to a calendar date using its UTC parts. */
export function toIsoDate(date: Date): IsoDate {
  if (Number.isNaN(date.getTime())) {
    throw new DateError("Cannot convert an invalid Date to a calendar date.");
  }
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converts a calendar date to the `Date` the database expects: UTC midnight.
 * This is the only correct way to hand an `IsoDate` to Prisma for a `@db.Date`
 * column.
 */
export function toUtcDate(date: IsoDate): Date {
  assertIsoDate(date);
  return new Date(`${date}T00:00:00.000Z`);
}

/** Today, as the marketplace reckons it. */
export function today(timeZone: string = MARKETPLACE_TIME_ZONE, now: Date = new Date()): IsoDate {
  // `en-CA` formats as YYYY-MM-DD, which is the shape we want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// ── Arithmetic ──────────────────────────────────────────────────────────────

export function addDays(date: IsoDate, days: number): IsoDate {
  assertIsoDate(date);
  if (!Number.isInteger(days)) {
    throw new DateError(`Cannot add a fractional number of days (${days}).`);
  }
  return toIsoDate(new Date(toUtcDate(date).getTime() + days * MS_PER_DAY));
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function differenceInDays(from: IsoDate, to: IsoDate): number {
  assertIsoDate(from, "start date");
  assertIsoDate(to, "end date");
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / MS_PER_DAY);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  // ISO dates are lexicographically ordered, so string comparison is correct
  // and considerably cheaper than parsing.
  return a < b ? -1 : a > b ? 1 : 0;
}

export const isBefore = (a: IsoDate, b: IsoDate): boolean => a < b;
export const isAfter = (a: IsoDate, b: IsoDate): boolean => a > b;
export const isSameDate = (a: IsoDate, b: IsoDate): boolean => a === b;

export function minDate(...dates: IsoDate[]): IsoDate {
  return dates.reduce((earliest, date) => (date < earliest ? date : earliest));
}

export function maxDate(...dates: IsoDate[]): IsoDate {
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}

// ── Ranges ──────────────────────────────────────────────────────────────────

/** A half-open calendar range: `start` included, `end` excluded. */
export interface DateRange {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

export function dateRange(start: IsoDate, end: IsoDate): DateRange {
  assertIsoDate(start, "start date");
  assertIsoDate(end, "end date");
  if (end <= start) {
    throw new DateError(`A rental must end after it starts; received ${start} to ${end}.`);
  }
  return { start, end };
}

/** Length of a half-open range, in days. */
export function rangeLength(range: DateRange): number {
  return differenceInDays(range.start, range.end);
}

/**
 * Half-open overlap. Ranges that merely touch — one ending on the day the next
 * begins — do not overlap, which is precisely what makes back-to-back rentals
 * possible.
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function rangeContains(range: DateRange, date: IsoDate): boolean {
  return date >= range.start && date < range.end;
}

/** Extends a range's end by `days`, used to reserve turnaround after a rental. */
export function extendRange(range: DateRange, days: number): DateRange {
  return days === 0 ? range : { start: range.start, end: addDays(range.end, days) };
}

/** Every date in a half-open range. */
export function eachDate(range: DateRange): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let cursor = range.start; cursor < range.end; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

/** Merges overlapping and adjacent ranges into the smallest equivalent set. */
export function mergeRanges(ranges: DateRange[]): DateRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => compareDates(a.start, b.start));
  const merged: DateRange[] = [sorted[0]];

  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: maxDate(last.end, range.end) };
    } else {
      merged.push(range);
    }
  }

  return merged;
}

// ── Presentation ────────────────────────────────────────────────────────────

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(date: IsoDate) {
  assertIsoDate(date);
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day, weekday: toUtcDate(date).getUTCDay() };
}

/** `12 Sep` — the compact form used in dense metadata. */
export function formatDateShort(date: IsoDate): string {
  const { day, month } = parts(date);
  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

/** `12 September 2026` — Indian day-first convention, spelled out. */
export function formatDateLong(date: IsoDate): string {
  const { day, month, year } = parts(date);
  return `${day} ${MONTHS_LONG[month - 1]} ${year}`;
}

/** `Sat 12 Sep` — where the day of the week matters, as it does for events. */
export function formatDateWithWeekday(date: IsoDate): string {
  const { day, month, weekday } = parts(date);
  return `${WEEKDAYS_SHORT[weekday]} ${day} ${MONTHS_SHORT[month - 1]}`;
}

/**
 * Renders a range as compactly as it can be read without ambiguity:
 *   `12–15 Sep` within one month,
 *   `28 Sep – 3 Oct` across months,
 *   `28 Dec 2026 – 3 Jan 2027` across years.
 */
export function formatDateRange(range: DateRange): string {
  const from = parts(range.start);
  const to = parts(range.end);

  if (from.year !== to.year) {
    return `${formatDateLong(range.start)} – ${formatDateLong(range.end)}`;
  }
  if (from.month !== to.month) {
    return `${from.day} ${MONTHS_SHORT[from.month - 1]} – ${to.day} ${MONTHS_SHORT[to.month - 1]}`;
  }
  return `${from.day}–${to.day} ${MONTHS_SHORT[from.month - 1]}`;
}

/** `3 days` / `1 day`, for durations quoted beside a price. */
export function formatDuration(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Human relative time for activity feeds and message threads. Deliberately
 * coarse: a message is "2 hours ago", never "2 hours and 14 minutes ago".
 */
export function formatRelativeTime(value: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - value.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 365) return formatDateShort(toIsoDate(value));
  return formatDateLong(toIsoDate(value));
}

/** Month grid metadata for the availability calendar. */
export interface MonthGrid {
  year: number;
  month: number;
  label: string;
  /** Blank leading cells so the first day lands under the right weekday. */
  leadingBlanks: number;
  dates: IsoDate[];
}

export function monthGrid(year: number, month: number, weekStartsOn = 1): MonthGrid {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = (first.getUTCDay() - weekStartsOn + 7) % 7;

  const dates: IsoDate[] = [];
  for (let day = 1; day <= dayCount; day += 1) {
    dates.push(toIsoDate(new Date(Date.UTC(year, month - 1, day))));
  }

  return {
    year,
    month,
    label: `${MONTHS_LONG[month - 1]} ${year}`,
    leadingBlanks,
    dates,
  };
}

/** Steps a (year, month) pair by whole months. */
export function shiftMonth(
  year: number,
  month: number,
  by: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + by;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}
