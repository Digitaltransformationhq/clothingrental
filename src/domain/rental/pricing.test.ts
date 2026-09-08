import { describe, expect, it } from "vitest";

import { formatMoney, money } from "@/domain/money";

import {
  DEFAULT_FEE_SCHEDULE,
  type FeeSchedule,
  type ListingPricing,
  perDayRate,
  PricingError,
  quoteBasket,
  quoteRental,
  refundForCancellation,
  rentalChargeForDays,
  suggestedBaseRate,
  suggestedDeposit,
} from "./pricing";

// A ₹850 / 3-day silk saree with a ₹2,000 deposit — the worked example from
// the product brief.
const saree: ListingPricing = {
  currency: "INR",
  baseRateMinor: 85_000,
  baseDurationDays: 3,
  extraDayRateMinor: 20_000,
  depositMinor: 200_000,
  cleaningFeeMinor: 0,
  deliveryFeeMinor: 15_000,
};

const noFees: FeeSchedule = {
  commissionBps: 0,
  serviceFeeBps: 0,
  taxBps: 0,
  minFeeMinor: 0,
};

describe("rentalChargeForDays", () => {
  it("charges the base rate for the base period", () => {
    expect(rentalChargeForDays(saree, 3).amountMinor).toBe(85_000);
  });

  it("charges the base rate even for a shorter stay", () => {
    // Otherwise a five-day base could be gamed into a cheap overnight.
    expect(rentalChargeForDays(saree, 1).amountMinor).toBe(85_000);
    expect(rentalChargeForDays(saree, 2).amountMinor).toBe(85_000);
  });

  it("adds the extra-day rate beyond the base period", () => {
    expect(rentalChargeForDays(saree, 5).amountMinor).toBe(85_000 + 2 * 20_000);
  });

  it("refuses a fractional or zero duration", () => {
    expect(() => rentalChargeForDays(saree, 0)).toThrow(PricingError);
    expect(() => rentalChargeForDays(saree, 2.5)).toThrow(PricingError);
  });
});

describe("perDayRate", () => {
  it("rounds up so the advertised rate is never below what is charged", () => {
    // ₹850 over 3 days is ₹283.33; quoting ₹283 would undercut checkout.
    expect(perDayRate(saree).amountMinor).toBe(28_334);
  });
});

describe("quoteRental", () => {
  it("itemises a three-day rental", () => {
    const quote = quoteRental({ pricing: saree, days: 3, fulfilment: "SHIPPING" });

    expect(quote.rentalSubtotal.amountMinor).toBe(85_000);
    expect(quote.deliveryFee.amountMinor).toBe(15_000);
    // 6% of ₹850 = ₹51, above the ₹49 floor.
    expect(quote.serviceFee.amountMinor).toBe(5_100);
    // 18% of (85000 + 15000 + 5100) = 18918
    expect(quote.tax.amountMinor).toBe(18_918);
    expect(quote.deposit.amountMinor).toBe(200_000);
    expect(quote.total.amountMinor).toBe(85_000 + 15_000 + 5_100 + 18_918 + 200_000);
  });

  it("keeps the deposit out of the cost of the rental", () => {
    const quote = quoteRental({ pricing: saree, days: 3 });
    expect(quote.costToRenter.amountMinor).toBe(
      quote.total.amountMinor - quote.deposit.amountMinor,
    );
  });

  it("never taxes the deposit", () => {
    const withDeposit = quoteRental({ pricing: saree, days: 3 });
    const withoutDeposit = quoteRental({ pricing: { ...saree, depositMinor: 0 }, days: 3 });
    // A refundable holding amount is not consideration for a supply; taxing it
    // would mean refunding less than was taken.
    expect(withDeposit.tax.amountMinor).toBe(withoutDeposit.tax.amountMinor);
  });

  it("does not charge delivery when the garment is collected in person", () => {
    const quote = quoteRental({ pricing: saree, days: 3, fulfilment: "PICKUP" });
    expect(quote.deliveryFee.amountMinor).toBe(0);
    expect(quote.lines.find((line) => line.key === "delivery")).toBeUndefined();
  });

  it("applies the minimum service fee to small rentals", () => {
    const cheap: ListingPricing = { ...saree, baseRateMinor: 20_000, deliveryFeeMinor: 0 };
    const quote = quoteRental({ pricing: cheap, days: 3 });
    // 6% of ₹200 is ₹12, below the ₹49 floor.
    expect(quote.serviceFee.amountMinor).toBe(DEFAULT_FEE_SCHEDULE.minFeeMinor);
  });

  it("splits the subtotal between commission and owner earnings exactly", () => {
    const quote = quoteRental({ pricing: saree, days: 7 });
    expect(quote.commission.amountMinor + quote.ownerEarnings.amountMinor).toBe(
      quote.rentalSubtotal.amountMinor,
    );
  });

  it("pays the owner on the rental only, not on fees or tax", () => {
    const quote = quoteRental({ pricing: saree, days: 3 });
    // 85000 less 15% = 72250
    expect(quote.ownerEarnings.amountMinor).toBe(72_250);
  });

  it("applies a discount before fees are calculated", () => {
    const quote = quoteRental({
      pricing: saree,
      days: 3,
      discountMinor: 10_000,
      fees: { ...noFees, serviceFeeBps: 1000 },
    });
    expect(quote.rentalSubtotal.amountMinor).toBe(75_000);
    expect(quote.serviceFee.amountMinor).toBe(7_500);
  });

  it("refuses a discount larger than the rental", () => {
    expect(() => quoteRental({ pricing: saree, days: 3, discountMinor: 999_999 })).toThrow(
      PricingError,
    );
  });

  it("produces a breakdown whose lines sum to the total", () => {
    // The breakdown a member reads must reconcile to what the card is charged.
    const quote = quoteRental({ pricing: saree, days: 6 });
    const sum = quote.lines.reduce((total, line) => total + line.amount.amountMinor, 0);
    expect(sum).toBe(quote.total.amountMinor);
  });

  it("marks only the deposit as refundable", () => {
    const quote = quoteRental({ pricing: saree, days: 3 });
    const refundable = quote.lines.filter((line) => line.refundable);
    expect(refundable).toHaveLength(1);
    expect(refundable[0].key).toBe("deposit");
  });

  it("renders the worked example the brief specifies", () => {
    const quote = quoteRental({
      pricing: { ...saree, baseRateMinor: 125_000, deliveryFeeMinor: 0 },
      days: 3,
      fees: noFees,
    });
    expect(formatMoney(quote.rentalSubtotal)).toBe("₹1,250");
    expect(formatMoney(quote.deposit)).toBe("₹2,000");
    expect(formatMoney(quote.total)).toBe("₹3,250");
  });
});

