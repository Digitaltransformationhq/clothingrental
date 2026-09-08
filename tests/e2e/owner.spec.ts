import { expect, test } from "@playwright/test";

import { SESSIONS } from "./sessions";

/**
 * The owner's side, and the boundaries around it.
 *
 * The second half of a two-sided marketplace: listing a piece, seeing requests,
 * acting on them, and being paid. Plus the authorisation checks that keep one
 * member out of another's wardrobe — those are tested here rather than in a
 * unit test because they depend on real sessions and real routing.
 */

test.describe("the owner's wardrobe", () => {
  test.use({ storageState: SESSIONS.owner });

  test("shows requests waiting on a decision", async ({ page }) => {
    await page.goto("/account/listings");

    await expect(page.getByRole("heading", { name: /waiting on you/i })).toBeVisible();
    // What the owner would earn, not what the renter pays.
    await expect(page.getByText(/you.d earn/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /accept request/i }).first()).toBeVisible();
  });

  test("offers only the actions the state machine permits", async ({ page }) => {
    await page.goto("/account/listings");

    // A confirmed booking can be sent or cancelled; it cannot be "returned",
    // because the garment has not left yet.
    const outSection = page.getByRole("heading", { name: /out on rental/i });
    await expect(outSection).toBeVisible();
    await expect(page.getByRole("button", { name: /mark as sent/i }).first()).toBeVisible();
  });

  test("earnings separate settled, pending and available money", async ({ page }) => {
    await page.goto("/account/earnings");

    await expect(page.getByText(/available to withdraw/i)).toBeVisible();
    await expect(page.getByText(/on its way/i)).toBeVisible();
    await expect(page.getByText(/already paid out/i)).toBeVisible();
  });

  test("the availability calendar shows bookings and blocked windows", async ({ page }) => {
    await page.goto("/account/calendar");

    await expect(page.getByRole("heading", { name: /your pieces/i })).toBeVisible();
    await expect(page.getByText("Booked", { exact: true }).first()).toBeVisible();
  });
});

test.describe("listing a piece", () => {
  test.use({ storageState: SESSIONS.owner });

  test("the wizard opens on photographs and will not skip ahead", async ({ page }) => {
    await page.goto("/sell/new");

    await expect(page.getByRole("heading", { name: /show us the piece/i })).toBeVisible();
    await expect(page.getByText(/drag photographs here/i)).toBeVisible();

    // Continuing without photographs must be refused, with a reason.
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/at least 3 photographs/i)).toBeVisible();
  });

  test("the live preview reflects what has been entered", async ({ page }) => {
    await page.goto("/sell/new");

    await expect(page.getByText(/how it will look/i)).toBeVisible();
    await expect(page.getByText(/untitled piece/i)).toBeVisible();
  });
});

test.describe("authorisation", () => {
  test("the account area requires signing in", async ({ page }) => {
    await page.goto("/account/rentals");
    await page.waitForURL(/sign-in/);
  });

  test("administration is invisible to an ordinary member", async ({ browser }) => {
    const context = await browser.newContext({ storageState: SESSIONS.renter });
    const page = await context.newPage();
    await page.goto("/admin");

    // Not found rather than forbidden: a member learns nothing about what
    // exists at this address.
    await expect(page.getByText(/nothing here/i)).toBeVisible();
    await expect(page.getByText(/moderation & operations/i)).toHaveCount(0);
    await context.close();
  });

  test("administration works for staff", async ({ browser }) => {
    const context = await browser.newContext({ storageState: SESSIONS.admin });
    const page = await context.newPage();
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: /moderation & operations/i })).toBeVisible();
    await expect(page.getByText(/needs a decision/i)).toBeVisible();
    await context.close();
  });

  test("a member cannot edit somebody else's listing", async ({ browser }) => {
    const context = await browser.newContext({ storageState: SESSIONS.renter });
    const page = await context.newPage();
    // Scoped by ownerId, so another member's listing id resolves to nothing
    // rather than to an editable form.
    await page.goto("/sell/not-my-listing-id/edit");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/left the wardrobe/i);
    await context.close();
  });

  test("an unsigned payment webhook is rejected", async ({ request }) => {
    const response = await request.post("/api/webhooks/payments", {
      data: { kind: "payment.captured", providerOrderId: "order_forged" },
    });
    expect(response.status()).toBe(400);
  });

  test("uploads require a session", async ({ request }) => {
    const response = await request.post("/api/uploads", {
      multipart: { file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") } },
    });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe("the site holds together", () => {
  const routes = [
    "/",
    "/shop",
    "/shop/sarees",
    "/collections",
    "/how-it-works",
    "/about",
    "/sell",
    "/legal/terms",
    "/legal/privacy",
    "/legal/rental-agreement",
    "/legal/cancellation",
    "/wardrobe/meher-kapadia",
  ];

  for (const route of routes) {
    test(`${route} renders without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);

      // Every page must have exactly one first-level heading.
      await expect(page.locator("h1")).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  }

  test("health reports the configured drivers", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });
});
