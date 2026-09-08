import "server-only";

import { BookingStatus, RentalStatus } from "@/generated/prisma/enums";
import { getDb } from "@/server/db/client";
import { errors } from "@/server/errors";
import { getPaymentProvider, providerEnum } from "@/server/payments";
import { PaymentError } from "@/server/payments/provider";

/**
 * Payment orchestration.
 *
 * The sequence, and why it is in this order:
 *
 *   1. `beginPayment` reads the rental's own stored total — never a figure from
 *      the client — and asks the provider for an order.
 *   2. The browser completes the provider's flow.
 *   3. `settlePayment` asks the *provider* what happened. A browser reporting
 *      success is a hint, not evidence: anyone can call our confirm endpoint.
 *   4. Only once the provider confirms the money does the booking advance.
 *
 * Every step is idempotent. Payment networks retry, members double-click, and
 * webhooks arrive twice; none of that may take a second payment or confirm a
 * booking twice.
 */

export interface PaymentSession {
  readonly paymentId: string;
  readonly providerOrderId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly clientPayload: Readonly<Record<string, string | number>>;
}

/**
 * Creates or resumes the payment for a rental.
 *
 * If a payment already exists for this rental and has not failed, its provider
 * order is reused — a member who refreshes checkout must not create a second
 * charge.
 */
export async function beginPayment(input: {
  rentalId: string;
  userId: string;
}): Promise<PaymentSession> {
  const db = await getDb();

  const rental = await db.rental.findUnique({
    where: { id: input.rentalId },
    select: {
      id: true,
      reference: true,
      renterId: true,
      status: true,
      currency: true,
      totalMinor: true,
      fulfilment: true,
      deliveryAddressId: true,
      renter: { select: { id: true, email: true, name: true } },
      payments: {
        where: { status: { in: ["CREATED", "AUTHORIZED", "CAPTURED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!rental) throw errors.notFound("rental");
  // Ownership from the session, never from the request.
  if (rental.renterId !== input.userId) throw errors.forbidden("That rental isn't yours.");

  if (rental.status === RentalStatus.CANCELLED) {
    throw errors.conflict("This rental was cancelled. Start a new booking to try again.");
  }

  // The last point at which a missing address can still be fixed cheaply.
  // Taking payment for something with nowhere to send it would be worse.
  if (rental.fulfilment !== "PICKUP" && !rental.deliveryAddressId) {
    throw errors.validation("Add a delivery address before paying.", {
      deliveryAddressId: "Choose where this should be delivered.",
    });
  }

  const provider = await getPaymentProvider();
  const existing = rental.payments[0];

  if (existing) {
    if (existing.status === "CAPTURED") {
      throw errors.conflict("This rental has already been paid for.");
    }
    // Resume the existing order rather than opening another.
    const order = await provider.fetchOrder(existing.providerOrderId);
    if (order && order.status !== "failed") {
      return {
        paymentId: existing.id,
        providerOrderId: existing.providerOrderId,
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        clientPayload: order.clientPayload,
      };
    }
  }

  const order = await provider.createOrder({
    // The authoritative amount: what the server computed and stored.
    amountMinor: rental.totalMinor,
    currency: rental.currency,
    reference: rental.reference,
    // Stable per rental, so a retried request returns the same order.
    idempotencyKey: `rental:${rental.id}`,
    customer: {
      id: rental.renter.id,
      email: rental.renter.email,
      name: rental.renter.name,
    },
    metadata: { rentalId: rental.id },
  });

  const payment = await db.payment.upsert({
    where: {
      provider_providerOrderId: {
        provider: providerEnum(provider.id),
        providerOrderId: order.providerOrderId,
      },
    },
    create: {
      rentalId: rental.id,
      provider: providerEnum(provider.id),
      status: "CREATED",
      providerOrderId: order.providerOrderId,
      currency: rental.currency,
      amountMinor: rental.totalMinor,
    },
    update: {},
    select: { id: true },
  });

  return {
    paymentId: payment.id,
    providerOrderId: order.providerOrderId,
    amountMinor: rental.totalMinor,
    currency: rental.currency,
    clientPayload: order.clientPayload,
  };
}

/**
 * Confirms a payment against the provider and advances the booking.
 *
 * Called both from the browser after checkout and from the provider's webhook.
 * Whichever arrives first does the work; the second finds it already done.
 */
export async function settlePayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  /** Present when the caller is a member; absent for webhooks. */
  userId?: string;
}): Promise<{ status: "confirmed" | "failed"; rentalId: string; message?: string }> {
  const db = await getDb();
  const provider = await getPaymentProvider();

  const payment = await db.payment.findUnique({
    where: {
      provider_providerOrderId: {
        provider: providerEnum(provider.id),
        providerOrderId: input.providerOrderId,
      },
    },
    select: {
      id: true,
      status: true,
      amountMinor: true,
      currency: true,
      rentalId: true,
      rental: { select: { renterId: true, status: true } },
    },
  });

  if (!payment) throw errors.notFound("payment");
  if (input.userId && payment.rental.renterId !== input.userId) {
    throw errors.forbidden("That payment isn't yours.");
  }

  // Already settled — report the outcome rather than capturing again.
  if (payment.status === "CAPTURED") {
    return { status: "confirmed", rentalId: payment.rentalId };
  }

  let capture;
  try {
    capture = await provider.capture({
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      idempotencyKey: `capture:${payment.id}`,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureCode: error.code,
          failureMessage: error.message,
          failedAt: new Date(),
        },
      });
      throw errors.paymentFailed();
    }
    throw error;
  }

  if (capture.status === "failed") {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureCode: capture.failureCode,
        failureMessage: capture.failureMessage,
        failedAt: new Date(),
      },
    });
    return {
      status: "failed",
      rentalId: payment.rentalId,
      message: capture.failureMessage ?? "The payment was declined.",
    };
  }

  // Money is confirmed. Advance the booking atomically.
  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        providerPaymentId: capture.providerPaymentId,
        capturedMinor: capture.capturedMinor,
        capturedAt: new Date(),
        authorizedAt: new Date(),
      },
    });

    const bookings = await tx.rentalItem.findMany({
      where: { rentalId: payment.rentalId, status: BookingStatus.REQUESTED },
      select: { id: true, listing: { select: { instantBook: true } } },
    });

    for (const booking of bookings) {
      // Instant-book listings confirm on payment; the rest wait for the owner,
      // which is what the listing page promised the member.
      if (!booking.listing.instantBook) continue;

      await tx.rentalItem.update({
        where: { id: booking.id },
        data: { status: BookingStatus.ACCEPTED, acceptedAt: new Date() },
      });
      await tx.bookingTransition.create({
        data: {
          rentalItemId: booking.id,
          fromStatus: BookingStatus.REQUESTED,
          toStatus: BookingStatus.ACCEPTED,
          actorId: null,
          reason: "Confirmed automatically — this piece books instantly",
        },
      });
    }

    await tx.rental.update({
      where: { id: payment.rentalId },
      data: { status: RentalStatus.CONFIRMED },
    });
  });

  await notifyOwners(payment.rentalId);

  return { status: "confirmed", rentalId: payment.rentalId };
}

