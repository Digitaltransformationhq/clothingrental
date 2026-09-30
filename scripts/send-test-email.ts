/**
 * Sends one real email through the configured driver, so a mail setup can be
 * checked without resetting a password or making a booking.
 *
 *   npm run email:test -- someone@example.com
 *
 * Unlike `sendEmail`, failures are thrown rather than logged, so a wrong app
 * password shows up here as an error instead of a quiet line in a server log.
 */
import { env } from "@/env";

async function main() {
  const to = process.argv[2];
  if (!to?.includes("@")) throw new Error("Usage: npm run email:test -- someone@example.com");
  if (env.EMAIL_DRIVER === "console") {
    console.warn('EMAIL_DRIVER is "console", so this prints below instead of sending.');
  }

  const { __sendEmailOrThrow } = await import("@/server/email");
  await __sendEmailOrThrow({
    to,
    subject: "Almirah test email",
    text: `This is a test from Almirah.\n\nIf you're reading it, email is working — sent via "${env.EMAIL_DRIVER}" from ${env.EMAIL_FROM}.\n\n— Almirah`,
  });
  console.info(`Sent to ${to} via "${env.EMAIL_DRIVER}".`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error("Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
