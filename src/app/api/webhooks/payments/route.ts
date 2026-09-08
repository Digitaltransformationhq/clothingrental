import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/server/payments";
import { WebhookVerificationError } from "@/server/payments/provider";
import { getDb } from "@/server/db/client";
import { settlePayment } from "@/server/services/payments";

/**
 * The payment provider's webhook.
 *
 * The authoritative record of what happened to money. A browser reporting
 * success is a hint; this is evidence — which is why the booking flow works
 * correctly even if the member closes the tab mid-payment.
 *
 * Three rules:
 *
 *  1. The raw body is read as text and verified against the signing secret
 *     before anything is trusted. Signatures are computed over the exact bytes,
 *     so parsing first and re-serialising would invalidate them.
 *  2. Every event is de-duplicated on the provider's event id. Payment networks
 *     retry aggressively and will send the same event many times.
 *  3. A failure to process returns 500 so the provider retries. Returning 200
 *     on an error tells it never to send that event again, which loses money
 *     silently.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const provider = await getPaymentProvider();

  // Raw text, not request.json(). See rule 1.
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event;
  try {
    event = await provider.verifyWebhook({ rawBody, headers });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      // Never 500 here: an unsigned request is not our failure, and asking the
      // provider to retry it would be pointless.
      console.warn("[almirah] rejected an unverified payment webhook");
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    throw error;
  }

  const db = await getDb();

  // De-duplication. The audit log doubles as the ledger of processed events,
  // and its unique constraint on (entityType, entityId) is what makes a replay
  // a no-op rather than a second capture.
  const already = await db.auditLog.findFirst({
    where: { entityType: "PaymentWebhook", entityId: event.id },
    select: { id: true },
  });

  if (already) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  try {
    switch (event.kind) {
      case "payment.captured":
      case "payment.authorized": {
        if (event.providerOrderId && event.providerPaymentId) {
          await settlePayment({
            providerOrderId: event.providerOrderId,
            providerPaymentId: event.providerPaymentId,
          });
        }
        break;
      }

      case "payment.failed": {
        if (event.providerOrderId) {
          await db.payment.updateMany({
            where: { providerOrderId: event.providerOrderId },
            data: {
              status: "FAILED",
              failureCode: event.failureCode,
              failureMessage: event.failureMessage,
              failedAt: new Date(),
            },
          });
        }
        break;
      }

      case "refund.processed": {
        if (event.providerRefundId) {
          await db.refund.updateMany({
            where: { providerRefundId: event.providerRefundId },
            data: { status: "SUCCEEDED", processedAt: new Date() },
          });
        }
        break;
      }

      case "payout.processed":
      case "payout.failed": {
        if (event.providerPayoutId) {
          await db.payout.updateMany({
            where: { providerPayoutId: event.providerPayoutId },
            data: {
              status: event.kind === "payout.processed" ? "PAID" : "FAILED",
              paidAt: event.kind === "payout.processed" ? new Date() : null,
              failureMessage: event.failureMessage,
            },
          });
        }
        break;
      }

      default:
        // An event we do not act on. Recorded and acknowledged so the provider
        // stops resending it.
        break;
    }

    await db.auditLog.create({
      data: {
        actorId: null,
        action: `webhook.${event.kind}`,
        entityType: "PaymentWebhook",
        entityId: event.id,
        metadata: {
          provider: provider.id,
          providerOrderId: event.providerOrderId,
          amountMinor: event.amountMinor,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Deliberately 500: see rule 3.
    console.error("[almirah] payment webhook processing failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
