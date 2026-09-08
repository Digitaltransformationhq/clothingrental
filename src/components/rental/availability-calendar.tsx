"use client";

import * as React from "react";

import {
  addDays,
  compareDates,
  type DateRange,
  formatDateLong,
  type IsoDate,
  monthGrid,
  shiftMonth,
} from "@/domain/dates";
import {
  type AvailabilityPolicy,
  checkAvailability,
  earliestStart,
  type Occupancy,
  unavailableDates,
} from "@/domain/rental/availability";
import { cn } from "@/lib/cn";

/**
 * The rental date picker.
 *
 * Runs the *same* pure availability functions the server runs inside the
 * booking transaction — `checkAvailability` here and `checkAvailability` there,
 * imported from one module. The calendar therefore cannot promise a range the
 * server will refuse, which is the usual failure of a client-side date picker.
 *
 * The server still re-checks under a lock, because between painting this grid
 * and pressing the button somebody else may have taken the dates. This is a
 * courtesy; the server's answer is the truth.
 *
 * Accessibility: a real grid with roving focus and arrow-key navigation, dates
 * announced in full rather than as bare numerals, and unavailable days marked
 * with `aria-disabled` rather than removed — a screen reader user needs to know
 * the 14th exists and is taken, not that it is missing.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AvailabilityCalendar({
  policy,
  occupancy,
  today,
  value,
  onChange,
  months = 1,
  className,
}: {
  policy: AvailabilityPolicy;
  occupancy: Occupancy[];
  today: IsoDate;
  value: Partial<DateRange>;
  onChange: (next: Partial<DateRange>) => void;
  months?: number;
  className?: string;
}) {
  const firstAllowed = earliestStart(policy, today);
  const [cursor, setCursor] = React.useState(() => {
    const [year, month] = firstAllowed.split("-").map(Number);
    return { year, month };
  });
  const [hovered, setHovered] = React.useState<IsoDate | null>(null);
  const [focused, setFocused] = React.useState<IsoDate>(firstAllowed);

  const blocked = React.useMemo(() => {
    const start = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-01`;
    const end = addDays(start, 100);
    return unavailableDates(occupancy, { start, end });
  }, [occupancy, cursor]);

  const isSelectable = (date: IsoDate) =>
    compareDates(date, firstAllowed) >= 0 && !blocked.has(date);

  /**
   * Selection is a two-step: the first press sets the start and clears the end,
   * the second sets the end. Pressing a date before the current start restarts
   * the selection rather than producing a backwards range.
   */
  const select = (date: IsoDate) => {
    if (!isSelectable(date)) return;

    if (!value.start || (value.start && value.end)) {
      onChange({ start: date, end: undefined });
      return;
    }

    if (compareDates(date, value.start) <= 0) {
      onChange({ start: date, end: undefined });
      return;
    }

    onChange({ start: value.start, end: date });
  };

  // The range being previewed: committed if both ends are set, otherwise
  // following the pointer.
  const preview: Partial<DateRange> =
    value.start && !value.end && hovered && compareDates(hovered, value.start) > 0
      ? { start: value.start, end: hovered }
      : value;

  const inRange = (date: IsoDate) =>
    Boolean(preview.start && preview.end && date > preview.start && date < preview.end);

  /**
   * Whether a candidate end date would produce a bookable range. Used to grey
   * out days that are free themselves but sit on the far side of a booking —
   * a member should not be able to select across an occupied window.
   */
  const wouldBeValid = React.useCallback(
    (end: IsoDate) => {
      if (!value.start || value.end) return true;
      if (compareDates(end, value.start) <= 0) return true;
      return checkAvailability({
        policy,
        occupancy,
        requested: { start: value.start, end },
        today,
      }).ok;
    },
    [value.start, value.end, policy, occupancy, today],
  );

  const onKeyDown = (event: React.KeyboardEvent, date: IsoDate) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const delta = moves[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      const next = addDays(date, delta);
      setFocused(next);
      const [year, month] = next.split("-").map(Number);
      if (year !== cursor.year || month !== cursor.month) setCursor({ year, month });
      // Focus follows on the next paint, once the target cell exists.
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus();
      });
    }
  };

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-4 flex items-center justify-between">
        <CalendarNav
          direction="previous"
          onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
          disabled={
            `${cursor.year}-${String(cursor.month).padStart(2, "0")}` <= firstAllowed.slice(0, 7)
          }
        />
        <p className="text-small text-ink font-medium" aria-live="polite">
          {monthGrid(cursor.year, cursor.month).label}
          {months > 1
            ? ` – ${monthGrid(...(Object.values(shiftMonth(cursor.year, cursor.month, months - 1)) as [number, number])).label}`
            : ""}
        </p>
        <CalendarNav
          direction="next"
          onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
          disabled={false}
        />
      </div>

      <div className={cn("grid gap-8", months > 1 && "sm:grid-cols-2")}>
        {Array.from({ length: months }, (_, offset) => {
          const shifted = shiftMonth(cursor.year, cursor.month, offset);
          const grid = monthGrid(shifted.year, shifted.month);

          return (
            <div key={grid.label} role="group" aria-label={grid.label}>
              {months > 1 ? (
                <p className="meta text-ink-2 mb-3 text-center sm:hidden">{grid.label}</p>
              ) : null}

              {/*
                A real ARIA grid: every cell sits inside a row, and every row
                inside the rowgroup. An earlier version put the cells straight
                into the rowgroup, which axe reports as two critical failures
                and which leaves a screen reader unable to say which week a date
                is in. Dates are chunked into weeks for exactly that reason.
              */}
              <div role="grid" aria-label={`${grid.label} availability`}>
                <div role="rowgroup">
                  <div role="row" className="grid grid-cols-7">
                    {WEEKDAYS.map((day) => (
                      <span
                        key={day}
                        role="columnheader"
                        aria-label={day}
                        className="text-ink-3 pb-2 text-center text-[0.625rem] tracking-[0.08em] uppercase"
                      >
                        {day.charAt(0)}
                      </span>
                    ))}
                  </div>
                </div>

                <div role="rowgroup">
                  {weeksFor(grid).map((week, weekIndex) => (
                    <div key={weekIndex} role="row" className="grid grid-cols-7">
                      {week.map((date, dayIndex) =>
                        date === null ? (
                          <span
                            key={`blank-${weekIndex}-${dayIndex}`}
                            role="gridcell"
                            aria-hidden="true"
                          />
                        ) : (
                          <DayCell
                            key={date}
                            date={date}
                            selectable={isSelectable(date) && wouldBeValid(date)}
                            isStart={date === preview.start}
                            isEnd={date === preview.end}
                            between={inRange(date)}
                            focused={date === focused}
                            onSelect={select}
                            onFocus={setFocused}
                            onKeyDown={onKeyDown}
                            onHover={setHovered}
                          />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="meta text-ink-3 mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-ink inline-block h-2.5 w-2.5" />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="border-rule-strong inline-block h-2.5 w-2.5 border" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="text-ink-3 line-through">
            00
          </span>
          Taken
        </span>
      </p>
    </div>
  );
}

/**
 * Chunks a month into calendar weeks, padded with nulls so every row has seven
 * cells. An ARIA grid requires complete rows; a ragged final week would make
 * the grid's own shape a lie.
 */
function weeksFor(grid: { leadingBlanks: number; dates: IsoDate[] }): Array<Array<IsoDate | null>> {
  const cells: Array<IsoDate | null> = [
    ...Array.from({ length: grid.leadingBlanks }, () => null),
    ...grid.dates,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<IsoDate | null>> = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** One day. Extracted so the row markup stays readable. */
function DayCell({
  date,
  selectable,
  isStart,
  isEnd,
  between,
  focused,
  onSelect,
  onFocus,
  onKeyDown,
  onHover,
}: {
  date: IsoDate;
  selectable: boolean;
  isStart: boolean;
  isEnd: boolean;
  between: boolean;
  focused: boolean;
  onSelect: (date: IsoDate) => void;
  onFocus: (date: IsoDate) => void;
  onKeyDown: (event: React.KeyboardEvent, date: IsoDate) => void;
  onHover: (date: IsoDate | null) => void;
}) {
  return (
    <span role="gridcell" className="relative">
      {/* The connecting band sits behind the day, so a selected range reads as
          one continuous shape rather than as a row of separate chips. */}
      {between || isStart || isEnd ? (
        <span
          aria-hidden="true"
          className={cn(
            "bg-paper-3 absolute inset-y-0.5",
            between && "inset-x-0",
            isStart && !isEnd && "right-0 left-1/2",
            isEnd && !isStart && "right-1/2 left-0",
            isStart && isEnd && "hidden",
          )}
        />
      ) : null}

      <button
        type="button"
        data-date={date}
        disabled={!selectable}
        aria-disabled={!selectable}
        aria-label={`${formatDateLong(date)}${selectable ? "" : " — not available"}`}
        aria-pressed={isStart || isEnd}
        tabIndex={focused ? 0 : -1}
        onFocus={() => onFocus(date)}
        onKeyDown={(event) => onKeyDown(event, date)}
        onClick={() => onSelect(date)}
        onMouseEnter={() => onHover(date)}
        onMouseLeave={() => onHover(null)}
        className={cn(
          "text-small relative grid aspect-square w-full place-items-center transition-colors",
          "duration-[--duration-quick] ease-[--ease-editorial]",
          selectable
            ? "text-ink hover:bg-ink hover:text-ink-inverse"
            : "text-ink-3 decoration-rule-strong cursor-not-allowed line-through",
          (isStart || isEnd) && "bg-ink text-ink-inverse hover:bg-ink",
          between && "text-ink",
        )}
      >
        <span className="numeric">{Number(date.slice(-2))}</span>
      </button>
    </span>
  );
}

function CalendarNav({
  direction,
  onClick,
  disabled,
}: {
  direction: "previous" | "next";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} month`}
      className={cn(
        "border-rule text-ink grid h-8 w-8 place-items-center border transition-colors",
        "hover:border-ink hover:bg-ink hover:text-ink-inverse",
        disabled && "pointer-events-none opacity-25",
      )}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
        <path
          d={direction === "previous" ? "M10 2 4 8l6 6" : "M6 2l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    </button>
  );
}
