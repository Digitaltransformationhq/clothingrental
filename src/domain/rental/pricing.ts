import {
  add,
  type Bps,
  type Currency,
  DEFAULT_CURRENCY,
  type Money,
  money,
  multiply,
  percentage,
  splitLine,
  subtract,
  zero,
} from "@/domain/money";

/**
 * Pricing.
 *
 * A rental is quoted as a base period plus a per-day extension — "₹850 / 3
 * days, ₹200 each further day" — because that is how this market actually
 * prices. A flat per-day rate cannot express a weekend rate, and every owner
 * asked to enter one ends up inflating the daily figure to compensate.
 *
 * The whole module is pure. It takes numbers and a fee schedule and returns a
 * quote; it never reads a listing from the database and never trusts one from
 * a client. `quoteRental` is called in two places — to render a price to a
 * shopper, and again inside the booking transaction against freshly-read
 * listing state — and the second call is the one that decides what is charged.
 */

export interface ListingPricing {
  readonly currency: Currency;
  /** Price of the base period. */
  readonly baseRateMinor: number;
  /** Length of the base period, in days. */
  readonly baseDurationDays: number;
  /** Price of each day beyond the base period. */
  readonly extraDayRateMinor: number;
  /** Refundable, held against damage or non-return. */
  readonly depositMinor: number;
  /** Charged once per rental, not per day. */
  readonly cleaningFeeMinor: number;
  readonly deliveryFeeMinor: number;
}

/**
 * The commercial terms in force. Read from `PlatformFee` rather than hardcoded,
 * and snapshotted onto the booking, so changing the commission tomorrow does
 * not silently restate what an owner was already promised.
 */
export interface FeeSchedule {
  /** Withheld from the owner's earnings. */
  readonly commissionBps: Bps;
  /** Added to the renter's subtotal. */
  readonly serviceFeeBps: Bps;
  /** Applied to rental and fees — never to the refundable deposit. */
  readonly taxBps: Bps;
  /** Floor for the service fee, so small rentals still cover their costs. */
  readonly minFeeMinor: number;
}

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  commissionBps: 1500, // 15% marketplace commission
  serviceFeeBps: 600, //  6% renter service fee
  taxBps: 1800, // 18% GST on the rental and fees
  minFeeMinor: 4900, // ₹49 minimum service fee
};

export type FulfilmentMode = "PICKUP" | "LOCAL_DELIVERY" | "SHIPPING";

/** One row in the price breakdown shown to the member. */
export interface PriceLine {
  readonly key: string;
  readonly label: string;
  /** Sub-label explaining how the figure was reached. */
  readonly detail?: string;
  readonly amount: Money;
  /**
   * Refundable lines are the deposit. They are rendered apart from the cost of
   * the rental, because conflating "what this costs" with "what you get back"
   * is the single most common way a rental marketplace loses trust.
   */
  readonly refundable?: boolean;
}

export interface RentalQuote {
  readonly currency: Currency;
  readonly days: number;
  /** Days charged at the extra-day rate. */
  readonly extraDays: number;

  readonly baseAmount: Money;
  readonly extraDaysAmount: Money;
  readonly cleaningFee: Money;
  /** Base + extra days + cleaning. The figure commission is taken from. */
  readonly rentalSubtotal: Money;

  readonly deliveryFee: Money;
  readonly serviceFee: Money;
  readonly tax: Money;
  readonly deposit: Money;
  readonly discount: Money;

  /** Everything the renter is charged today, deposit included. */
  readonly total: Money;
  /** What the renter is charged and does not get back. */
  readonly costToRenter: Money;

  readonly commission: Money;
  readonly ownerEarnings: Money;
  readonly commissionBps: Bps;

