import { describe, expect, it } from "vitest";

import {
  add,
  allocate,
  BPS_SCALE,
  formatMoney,
  formatMoneyCompact,
  fromMajor,
  money,
  MoneyError,
  multiply,
  percentage,
  splitLine,
  subtract,
} from "./money";

describe("money construction", () => {
  it("refuses fractional minor units", () => {
    // A fractional paisa always means a float crept into a calculation.
    expect(() => money(1250.5)).toThrow(MoneyError);
  });

  it("converts rupees to paise", () => {
    expect(fromMajor(1250).amountMinor).toBe(125_000);
    expect(fromMajor(0.5).amountMinor).toBe(50);
  });

  it("refuses a major amount with more precision than the currency has", () => {
    expect(() => fromMajor(10.005)).toThrow(MoneyError);
  });
});

describe("arithmetic", () => {
  it("adds and subtracts exactly", () => {
    expect(add(money(85_000), money(20_000), money(4_900)).amountMinor).toBe(109_900);
    expect(subtract(money(125_000), money(25_000)).amountMinor).toBe(100_000);
  });

  it("refuses to multiply by a fraction", () => {
    // Rates must go through percentage(); silent float multiplication is the
    // exact failure this module exists to prevent.
    expect(() => multiply(money(85_000), 1.5)).toThrow(MoneyError);
  });

  it("rejects mixing currencies", () => {
    const inr = money(100, "INR");
    const other = { amountMinor: 100, currency: "USD" } as unknown as typeof inr;
    expect(() => add(inr, other)).toThrow(MoneyError);
  });
});

describe("percentage", () => {
  it("applies basis points", () => {
    // 18% GST on ₹1,000
    expect(percentage(money(100_000), 1800).amountMinor).toBe(18_000);
  });

  it("rounds half away from zero, deterministically", () => {
    // 12345 * 1500 / 10000 = 1851.75 → 1852
    expect(percentage(money(12_345), 1500).amountMinor).toBe(1852);
    // Exactly .5 rounds up rather than to even.
    expect(percentage(money(10), 5000).amountMinor).toBe(5);
    expect(percentage(money(1), 5000).amountMinor).toBe(1);
    expect(percentage(money(-1), 5000).amountMinor).toBe(-1);
  });

  it("treats the full scale as one hundred percent", () => {
    expect(percentage(money(99_999), BPS_SCALE).amountMinor).toBe(99_999);
  });
});

describe("splitLine", () => {
  it("always reconciles, whatever the rounding", () => {
    // This is the invariant the RentalItem_split_reconciles database
    // constraint enforces. If it can fail here, it will fail there.
    for (let amount = 1; amount <= 2_000; amount += 1) {
      for (const bps of [0, 1, 750, 1500, 3333, 9999, BPS_SCALE]) {
        const { commission, remainder } = splitLine(money(amount), bps);
        expect(commission.amountMinor + remainder.amountMinor).toBe(amount);
        expect(commission.amountMinor).toBeGreaterThanOrEqual(0);
        expect(remainder.amountMinor).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("takes commission from the owner's side", () => {
    const { commission, remainder } = splitLine(money(100_000), 1500);
    expect(commission.amountMinor).toBe(15_000);
    expect(remainder.amountMinor).toBe(85_000);
  });

  it("rejects a rate outside the scale", () => {
    expect(() => splitLine(money(100), 10_001)).toThrow(MoneyError);
  });
});

describe("allocate", () => {
  it("distributes without losing or inventing a paisa", () => {
    const parts = allocate(money(100), [1, 1, 1]);
    expect(parts.map((part) => part.amountMinor)).toEqual([34, 33, 33]);
    expect(parts.reduce((sum, part) => sum + part.amountMinor, 0)).toBe(100);
  });

  it("gives remainder paise to the largest weights first", () => {
    const parts = allocate(money(10), [5, 3, 2]);
    expect(parts.reduce((sum, part) => sum + part.amountMinor, 0)).toBe(10);
    expect(parts[0].amountMinor).toBeGreaterThanOrEqual(parts[2].amountMinor);
  });

  it("is deterministic regardless of how the weights are ordered", () => {
    const a = allocate(money(1_001), [3, 3, 3]);
    const b = allocate(money(1_001), [3, 3, 3]);
    expect(a).toEqual(b);
  });

  it("rejects weights that sum to zero", () => {
    expect(() => allocate(money(100), [0, 0])).toThrow(MoneyError);
  });
});

describe("formatting", () => {
  it("uses Indian digit grouping", () => {
    // ₹1,25,000 — not ₹125,000. This is the whole reason for the en-IN locale.
    expect(formatMoney(money(12_500_000))).toBe("₹1,25,000");
    expect(formatMoney(money(125_000))).toBe("₹1,250");
  });

  it("hides paise unless they are present or asked for", () => {
    expect(formatMoney(money(125_000))).toBe("₹1,250");
    expect(formatMoney(money(125_050))).toBe("₹1,250.50");
    expect(formatMoney(money(125_000), { showFraction: true })).toBe("₹1,250.00");
  });

  it("compacts on the Indian scale", () => {
    expect(formatMoneyCompact(money(85_000))).toBe("₹850"); // ₹850
    expect(formatMoneyCompact(money(2_485_000))).toBe("₹24.9k"); // ₹24,850
    expect(formatMoneyCompact(money(12_500_000))).toBe("₹1.3L"); // ₹1,25,000
    expect(formatMoneyCompact(money(480_000_000))).toBe("₹48L"); // ₹48,00,000
    expect(formatMoneyCompact(money(2_500_000_000))).toBe("₹2.5Cr"); // ₹2,50,00,000
  });
});
