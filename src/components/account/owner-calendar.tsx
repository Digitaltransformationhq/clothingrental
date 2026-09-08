"use client";

import * as React from "react";
import Image from "next/image";

import {
  addDays,
  type DateRange,
  formatDateLong,
  formatDateRange,
  type IsoDate,
  monthGrid,
  shiftMonth,
  today,
} from "@/domain/dates";
import { type Occupancy, unavailableDates } from "@/domain/rental/availability";
import { describeStatus, type BookingStatus } from "@/domain/rental/state-machine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import { blockDates, unblockDates } from "@/server/actions/availability";
import { useRouter } from "next/navigation";

/**
 * The owner's availability calendar.
 *
 * Shows two months at once, because an owner deciding whether to keep a
 * weekend free is usually looking across a month boundary. Bookings and
 * self-blocked windows are drawn differently — one is somebody else's money
 * and cannot be removed here, the other is the owner's own and can.
 */

interface CalendarListing {
  id: string;
  title: string;
  status: string;
  image: { storageKey: string; blurDataUrl: string | null } | null;
  policy: {
    minRentalDays: number;
    maxRentalDays: number;
    bufferDays: number;
    leadTimeDays: number;
  };
  bookings: Array<{
    id: string;
    status: BookingStatus;
    renter: string;
    bufferDays: number;
    start: IsoDate;
    end: IsoDate;
  }>;
  blocks: Array<{ id: string; reason: string; note: string | null; start: IsoDate; end: IsoDate }>;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function OwnerCalendar({ listings }: { listings: CalendarListing[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState(listings[0]?.id);
  const [cursor, setCursor] = React.useState(() => {
    const [year, month] = today().split("-").map(Number);
    return { year, month };
  });
  const [selection, setSelection] = React.useState<Partial<DateRange>>({});
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const listing = listings.find((entry) => entry.id === selectedId) ?? listings[0];
  const currentDate = today();

  const bookedDates = React.useMemo(() => {
    if (!listing) return new Set<IsoDate>();
    const occupancy: Occupancy[] = listing.bookings.map((booking) => ({
      kind: "BOOKING",
      bufferDays: booking.bufferDays,
      range: { start: booking.start, end: booking.end },
    }));
    return unavailableDates(occupancy, { start: currentDate, end: addDays(currentDate, 400) });
  }, [listing, currentDate]);

  const blockedDates = React.useMemo(() => {
    if (!listing) return new Map<IsoDate, string>();
    const map = new Map<IsoDate, string>();
    for (const block of listing.blocks) {
      for (let date = block.start; date < block.end; date = addDays(date, 1)) {
        map.set(date, block.id);
      }
    }
    return map;
  }, [listing]);

  if (!listing) return null;

  const onDayClick = (date: IsoDate) => {
    setError(null);
    if (bookedDates.has(date)) return;

    if (!selection.start || (selection.start && selection.end)) {
      setSelection({ start: date, end: undefined });
      return;
    }
    if (date <= selection.start) {
      setSelection({ start: date, end: undefined });
      return;
    }
    setSelection({ start: selection.start, end: date });
  };

  const applyBlock = async () => {
    if (!selection.start || !selection.end) return;
    setPending(true);
    setError(null);

    const result = await blockDates({
      listingId: listing.id,
      start: selection.start,
      end: selection.end,
      reason: "OWNER_BLOCKED",
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSelection({});
    router.refresh();
  };

  const removeBlock = async (blockId: string) => {
    setPending(true);
    const result = await unblockDates({ blockId });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[16rem_1fr]">
      {/* ── Which piece ───────────────────────────────────────────────────── */}
      <aside>
        <h2 className="label text-ink-3 mb-4">Your pieces</h2>
        <ul className="space-y-1">
          {listings.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(entry.id);
                  setSelection({});
                }}
                aria-pressed={entry.id === listing.id}
                className={cn(
                  "flex w-full items-center gap-3 p-2 text-left transition-colors",
                  entry.id === listing.id ? "bg-paper-2" : "hover:bg-paper-2",
                )}
              >
                <span className="bg-paper-3 relative aspect-[4/5] w-10 shrink-0 overflow-hidden">
                  {entry.image ? (
                    <Image
                      src={mediaUrl(entry.image.storageKey)}
                      alt=""
                      fill
                      sizes="40px"
                      placeholder={entry.image.blurDataUrl ? "blur" : "empty"}
                      blurDataURL={entry.image.blurDataUrl ?? undefined}
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-small text-ink block truncate">{entry.title}</span>
                  <span className="meta text-ink-3 block">
                    {entry.bookings.length} booked · {entry.blocks.length} blocked
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── The calendar ──────────────────────────────────────────────────── */}
      <div className="min-w-0">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="title-1">{listing.title}</h2>
          <div className="flex gap-2">
            <NavButton
              label="Previous month"
              direction="previous"
              onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
            />
            <NavButton
              label="Next month"
              direction="next"
              onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
            />
          </div>
        </div>

        <div className="grid gap-10 sm:grid-cols-2">
          {[0, 1].map((offset) => {
            const shifted = shiftMonth(cursor.year, cursor.month, offset);
            const grid = monthGrid(shifted.year, shifted.month);

            return (
              <div key={grid.label}>
                <p className="text-small text-ink mb-3 font-medium">{grid.label}</p>
                <div className="grid grid-cols-7">
                  {WEEKDAYS.map((day, index) => (
                    <div
                      key={`${day}-${index}`}
                      className="text-ink-3 pb-2 text-center text-[0.625rem] tracking-[0.08em] uppercase"
                    >
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: grid.leadingBlanks }, (_, index) => (
                    <div key={`blank-${index}`} />
                  ))}
                  {grid.dates.map((date) => {
                    const isBooked = bookedDates.has(date);
                    const blockId = blockedDates.get(date);
                    const isPast = date < currentDate;
                    const inSelection =
                      selection.start &&
                      (selection.end
                        ? date >= selection.start && date < selection.end
                        : date === selection.start);

                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => onDayClick(date)}
                        disabled={isBooked || isPast}
                        aria-label={`${formatDateLong(date)}${
                          isBooked ? " — booked" : blockId ? " — blocked by you" : ""
                        }`}
                        className={cn(
                          "text-small relative grid aspect-square place-items-center transition-colors",
                          isPast && "text-ink-3 opacity-40",
                          !isPast && !isBooked && !blockId && "text-ink hover:bg-paper-3",
                          isBooked && "bg-claret-soft text-claret cursor-not-allowed",
                          blockId && "bg-paper-3 text-ink-2 line-through",
                          inSelection && "bg-ink text-ink-inverse",
                        )}
                      >
                        <span className="numeric">{Number(date.slice(-2))}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Legend and action ───────────────────────────────────────────── */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="meta text-ink-3 inline-flex items-center gap-2">
            <span className="bg-claret-soft h-3 w-3" aria-hidden="true" /> Booked
          </span>
          <span className="meta text-ink-3 inline-flex items-center gap-2">
            <span className="bg-paper-3 h-3 w-3" aria-hidden="true" /> You blocked
          </span>
          <span className="meta text-ink-3 inline-flex items-center gap-2">
            <span className="border-rule h-3 w-3 border" aria-hidden="true" /> Available
          </span>
        </div>

        {selection.start ? (
          <div className="border-rule bg-surface mt-6 flex flex-wrap items-center gap-4 border p-4">
            <p className="text-small text-ink">
              {selection.end
                ? formatDateRange({ start: selection.start, end: selection.end })
                : `${formatDateLong(selection.start)} — now pick an end date`}
            </p>
            {selection.end ? (
              <Button size="sm" onClick={applyBlock} loading={pending}>
                Keep these dates for myself
              </Button>
            ) : null}
            <Button size="sm" variant="quiet" onClick={() => setSelection({})}>
              Clear
            </Button>
          </div>
        ) : (
          <p className="meta text-ink-3 mt-6">
            Click a start and an end date to keep a window for yourself.
          </p>
        )}

        {error ? (
          <p
            role="alert"
            className="border-critical bg-critical-soft text-small text-ink mt-4 border-l-2 px-3 py-2"
          >
            {error}
          </p>
        ) : null}

        {/* ── What is on the calendar ─────────────────────────────────────── */}
        {listing.bookings.length > 0 ? (
          <section className="mt-12">
            <h3 className="label text-ink-3 mb-4">Booked</h3>
            <ul className="border-rule border-t">
              {listing.bookings.map((booking) => (
                <li key={booking.id} className="border-rule flex items-center gap-4 border-b py-3">
                  <span className="text-small text-ink flex-1">
                    {formatDateRange({ start: booking.start, end: booking.end })}
                  </span>
                  <span className="meta text-ink-3">{booking.renter}</span>
                  <span className="meta text-ink-2">{describeStatus(booking.status, "OWNER")}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {listing.blocks.length > 0 ? (
          <section className="mt-10">
            <h3 className="label text-ink-3 mb-4">Kept for yourself</h3>
            <ul className="border-rule border-t">
              {listing.blocks.map((block) => (
                <li key={block.id} className="border-rule flex items-center gap-4 border-b py-3">
                  <span className="text-small text-ink flex-1">
                    {formatDateRange({ start: block.start, end: block.end })}
                    {block.note ? <span className="text-ink-3"> · {block.note}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    disabled={pending}
                    className="link-underline meta text-ink-2"
                  >
                    Free these dates
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function NavButton({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: "previous" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="border-rule text-ink hover:border-ink hover:bg-ink hover:text-ink-inverse grid h-9 w-9 place-items-center border transition-colors"
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