/** Tells each owner in the basket that they have a booking to act on. */
async function notifyOwners(rentalId: string): Promise<void> {
  const db = await getDb();

  const bookings = await db.rentalItem.findMany({
    where: { rentalId },
    select: {
      status: true,
      ownerId: true,
      listing: { select: { item: { select: { title: true } } } },
    },
  });

  await db.notification.createMany({
    data: bookings.map((booking) => ({
      userId: booking.ownerId,
      kind:
        booking.status === BookingStatus.ACCEPTED
          ? ("RENTAL_ACCEPTED" as const)
          : ("RENTAL_REQUESTED" as const),
      title:
        booking.status === BookingStatus.ACCEPTED
          ? `Your ${booking.listing.item.title.toLowerCase()} is booked`
          : `New request for your ${booking.listing.item.title.toLowerCase()}`,
      body:
        booking.status === BookingStatus.ACCEPTED
          ? "Payment has cleared. Get it ready for the dates agreed."
          : "Reply within 24 hours to keep your response rate up.",
      href: "/account/listings",
    })),
  });
}

/**
 * Releases a deposit after a clean return, or captures part of it against an
 * approved damage claim.
 */
export async function settleDeposit(input: {
  rentalId: string;
  captureMinor?: number;
  reason?: string;
}): Promise<void> {
  const db = await getDb();

  const deposit = await db.securityDeposit.findUnique({
    where: { rentalId: input.rentalId },
    select: { id: true, amountMinor: true, status: true },
  });

  if (!deposit || deposit.status !== "HELD") return;

  const capture = Math.max(0, Math.min(input.captureMinor ?? 0, deposit.amountMinor));
  const refund = deposit.amountMinor - capture;

  const payment = await db.payment.findFirst({
    where: { rentalId: input.rentalId, status: "CAPTURED" },
    select: { id: true, providerPaymentId: true },
  });

  await db.$transaction(async (tx) => {
    await tx.securityDeposit.update({
      where: { id: deposit.id },
      data: {
        capturedMinor: capture,
        status:
          capture === 0
            ? "RELEASED"
            : capture === deposit.amountMinor
              ? "CAPTURED"
              : "PARTIALLY_CAPTURED",
        releasedAt: new Date(),
        captureReason: input.reason,
      },
    });

    if (refund > 0 && payment) {
      await tx.refund.create({
        data: {
          rentalId: input.rentalId,
          paymentId: payment.id,
          amountMinor: refund,
          reason: "DEPOSIT_RELEASE",
          status: "PENDING",
          note: input.reason,
        },
      });
    }
  });

  // The provider call happens outside the transaction: a slow network must not
  // hold database locks, and the refund row is the durable record of intent.
  if (refund > 0 && payment?.providerPaymentId) {
    const provider = await getPaymentProvider();
    const result = await provider.refund({
      providerPaymentId: payment.providerPaymentId,
      amountMinor: refund,
      currency: "INR",
      reason: "Security deposit released",
      idempotencyKey: `deposit:${deposit.id}`,
    });

    await db.refund.updateMany({
      where: { rentalId: input.rentalId, reason: "DEPOSIT_RELEASE", status: "PENDING" },
      data: {
        status:
          result.status === "succeeded"
            ? "SUCCEEDED"
            : result.status === "failed"
              ? "FAILED"
              : "PROCESSING",
        providerRefundId: result.providerRefundId,
        processedAt: new Date(),
      },
    });
  }
}
