import path from "node:path";

/**
 * Where each role's saved session lives.
 *
 * A plain module rather than an export from the setup spec: Playwright refuses
 * to let one test file import another, and the paths are needed by both.
 */
export const SESSIONS = {
  renter: path.join(process.cwd(), "tests/.sessions/renter.json"),
  owner: path.join(process.cwd(), "tests/.sessions/owner.json"),
  admin: path.join(process.cwd(), "tests/.sessions/admin.json"),
} as const;