describe("quoteBasket", () => {
  it("sums several garments into one basket", () => {
    const a = quoteRental({ pricing: saree, days: 3 });
    const b = quoteRental({ pricing: { ...saree, baseRateMinor: 50_000 }, days: 3 });
    const basket = quoteBasket([a, b]);

    expect(basket.total.amountMinor).toBe(a.total.amountMinor + b.total.amountMinor);
    expect(basket.deposit.amountMinor).toBe(a.deposit.amountMinor + b.deposit.amountMinor);
  });

  it("returns zeroes for an empty basket", () => {
    expect(quoteBasket([]).total.amountMinor).toBe(0);
  });
});

describe("refundForCancellation", () => {
  const quote = quoteRental({ pricing: saree, days: 3 });

  it("refunds everything when cancelled well ahead", () => {
    const { refund, retained } = refundForCancellation({ quote, daysUntilStart: 10 });
    expect(refund.amountMinor).toBe(quote.total.amountMinor);
    expect(retained.amountMinor).toBe(0);
  });

  it("retains the service fee inside the cancellation window", () => {
    const { refund, retained } = refundForCancellation({ quote, daysUntilStart: 2 });
    expect(refund.amountMinor).toBeLessThan(quote.total.amountMinor);
    // Whatever the policy, the deposit always comes back in full.
    expect(refund.amountMinor).toBeGreaterThanOrEqual(quote.deposit.amountMinor);
    expect(refund.amountMinor + retained.amountMinor).toBe(quote.total.amountMinor);
  });

  it("refunds in full when the owner is at fault, whenever it happens", () => {
    const { refund } = refundForCancellation({ quote, daysUntilStart: 0, causedByOwner: true });
    expect(refund.amountMinor).toBe(quote.total.amountMinor);
  });

  it("still returns the deposit once the rental has begun", () => {
    const { refund } = refundForCancellation({ quote, daysUntilStart: -2 });
    expect(refund.amountMinor).toBe(quote.deposit.amountMinor);
  });
});

describe("pricing suggestions", () => {
  it("suggests a deposit near a third of retail, within sane bounds", () => {
    expect(suggestedDeposit(600_000)).toBe(200_000); // ₹6,000 retail → ₹2,000
    expect(suggestedDeposit(null)).toBe(100_000);
    expect(suggestedDeposit(100_000_000)).toBe(2_500_000); // capped at ₹25,000
    expect(suggestedDeposit(1_000)).toBe(50_000); // floored at ₹500
  });

  it("suggests a base rate near a tenth of retail", () => {
    expect(suggestedBaseRate(1_000_000)).toBe(100_000); // ₹10,000 retail → ₹1,000
    expect(suggestedBaseRate(0)).toBe(80_000);
  });
});

describe("money never goes fractional", () => {
  it("keeps every quoted figure an integer across a wide sweep", () => {
    for (let days = 1; days <= 30; days += 1) {
      for (const base of [1, 999, 85_000, 1_234_567]) {
        const quote = quoteRental({
          pricing: { ...saree, baseRateMinor: base },
          days,
        });
        for (const value of [
          quote.rentalSubtotal,
          quote.serviceFee,
          quote.tax,
          quote.total,
          quote.commission,
          quote.ownerEarnings,
        ]) {
          expect(Number.isInteger(value.amountMinor)).toBe(true);
        }
        expect(quote.commission.amountMinor + quote.ownerEarnings.amountMinor).toBe(
          quote.rentalSubtotal.amountMinor,
        );
      }
    }
  });
});

describe("money value object guards", () => {
  it("rejects a non-integer amount at construction", () => {
    expect(() => money(10.5)).toThrow();
  });
});
