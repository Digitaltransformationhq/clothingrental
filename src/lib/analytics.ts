/**
 * Analytics.
 *
 * A typed event vocabulary behind a driver, so that no component ever calls a
 * vendor SDK directly. Two consequences worth having:
 *
 *  · Changing analytics provider is one file, not two hundred call sites.
 *  · The events are enumerated here, which means somebody can read what this
 *    application measures without grepping for `track(`.
 *
 * The default driver does nothing. Analytics is opt-in through
 * `ANALYTICS_DRIVER`, and a marketplace that ships tracking on by default is
 * making a decision on its members' behalf that it has no business making.
 *
 * Client-safe: it reads one public environment variable and never imports
 * server code.
 */

export type AnalyticsEvent =
  | { name: "view_listing"; listingId: string; category: string; priceMinor: number }
  | { name: "search"; query: string; results: number }
  | { name: "filter_used"; filter: string; value: string }
  | { name: "wishlist_added"; listingId: string }
  | { name: "wishlist_removed"; listingId: string }
  | { name: "dates_selected"; listingId: string; days: number }
  | { name: "booking_started"; listingId: string; days: number; totalMinor: number }
  | { name: "checkout_started"; rentalId: string; totalMinor: number }
  | { name: "payment_completed"; rentalId: string; totalMinor: number }
  | { name: "payment_failed"; rentalId: string; reason: string }
  | { name: "listing_started" }
  | { name: "listing_step_completed"; step: string }
  | { name: "listing_created"; listingId: string }
  | { name: "listing_published"; listingId: string }
  | { name: "rental_completed"; rentalId: string }
  | { name: "review_left"; rating: number };

export interface AnalyticsDriver {
  track(event: AnalyticsEvent): void;
}

class NoopAnalyticsDriver implements AnalyticsDriver {
  track(): void {
    // Deliberately nothing.
  }
}

class ConsoleAnalyticsDriver implements AnalyticsDriver {
  track(event: AnalyticsEvent): void {
    const { name, ...properties } = event;
    console.debug(`[analytics] ${name}`, properties);
  }
}

let driver: AnalyticsDriver =
  process.env.NEXT_PUBLIC_ANALYTICS_DRIVER === "console"
    ? new ConsoleAnalyticsDriver()
    : new NoopAnalyticsDriver();

/**
 * Records an event.
 *
 * Never throws and never blocks: an analytics failure must not break the thing
 * a member was actually trying to do.
 */
export function track(event: AnalyticsEvent): void {
  try {
    driver.track(event);
  } catch {
    // Swallowed on purpose.
  }
}

/** Installs a driver. Called once at start-up by whatever provider is in use. */
export function setAnalyticsDriver(next: AnalyticsDriver): void {
  driver = next;
}
