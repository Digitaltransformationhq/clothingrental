/**
 * Money.
 *
 * Every amount in Almirah is an integer in the currency's minor unit — paise
 * for INR. Floating point never touches money: `0.1 + 0.2` is not `0.3`, and a
 * marketplace that splits every rental between an owner, a commission and a
 * tax line cannot afford that. A deposit that comes back one paisa short is a
 * support ticket; a thousand of them is an audit.
 *
 * This module is pure and has no dependencies. It is used identically on the
 * server (where amounts are authoritative) and in the browser (where they are
 * only ever displayed).
 */

export const SUPPORTED_CURRENCIES = ["INR"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "INR";

/** Minor units per major unit, per currency. */
const MINOR_UNIT_SCALE: Record<Currency, number> = {
  INR: 100,
};

export interface Money {
  readonly amountMinor: number;
  readonly currency: Currency;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Basis points. 10_000 bps = 100%. Stored as integers, never as 0.185. */
export type Bps = number;

export const BPS_SCALE = 10_000;

// ── Construction ────────────────────────────────────────────────────────────

export function money(amountMinor: number, currency: Currency = DEFAULT_CURRENCY): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new MoneyError(
      `Money must be an integer in minor units; received ${amountMinor}. ` +
        `A fractional amount here means a calculation used floating point.`,
    );
  }
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError(`Money amount ${amountMinor} exceeds the safe integer range.`);
  }
  return { amountMinor, currency };
}

export function zero(currency: Currency = DEFAULT_CURRENCY): Money {
  return { amountMinor: 0, currency };
}

/**
 * Builds Money from a major-unit figure (₹1,250 → 125000 paise).
 *
 * Only for boundaries where a human enters a rupee amount. Internal
 * arithmetic always stays in minor units.
 */
export function fromMajor(amountMajor: number, currency: Currency = DEFAULT_CURRENCY): Money {
  const scale = MINOR_UNIT_SCALE[currency];
  const minor = Math.round(amountMajor * scale);
  // Guard against a caller passing an amount with more precision than the
  // currency has, e.g. ₹10.005, which would silently round.
  if (Math.abs(amountMajor * scale - minor) > 1e-6) {
    throw new MoneyError(
      `${amountMajor} has more precision than ${currency} supports (${scale} minor units).`,
    );
  }
  return money(minor, currency);
}

