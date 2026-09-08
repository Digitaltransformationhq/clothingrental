import { expect, test as setup, type Page } from "@playwright/test";

import { SESSIONS } from "./sessions";

/**
 * Signs in once per role and saves the session for the other specs to reuse.
 *
 * Two reasons this is a setup project rather than a helper called from each
 * test:
 *
 *  · Speed. Forty tests do not each need to walk a sign-in form.
 *  · Correctness. The sign-in endpoint is rate limited to five attempts a
 *    minute, which is right for production and which the suite would otherwise
 *    run straight into.
 *
 * Even signing in three times, two runs of the suite inside one minute exceed
 * that limit — so the setup waits and retries rather than the limit being
 * loosened for tests. A defence that is disabled for testing is not a defence.
 */

const SEED_PASSWORD = "almirah-demo-2026";

const ROLES = [
  { file: SESSIONS.renter, email: "ishaan@almirah.example", name: "Ishaan" },
  { file: SESSIONS.owner, email: "ananya@almirah.example", name: "Ananya" },
  { file: SESSIONS.admin, email: "nandini@almirah.example", name: "Nandini" },
];

/**
 * One sign-in attempt. Resolves true when the session is established.
 *
 * Deliberately just waits for the navigation. Racing that against a watcher for
 * the error alert looks tidier and is wrong: when the form does navigate, the
 * alert watcher rejects on the navigation and — having been caught — settles
 * first, so a successful sign-in is reported as a failure.
 */
async function attemptSignIn(page: Page, email: string): Promise<boolean> {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  try {
    await page.waitForURL((url) => !url.pathname.includes("sign-in"), { timeout: 20_000 });
    return true;
  } catch {
    // Still on the form. Either the credentials were refused or the rate limit
    // is in force; the caller waits and tries again.
    return false;
  }
}

for (const role of ROLES) {
  setup(`sign in as ${role.name}`, async ({ page }) => {
    setup.setTimeout(150_000);

    let signedIn = false;
    for (let attempt = 1; attempt <= 3 && !signedIn; attempt += 1) {
      signedIn = await attemptSignIn(page, role.email);

      if (!signedIn && attempt < 3) {
        // The rate-limit window is a minute; waiting past it is the only
        // correct response to being told to slow down.
        await page.waitForTimeout(35_000);
      }
    }

    expect(signedIn, `could not sign in as ${role.email}`).toBe(true);

    // The session is real only if the server renders them as signed in.
    await page.goto("/");
    await expect(page.locator("header")).toContainText(role.name);

    await page.context().storageState({ path: role.file });
  });
}
