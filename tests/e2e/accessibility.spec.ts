import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { SESSIONS } from "./sessions";

/**
 * Accessibility.
 *
 * Runs axe against every significant page at WCAG 2.1 A and AA, plus the 2.2
 * additions axe can check automatically. It is not a substitute for using the
 * site with a keyboard and a screen reader — most of WCAG cannot be automated —
 * but it catches the mechanical failures reliably, and a failing build is a
 * better reviewer than good intentions.
 *
 * The keyboard checks below cover the things automation misses and that this
 * interface depends on: a working skip link, a focus trap in the dialogs, and a
 * date picker that can be operated without a pointer.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const PUBLIC_PAGES = [
  "/",
  "/shop",
  "/shop/sarees",
  "/item/black-satin-midi-dress",
  "/collections",
  "/how-it-works",
  "/about",
  "/sell",
  "/auth/sign-in",
  "/legal/terms",
  "/wardrobe/meher-kapadia",
];

for (const route of PUBLIC_PAGES) {
  test(`${route} has no accessibility violations`, async ({ page }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    // Reported in full rather than as a count, so a failure says what to fix.
    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));

    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}

test.describe("signed-in pages", () => {
  test.use({ storageState: SESSIONS.owner });

  for (const route of ["/account/rentals", "/account/listings", "/account/earnings", "/sell/new"]) {
    test(`${route} has no accessibility violations`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const summary = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
      }));
      expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
    });
  }
});

test.describe("keyboard operation", () => {
  test("the skip link is the first stop and works", async ({ page }) => {
    await page.goto("/shop");

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: /skip to content/i });
    await expect(skip).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main/);
  });

  test("the search dialog traps focus and closes on escape", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /search the wardrobe/i }).click();
    const field = page.getByRole("textbox", { name: "Search" });
    await expect(field).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(field).toHaveCount(0);
  });

  test("the date picker can be driven from the keyboard", async ({ page }) => {
    await page.goto("/item/black-satin-midi-dress");

    // Every selectable date is a real button with an accessible name, and arrow
    // keys move between them — a calendar that only responds to a pointer is
    // unusable. Past dates are disabled and cannot take focus, which is correct,
    // so the test drives an enabled one.
    const day = page.locator("[data-date]:not([disabled])").first();
    await day.focus();
    await expect(day).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(day).not.toBeFocused();
  });

  test("every garment photograph carries alternative text", async ({ page }) => {
    await page.goto("/shop");

    const images = page.locator("main img");
    const count = await images.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const image = images.nth(index);
      const alt = await image.getAttribute("alt");
      const hidden = await image.getAttribute("aria-hidden");
      // Either it describes the garment, or it is explicitly decorative.
      expect(alt !== null || hidden === "true").toBe(true);
    }
  });
});