// ── Arithmetic ──────────────────────────────────────────────────────────────

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Cannot combine ${a.currency} with ${b.currency}.`);
  }
}

export function add(...amounts: Money[]): Money {
  if (amounts.length === 0) return zero();
  const currency = amounts[0].currency;
  let total = 0;
  for (const amount of amounts) {
    assertSameCurrency(amounts[0], amount);
    total += amount.amountMinor;
  }
  return money(total, currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/** Multiplies by a whole number — a per-day rate by a day count, typically. */
export function multiply(amount: Money, factor: number): Money {
  if (!Number.isInteger(factor)) {
    throw new MoneyError(
      `multiply() takes a whole number; received ${factor}. ` +
        `For a rate, use percentage() with basis points.`,
    );
  }
  return money(amount.amountMinor * factor, amount.currency);
}

/**
 * Applies a basis-point rate, rounding half away from zero.
 *
 * Rounding direction is fixed and explicit because it decides who absorbs the
 * half-paisa. Half-up on a positive amount means the platform's commission and
 * the tax line round in the same direction every time, which is what makes the
 * reconciliation in `splitLine` exact.
 */
export function percentage(amount: Money, bps: Bps): Money {
  if (!Number.isInteger(bps)) {
    throw new MoneyError(`Basis points must be an integer; received ${bps}.`);
  }
  const product = amount.amountMinor * bps;
  const rounded =
    product >= 0 ? Math.floor(product / BPS_SCALE + 0.5) : Math.ceil(product / BPS_SCALE - 0.5);
  return money(rounded, amount.currency);
}

export function negate(amount: Money): Money {
  return money(-amount.amountMinor, amount.currency);
}

export function max(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amountMinor >= b.amountMinor ? a : b;
}

export function min(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amountMinor <= b.amountMinor ? a : b;
}

/** Clamps to zero. Used where a negative result would mean "owes nothing". */
export function atLeastZero(amount: Money): Money {
  return amount.amountMinor < 0 ? zero(amount.currency) : amount;
}

// ── Comparison ──────────────────────────────────────────────────────────────

export function isZero(amount: Money): boolean {
  return amount.amountMinor === 0;
}

export function isPositive(amount: Money): boolean {
  return amount.amountMinor > 0;
}

export function isNegative(amount: Money): boolean {
  return amount.amountMinor < 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

export function greaterThan(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return a.amountMinor > b.amountMinor;
}

export function lessThan(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return a.amountMinor < b.amountMinor;
}

// ── Splitting ───────────────────────────────────────────────────────────────

/**
 * Splits an amount into a commission and a remainder that provably sum back to
 * the original.
 *
 * Computing both sides independently from a rate is the classic way to lose a
 * paisa: round the commission up, round the earnings up, and the marketplace
 * has paid out more than it collected. Here the commission is rounded and the
 * owner takes exactly what is left, so the identity holds by construction —
 * which is also what the `RentalItem_split_reconciles` database constraint
 * checks.
 */
export function splitLine(
  amount: Money,
  commissionBps: Bps,
): { commission: Money; remainder: Money } {
  if (commissionBps < 0 || commissionBps > BPS_SCALE) {
    throw new MoneyError(
      `Commission must be between 0 and ${BPS_SCALE} bps; got ${commissionBps}.`,
    );
  }
  const commission = percentage(amount, commissionBps);
  const remainder = subtract(amount, commission);
  return { commission, remainder };
}

/**
 * Distributes an amount across weighted parts without losing or inventing a
 * minor unit. Remainder paise are handed out one at a time to the largest
 * weights first, so the result is deterministic rather than dependent on
 * iteration order.
 *
 * Used when a single payment or refund has to be attributed back to several
 * bookings in one basket.
 */
export function allocate(amount: Money, weights: number[]): Money[] {
  if (weights.length === 0) {
    throw new MoneyError("allocate() requires at least one weight.");
  }
  if (weights.some((weight) => weight < 0)) {
    throw new MoneyError("allocate() weights must not be negative.");
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight === 0) {
    throw new MoneyError("allocate() requires the weights to sum to more than zero.");
  }

  const total = amount.amountMinor;
  const shares = weights.map((weight) => Math.floor((total * weight) / totalWeight));
  let remainder = total - shares.reduce((sum, share) => sum + share, 0);

  const order = weights
    .map((weight, index) => ({ weight, index }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  let cursor = 0;
  while (remainder > 0) {
    shares[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return shares.map((share) => money(share, amount.currency));
}

// ── Formatting ──────────────────────────────────────────────────────────────

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: Currency, locale: string, fractionDigits: number) {
  const key = `${currency}:${locale}:${fractionDigits}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export interface FormatOptions {
  /** Show paise. Off by default: rental prices are quoted in whole rupees. */
  showFraction?: boolean;
  locale?: string;
}

/**
 * Renders an amount for display: ₹1,250 — with Indian digit grouping
 * (₹1,25,000 rather than ₹125,000), which `en-IN` handles natively.
 *
 * Paise are hidden unless asked for. Every price in this marketplace is set in
 * whole rupees, so "₹1,250.00" would only add noise; the fractional form
 * exists for refund and settlement figures, which genuinely can carry paise.
 */
export function formatMoney(amount: Money, options: FormatOptions = {}): string {
  const { showFraction = false, locale = "en-IN" } = options;
  const scale = MINOR_UNIT_SCALE[amount.currency];
  const major = amount.amountMinor / scale;
  const hasFraction = amount.amountMinor % scale !== 0;
  const digits = showFraction || hasFraction ? 2 : 0;
  return getFormatter(amount.currency, locale, digits).format(major);
}

/** The amount without its currency symbol, for use beside a written currency. */
export function formatAmount(amount: Money, options: FormatOptions = {}): string {
  return formatMoney(amount, options).replace(/^[^\d-]+/, "");
}

/**
 * Compact form for dense metadata — ₹24.9k, ₹1.2L. Uses the Indian scale
 * (thousand, lakh, crore) because that is how the numbers are read here.
 */
export function formatMoneyCompact(amount: Money): string {
  const scale = MINOR_UNIT_SCALE[amount.currency];
  const major = Math.abs(amount.amountMinor) / scale;
  const sign = amount.amountMinor < 0 ? "-" : "";
  const symbol = amount.currency === "INR" ? "₹" : "";

  // One decimal below 100, whole numbers above it. ₹24.9k carries information
  // a member cares about; ₹1,247.3k does not.
  const render = (value: number, suffix: string) => {
    const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${sign}${symbol}${rounded}${suffix}`;
  };

  if (major >= 10_000_000) return render(major / 10_000_000, "Cr");
  if (major >= 100_000) return render(major / 100_000, "L");
  if (major >= 1_000) return render(major / 1_000, "k");
  return `${sign}${symbol}${Math.round(major)}`;
}

/** Serialises to the shape stored in the database and sent over the wire. */
export function toMinor(amount: Money): number {
  return amount.amountMinor;
}