  readonly lines: readonly PriceLine[];
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

/**
 * Charge for the rental period alone, before fees, tax or deposit.
 *
 * The base rate covers the base period whether or not the renter uses all of
 * it: a two-day rental on a three-day base costs the base rate. Anything less
 * would let a five-day base be gamed into a cheap overnight.
 */
export function rentalChargeForDays(pricing: ListingPricing, days: number): Money {
  if (!Number.isInteger(days) || days < 1) {
    throw new PricingError(`A rental must be a whole number of days; received ${days}.`);
  }

  const base = money(pricing.baseRateMinor, pricing.currency);
  const extraDays = Math.max(0, days - pricing.baseDurationDays);
  const extra = multiply(money(pricing.extraDayRateMinor, pricing.currency), extraDays);

  return add(base, extra);
}

/**
 * Effective per-day price, for the "from ₹X a day" line on listing cards.
 * Rounded up so the quoted figure is never lower than what checkout charges.
 */
export function perDayRate(pricing: ListingPricing, days?: number): Money {
  const period = days ?? pricing.baseDurationDays;
  const charge = rentalChargeForDays(pricing, period);
  return money(Math.ceil(charge.amountMinor / period), pricing.currency);
}

export interface QuoteInput {
  readonly pricing: ListingPricing;
  readonly days: number;
  readonly fees?: FeeSchedule;
  readonly fulfilment?: FulfilmentMode;
  /** Promotional reduction, applied to the rental subtotal before fees. */
  readonly discountMinor?: number;
}

/**
 * Produces the complete, itemised quote for one garment over one period.
 *
 * Order of operations is deliberate and is the same order the breakdown is
 * displayed in:
 *
 *   1. rental subtotal  = base + extra days + cleaning, less any discount
 *   2. delivery         = charged only when the garment is actually delivered
 *   3. service fee      = a percentage of the rental subtotal, with a floor
 *   4. tax              = on rental + delivery + service fee
 *   5. deposit          = added last, untaxed, refundable
 *
 * Tax is never applied to the deposit. A refundable holding amount is not
 * consideration for a supply, and charging GST on it would mean refunding less
 * than was taken.
 */
export function quoteRental(input: QuoteInput): RentalQuote {
  const { pricing, days } = input;
  const fees = input.fees ?? DEFAULT_FEE_SCHEDULE;
  const fulfilment = input.fulfilment ?? "SHIPPING";
  const currency = pricing.currency ?? DEFAULT_CURRENCY;

  if (pricing.baseDurationDays < 1) {
    throw new PricingError("A listing's base period must be at least one day.");
  }

  const extraDays = Math.max(0, days - pricing.baseDurationDays);
  const baseAmount = money(pricing.baseRateMinor, currency);
  const extraDaysAmount = multiply(money(pricing.extraDayRateMinor, currency), extraDays);
  const cleaningFee = money(pricing.cleaningFeeMinor, currency);

  const discount = money(Math.max(0, input.discountMinor ?? 0), currency);
  const grossRental = add(baseAmount, extraDaysAmount, cleaningFee);

  if (discount.amountMinor > grossRental.amountMinor) {
    throw new PricingError("A discount cannot exceed the rental it applies to.");
  }
  const rentalSubtotal = subtract(grossRental, discount);

  // Collection in person costs nothing to fulfil, so it is never charged for.
  const deliveryFee =
    fulfilment === "PICKUP" ? zero(currency) : money(pricing.deliveryFeeMinor, currency);

  const computedServiceFee = percentage(rentalSubtotal, fees.serviceFeeBps);
  const serviceFee = money(
    Math.max(computedServiceFee.amountMinor, rentalSubtotal.amountMinor > 0 ? fees.minFeeMinor : 0),
    currency,
  );

  const taxable = add(rentalSubtotal, deliveryFee, serviceFee);
  const tax = percentage(taxable, fees.taxBps);

  const deposit = money(pricing.depositMinor, currency);

  const costToRenter = add(rentalSubtotal, deliveryFee, serviceFee, tax);
  const total = add(costToRenter, deposit);

  // The owner is paid on the rental subtotal only. Service fee, tax and
  // delivery are the marketplace's to collect and remit.
  const { commission, remainder: ownerEarnings } = splitLine(rentalSubtotal, fees.commissionBps);

  const lines: PriceLine[] = [
    {
      key: "base",
      label: `Rental · ${pricing.baseDurationDays} ${pricing.baseDurationDays === 1 ? "day" : "days"}`,
      amount: baseAmount,
    },
  ];

  if (extraDays > 0) {
    lines.push({
      key: "extra-days",
      label: `${extraDays} extra ${extraDays === 1 ? "day" : "days"}`,
      detail: `${formatRateHint(pricing.extraDayRateMinor, currency)} a day`,
      amount: extraDaysAmount,
    });
  }

  if (cleaningFee.amountMinor > 0) {
    lines.push({ key: "cleaning", label: "Cleaning", amount: cleaningFee });
  }

  if (discount.amountMinor > 0) {
    lines.push({ key: "discount", label: "Discount", amount: subtract(zero(currency), discount) });
  }

  if (deliveryFee.amountMinor > 0) {
    lines.push({
      key: "delivery",
      label: fulfilment === "LOCAL_DELIVERY" ? "Delivery" : "Shipping, both ways",
      amount: deliveryFee,
    });
  }

  lines.push({
    key: "service-fee",
    label: "Service fee",
    detail: "Verification, support and damage cover",
    amount: serviceFee,
  });

  if (tax.amountMinor > 0) {
    lines.push({
      key: "tax",
      label: `GST · ${formatBps(fees.taxBps)}`,
      amount: tax,
    });
  }

  if (deposit.amountMinor > 0) {
    lines.push({
      key: "deposit",
      label: "Security deposit",
      detail: "Returned in full within 3 days of a clean return",
      amount: deposit,
      refundable: true,
    });
  }

  return {
    currency,
    days,
    extraDays,
    baseAmount,
    extraDaysAmount,
    cleaningFee,
    rentalSubtotal,
    deliveryFee,
    serviceFee,
    tax,
    deposit,
    discount,
    total,
    costToRenter,
    commission,
    ownerEarnings,
    commissionBps: fees.commissionBps,
    lines,
  };
}

/**
 * Combines several garment quotes into one basket total.
 *
 * Baskets can span wardrobes, so the owner split stays per-line; only the
 * renter-facing totals are summed.
 */
export function quoteBasket(quotes: readonly RentalQuote[]): {
  rentalSubtotal: Money;
  deliveryFee: Money;
  serviceFee: Money;
  tax: Money;
  deposit: Money;
  discount: Money;
  total: Money;
  costToRenter: Money;
} {
  if (quotes.length === 0) {
    const nil = zero();
    return {
      rentalSubtotal: nil,
      deliveryFee: nil,
      serviceFee: nil,
      tax: nil,
      deposit: nil,
      discount: nil,
      total: nil,
      costToRenter: nil,
    };
  }

  const sum = (pick: (quote: RentalQuote) => Money) => add(...quotes.map(pick));

  return {
    rentalSubtotal: sum((quote) => quote.rentalSubtotal),
    deliveryFee: sum((quote) => quote.deliveryFee),
    serviceFee: sum((quote) => quote.serviceFee),
    tax: sum((quote) => quote.tax),
    deposit: sum((quote) => quote.deposit),
    discount: sum((quote) => quote.discount),
    total: sum((quote) => quote.total),
    costToRenter: sum((quote) => quote.costToRenter),
  };
}

/**
 * What a renter gets back if they cancel, as a proportion of the rental cost.
 *
 * Published on the listing before payment, never invented afterwards. The
 * deposit is always returned in full on cancellation — it was never earned.
 */
export interface CancellationPolicy {
  /** Full refund of the rental if cancelled at least this many days ahead. */
  readonly fullRefundDaysBefore: number;
  /** Partial refund between the full-refund cutoff and the start date. */
  readonly partialRefundBps: Bps;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  fullRefundDaysBefore: 7,
  partialRefundBps: 5000, // half back inside the week
};

export function refundForCancellation(input: {
  quote: Pick<RentalQuote, "rentalSubtotal" | "serviceFee" | "tax" | "deposit" | "deliveryFee">;
  daysUntilStart: number;
  policy?: CancellationPolicy;
  /** A cancellation the renter did not cause is always refunded in full. */
  causedByOwner?: boolean;
}): { refund: Money; retained: Money; reason: string } {
  const policy = input.policy ?? DEFAULT_CANCELLATION_POLICY;
  const { quote } = input;
  const paid = add(
    quote.rentalSubtotal,
    quote.deliveryFee,
    quote.serviceFee,
    quote.tax,
    quote.deposit,
  );

  if (input.causedByOwner) {
    return {
      refund: paid,
      retained: zero(quote.rentalSubtotal.currency),
      reason: "The owner cancelled, so everything you paid is returned.",
    };
  }

  if (input.daysUntilStart >= policy.fullRefundDaysBefore) {
    return {
      refund: paid,
      retained: zero(quote.rentalSubtotal.currency),
      reason: `Cancelled more than ${policy.fullRefundDaysBefore} days ahead — refunded in full.`,
    };
  }

  if (input.daysUntilStart < 0) {
    // The rental has already started; only the deposit remains at stake.
    return {
      refund: quote.deposit,
      retained: add(quote.rentalSubtotal, quote.deliveryFee, quote.serviceFee, quote.tax),
      reason: "The rental has already begun. Your deposit is still returned.",
    };
  }

  const refundableRental = percentage(quote.rentalSubtotal, policy.partialRefundBps);
  // The service fee covers work already done and is not returned inside the
  // window; the deposit always is.
  const refund = add(refundableRental, quote.deposit, quote.deliveryFee);
  const retained = subtract(paid, refund);

  return {
    refund,
    retained,
    reason: `Cancelled within ${policy.fullRefundDaysBefore} days of the start date — ${formatBps(
      policy.partialRefundBps,
    )} of the rental is returned, along with your full deposit.`,
  };
}

/**
 * Suggests a deposit when an owner lists a garment: a third of retail, bounded
 * so that neither an inexpensive kurta nor a couture lehenga produces an
 * absurd figure. Advisory only — the owner sets the final number.
 */
export function suggestedDeposit(retailPriceMinor: number | null | undefined): number {
  if (!retailPriceMinor || retailPriceMinor <= 0) return 100_000; // ₹1,000
  const third = Math.round(retailPriceMinor / 3);
  const rounded = Math.round(third / 50_000) * 50_000; // nearest ₹500
  return Math.min(Math.max(rounded, 50_000), 2_500_000); // ₹500 – ₹25,000
}

/**
 * Suggests a base rate: roughly a tenth of retail for a three-day period,
 * which is where this market sits.
 */
export function suggestedBaseRate(retailPriceMinor: number | null | undefined): number {
  if (!retailPriceMinor || retailPriceMinor <= 0) return 80_000; // ₹800
  const tenth = Math.round(retailPriceMinor / 10);
  const rounded = Math.round(tenth / 5_000) * 5_000; // nearest ₹50
  return Math.min(Math.max(rounded, 25_000), 1_500_000); // ₹250 – ₹15,000
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBps(bps: Bps): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function formatRateHint(amountMinor: number, currency: Currency): string {
  const major = amountMinor / 100;
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(major)}`;
}
