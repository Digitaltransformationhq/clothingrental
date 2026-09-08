import { expect, test } from "@playwright/test";

import { SESSIONS } from "./sessions";

/**
 * The renter's journey, end to end.
 *
 * Browse, filter, open a piece, choose dates, check out, pay, and land on a
 * confirmation with a real reference. This is the path that has to work; if it
 * does not, nothing else about the marketplace matters.
 *
 * Runs against the sandbox payment provider, which is a real implementation of
 * the payment port rather than a mock — the same code path production uses,
 * with a different provider behind it.
 */

test.describe("browsing", () => {
  test("the homepage leads with real listings", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Looks worth");

    // The rail is populated from the catalogue, not hardcoded.
    const firstListing = page.locator('a[href^="/item/"]').first();
    await expect(firstListing).toBeVisible();
  });

  test("the shop filters through the URL", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "Everything" })).toBeVisible();

    const initial = await page.locator('a[href^="/item/"]').count();
    expect(initial).toBeGreaterThan(0);

    // Filtering by a category must both narrow the results and be shareable.
    await page.goto("/shop?category=sarees");
    await expect(page).toHaveURL(/category=sarees/);

    const filtered = await page.locator('a[href^="/item/"]').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(initial);
  });

  test("an impossible filter combination explains itself", async ({ page }) => {
    await page.goto("/shop?minPrice=14000&maxPrice=15000&category=kurtas");
    await expect(page.getByText(/Nothing matches all of that/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /clear filters/i })).toBeVisible();
  });

  test("a listing page shows price, deposit and availability", async ({ page }) => {
    await page.goto("/item/black-satin-midi-dress");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Black satin midi dress");
    // Deposit is stated on the page, not discovered at checkout.
    await expect(page.getByText(/refundable deposit/i).first()).toBeVisible();
    await expect(page.getByText(/Charged today/i)).toBeVisible();
  });
});

test.describe("renting", () => {
  test.use({ storageState: SESSIONS.renter });

  test("a member can rent a piece and reach a confirmation", async ({ page }) => {
    await page.goto("/item/black-satin-midi-dress");
    const panel = page.locator("[data-rental-panel]");
    await expect(panel).toBeVisible();

    // The panel opens on the first bookable window, so a price is already shown.
    const chargedRow = panel.getByText(/Charged today/i);
    await expect(chargedRow).toBeVisible();

    await panel.getByRole("button", { name: /rent now|request to rent/i }).click();
    await page.waitForURL(/\/checkout\//);

    await expect(page.getByRole("heading", { name: /confirm your rental/i })).toBeVisible();

    // A delivery address is required before money can move.
    const address = page.locator("button[aria-pressed]").first();
    if (await address.count()) await address.click();

    await page.getByRole("button", { name: /^(pay|request and pay)/i }).click();
    await page.waitForURL(/\/checkout\/success\//);

    // A real, quotable reference.
    await expect(page.getByText(/ALM-[A-Z0-9]{6}/)).toBeVisible();
  });

  test("the rental then appears in the member's own rentals", async ({ page }) => {
    await page.goto("/account/rentals");

    await expect(page.getByRole("heading", { name: /your next look/i })).toBeVisible();
  });

  test("checkout cannot be opened by somebody else", async ({ page }) => {
    // A rental id is not authorisation to view it. Asserted on what is actually
    // rendered rather than on a status code: Next streams the layout shell with
    // a 200 before delivering the redirect, so the status says nothing useful
    // about whether anything leaked.
    await page.goto("/checkout/some-rental-id-that-is-not-mine");

    await expect(page.getByRole("heading", { name: /confirm your rental/i })).toHaveCount(0);
    await expect(page.getByText(/security deposit|charged today/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/left the wardrobe/i);
  });
});

test.describe("saving, signed out", () => {
  test("a visitor is asked to sign in before saving", async ({ page }) => {
    await page.goto("/item/linen-saree-in-indigo");

    await page
      .getByRole("button", { name: /^save /i })
      .first()
      .click();
    await page.waitForURL(/sign-in/, { timeout: 20_000 });
  });
});

test.describe("saving, signed in", () => {
  test.use({ storageState: SESSIONS.renter });

  test("a member can save a piece and the heart holds its state", async ({ page }) => {
    await page.goto("/item/chanderi-saree-in-sage");

    const save = page.getByRole("button", { name: /^save |^remove /i }).first();
    const wasSaved = (await save.getAttribute("aria-pressed")) === "true";
    await save.click();

    await expect(save).toHaveAttribute("aria-pressed", String(!wasSaved));
  });
});
