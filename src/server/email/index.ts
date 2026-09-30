import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/env";

/**
 * Transactional email.
 *
 * A port with three implementations. `console` prints the rendered message to the
 * server log and sends nothing — which is what development and CI use, and is
 * the reason running this project cannot accidentally email a real person.
 * `resend` and `smtp` send for real — `smtp` through any mail server, in
 * practice a Gmail account with an app password, which needs no domain.
 *
 * Email is deliberately fire-and-forget at the call site: a rental must not
 * fail because a mail provider is slow. Failures are logged, not thrown.
 */

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Plain text. Always sent, and always written first. */
  readonly text: string;
  readonly html?: string;
  readonly replyTo?: string;
}

export interface EmailDriver {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailDriver implements EmailDriver {
  async send(message: EmailMessage): Promise<void> {
    const rule = "─".repeat(64);
    console.info(
      `\n${rule}\n  EMAIL (not sent — EMAIL_DRIVER is "console")\n` +
        `  To:      ${message.to}\n  Subject: ${message.subject}\n${rule}\n` +
        `${message.text}\n${rule}\n`,
    );
  }
}

class ResendEmailDriver implements EmailDriver {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        reply_to: message.replyTo,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Resend rejected the message: ${response.status} ${await response.text()}`);
    }
  }
}

class SmtpEmailDriver implements EmailDriver {
  private readonly transport: Transporter;

  constructor(
    options: { host: string; port: number; user: string; password: string },
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      // 465 is TLS from the first byte; 587 upgrades with STARTTLS.
      secure: options.port === 465,
      auth: { user: options.user, pass: options.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
  }
}

let driver: EmailDriver | undefined;

function getDriver(): EmailDriver {
  if (!driver) {
    if (env.EMAIL_DRIVER === "resend" && env.RESEND_API_KEY) {
      driver = new ResendEmailDriver(env.RESEND_API_KEY, env.EMAIL_FROM);
    } else if (env.EMAIL_DRIVER === "smtp" && env.SMTP_USER && env.SMTP_PASSWORD) {
      driver = new SmtpEmailDriver(
        {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER,
          password: env.SMTP_PASSWORD,
        },
        env.EMAIL_FROM,
      );
    } else {
      driver = new ConsoleEmailDriver();
    }
  }
  return driver;
}

/**
 * Sends a message, swallowing failures.
 *
 * Nothing in a booking flow should be undone because an email did not go out.
 * The notification is already in the database and visible in the interface;
 * email is a second channel, not the record.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await getDriver().send(message);
  } catch (error) {
    console.error(`[almirah] failed to send "${message.subject}" to ${message.to}:`, error);
  }
}

/** For `scripts/send-test-email.ts`: the same driver, with failures surfaced. */
export async function __sendEmailOrThrow(message: EmailMessage): Promise<void> {
  await getDriver().send(message);
}

/** Test seam. */
export function __setEmailDriver(next: EmailDriver | undefined): void {
  driver = next;
}

// ── Templates ───────────────────────────────────────────────────────────────

const APP_URL = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

/**
 * Written as plain text first, in the same voice as the interface. Almost
 * every transactional email people actually read is plain, and an HTML mail
 * that renders badly in one client is worse than none.
 */
export const emails = {
  passwordReset: (input: { to: string; name: string; url: string }) => ({
    to: input.to,
    subject: "Reset your Almirah password",
    text: `${input.name},

Someone — hopefully you — asked to reset the password on your Almirah account. Choose a new one here:

${input.url}

The link works once and expires in an hour. If you didn't ask for this, ignore this email; your password stays as it is.

— Almirah`,
  }),

  rentalRequested: (input: {
    to: string;
    ownerName: string;
    itemTitle: string;
    dates: string;
  }) => ({
    to: input.to,
    subject: `New request for your ${input.itemTitle.toLowerCase()}`,
    text: `${input.ownerName},

Someone would like to borrow your ${input.itemTitle.toLowerCase()} for ${input.dates}.

Have a look and reply within 24 hours — quick replies keep your response rate up, and it is one of the first things renters look at.

${APP_URL}/account/listings

— Almirah`,
  }),

  rentalAccepted: (input: {
    to: string;
    renterName: string;
    itemTitle: string;
    dates: string;
    reference: string;
  }) => ({
    to: input.to,
    subject: `Your ${input.itemTitle.toLowerCase()} is confirmed`,
    text: `${input.renterName},

Good news — the owner has confirmed your dates for the ${input.itemTitle.toLowerCase()}, ${input.dates}.

It will be cleaned and sent so that it reaches you a day or two before you need it. You will get tracking here as soon as it is on its way.

Reference ${input.reference}
${APP_URL}/account/rentals

— Almirah`,
  }),

  paymentReceived: (input: {
    to: string;
    renterName: string;
    total: string;
    deposit: string;
    reference: string;
  }) => ({
    to: input.to,
    subject: `Payment received — ${input.reference}`,
    text: `${input.renterName},

We have received ${input.total} for rental ${input.reference}.

Of that, ${input.deposit} is your security deposit. It is held, not paid to the owner, and comes back to you in full within three days of a clean return.

${APP_URL}/account/rentals

— Almirah`,
  }),

  returnReminder: (input: {
    to: string;
    renterName: string;
    itemTitle: string;
    returnDate: string;
  }) => ({
    to: input.to,
    subject: `Time to send the ${input.itemTitle.toLowerCase()} back`,
    text: `${input.renterName},

A reminder that the ${input.itemTitle.toLowerCase()} is due back on ${input.returnDate}.

Send it in the same packaging it arrived in. Please do not have it cleaned unless the owner asked you to — specialist pieces are often damaged by ordinary dry cleaning.

Your deposit is released within three days of it arriving back.

${APP_URL}/account/rentals

— Almirah`,
  }),

  depositReleased: (input: {
    to: string;
    renterName: string;
    amount: string;
    reference: string;
  }) => ({
    to: input.to,
    subject: `Your ${input.amount} deposit is on its way back`,
    text: `${input.renterName},

The piece is back with its owner and everything is in order, so your full deposit of ${input.amount} has been released.

It should reach your account within three working days, depending on your bank.

Reference ${input.reference}

— Almirah`,
  }),

  listingApproved: (input: { to: string; ownerName: string; itemTitle: string; slug: string }) => ({
    to: input.to,
    subject: `${input.itemTitle} is live`,
    text: `${input.ownerName},

Your ${input.itemTitle.toLowerCase()} has been reviewed and is now listed. It will start appearing in searches and collections straight away.

${APP_URL}/item/${input.slug}

— Almirah`,
  }),

  listingRejected: (input: { to: string; ownerName: string; itemTitle: string; note: string }) => ({
    to: input.to,
    subject: `${input.itemTitle} needs a small change`,
    text: `${input.ownerName},

We have looked at your ${input.itemTitle.toLowerCase()} and it needs one thing changed before it can go live:

  ${input.note}

Edit the listing and it goes straight back into the queue — usually reviewed within a few hours.

${APP_URL}/account/listings

— Almirah`,
  }),

  payoutProcessed: (input: {
    to: string;
    ownerName: string;
    amount: string;
    reference: string;
  }) => ({
    to: input.to,
    subject: `${input.amount} is on its way to you`,
    text: `${input.ownerName},

Your earnings of ${input.amount} have been sent to your registered account.

Most banks credit within two working days.

Reference ${input.reference}
${APP_URL}/account/earnings

— Almirah`,
  }),
};
