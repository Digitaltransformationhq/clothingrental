import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  type CaptureInput,
  type CaptureResult,
  type CreateOrderInput,
  PaymentError,
  type PaymentProvider,
  type PayoutInput,
  type PayoutResult,
  type ProviderOrder,
  type RefundInput,
  type RefundResult,
  type WebhookEvent,
  WebhookVerificationError,
} from "./provider";

/**
 * A deterministic in-process payment provider.
 *
 * This is not a stub that returns `{ ok: true }`. It implements the full port —
 * idempotency, capture limits, partial refunds that cannot exceed what was
 * captured, HMAC-signed webhooks — so that checkout, refunds and payouts can be
 * exercised end to end, in tests and in local development, without an account
 * with anybody.
 *
 * Its second job is to make failure reachable. Real providers fail, and code
 * that has only ever seen a success path handles that badly. Amounts ending in
 * the sentinel below always decline, which is what the failure-path tests and
 * the "your payment hasn't been charged" error state are built against.
 */

/** Any amount whose last two digits are 13 is declined. ₹100.13, ₹5,432.13 … */
const DECLINE_SENTINEL = 13;

const SANDBOX_SECRET = "almirah-sandbox-signing-key";

interface SandboxOrder {
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status: ProviderOrder["status"];
  capturedMinor: number;
  refundedMinor: number;
  reference: string;
}

/**
 * Module-level so state survives within a process, which is what makes
 * idempotency observable. A real provider keeps this in its own database; here
 * it is deliberately ephemeral, and nothing is persisted across a restart.
 */
const orders = new Map<string, SandboxOrder>();
const idempotency = new Map<string, string>();
const refunds = new Map<string, RefundResult>();
const payouts = new Map<string, PayoutResult>();

function shouldDecline(amountMinor: number): boolean {
  return amountMinor % 100 === DECLINE_SENTINEL;
}

function sign(payload: string): string {
  return createHmac("sha256", SANDBOX_SECRET).update(payload).digest("hex");
}

export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = "sandbox" as const;

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    if (input.amountMinor <= 0) {
      throw new PaymentError("An order must be for a positive amount.", {
        code: "invalid_amount",
      });
    }

    // Idempotency: the same key must never produce a second order.
    const existingId = idempotency.get(input.idempotencyKey);
    if (existingId) {
      const existing = orders.get(existingId);
      if (existing) return this.present(existing, input);
    }

    const order: SandboxOrder = {
      providerOrderId: `order_sbx_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "created",
      capturedMinor: 0,
      refundedMinor: 0,
      reference: input.reference,
    };

    orders.set(order.providerOrderId, order);
    idempotency.set(input.idempotencyKey, order.providerOrderId);

    return this.present(order, input);
  }

  async fetchOrder(providerOrderId: string): Promise<ProviderOrder | null> {
    const order = orders.get(providerOrderId);
    if (!order) return null;
    return {
      providerOrderId: order.providerOrderId,
      amountMinor: order.amountMinor,
      currency: order.currency,
      status: order.status,
      clientPayload: {},
    };
  }

  async capture(input: CaptureInput): Promise<CaptureResult> {
    const order = orders.get(input.providerOrderId);
    if (!order) {
      throw new PaymentError("No such order.", { code: "order_not_found" });
    }

    if (order.status === "captured") {
      // Replayed capture: report the original outcome rather than charging again.
      return {
        providerPaymentId: input.providerPaymentId,
        capturedMinor: order.capturedMinor,
        status: "captured",
      };
    }

    if (input.amountMinor > order.amountMinor) {
      throw new PaymentError("Cannot capture more than the order was created for.", {
        code: "capture_exceeds_order",
      });
    }

    if (shouldDecline(input.amountMinor)) {
      order.status = "failed";
      return {
        providerPaymentId: input.providerPaymentId,
        capturedMinor: 0,
        status: "failed",
        failureCode: "card_declined",
        failureMessage: "The card was declined by the issuing bank.",
      };
    }

    order.status = "captured";
    order.capturedMinor = input.amountMinor;

    return {
      providerPaymentId: input.providerPaymentId,
      capturedMinor: input.amountMinor,
      status: "captured",
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const existing = refunds.get(input.idempotencyKey);
    if (existing) return existing;

    const order = [...orders.values()].find(
      (candidate) => candidate.status === "captured" && candidate.capturedMinor > 0,
    );

    if (order && input.amountMinor > order.capturedMinor - order.refundedMinor) {
      throw new PaymentError("A refund cannot exceed what remains captured.", {
        code: "refund_exceeds_capture",
      });
    }

    if (order) order.refundedMinor += input.amountMinor;

    const result: RefundResult = {
      providerRefundId: `rfnd_sbx_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
      amountMinor: input.amountMinor,
      status: "succeeded",
    };

    refunds.set(input.idempotencyKey, result);
    return result;
  }

  async payout(input: PayoutInput): Promise<PayoutResult> {
    const existing = payouts.get(input.idempotencyKey);
    if (existing) return existing;

    const result: PayoutResult = shouldDecline(input.amountMinor)
      ? {
          providerPayoutId: `pout_sbx_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
          status: "failed",
          failureMessage: "The beneficiary account could not be credited.",
        }
      : {
          providerPayoutId: `pout_sbx_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
          status: "paid",
        };

    payouts.set(input.idempotencyKey, result);
    return result;
  }

  async verifyWebhook(input: {
    rawBody: string;
    headers: Readonly<Record<string, string | undefined>>;
  }): Promise<WebhookEvent> {
    const provided = input.headers["x-almirah-signature"];
    if (!provided) {
      throw new WebhookVerificationError("The webhook carried no signature header.");
    }

    const expected = sign(input.rawBody);
    const providedBuffer = Buffer.from(provided, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    // Constant-time comparison: a fast-failing string compare leaks the
    // signature one byte at a time.
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new WebhookVerificationError();
    }

    const payload = JSON.parse(input.rawBody) as Record<string, unknown>;

    return {
      id: String(payload.id ?? randomUUID()),
      kind: (payload.kind as WebhookEvent["kind"]) ?? "unknown",
      providerOrderId: payload.providerOrderId as string | undefined,
      providerPaymentId: payload.providerPaymentId as string | undefined,
      providerRefundId: payload.providerRefundId as string | undefined,
      providerPayoutId: payload.providerPayoutId as string | undefined,
      amountMinor: payload.amountMinor as number | undefined,
      currency: payload.currency as string | undefined,
      signature: provided,
      receivedAt: new Date(),
    };
  }

  /** Signs a payload as the provider would, for tests and local webhook replay. */
  static signPayload(rawBody: string): string {
    return sign(rawBody);
  }

  /** Clears all state. Test-only. */
  static reset(): void {
    orders.clear();
    idempotency.clear();
    refunds.clear();
    payouts.clear();
  }

  private present(order: SandboxOrder, input: CreateOrderInput): ProviderOrder {
    return {
      providerOrderId: order.providerOrderId,
      amountMinor: order.amountMinor,
      currency: order.currency,
      status: order.status,
      clientPayload: {
        provider: "sandbox",
        orderId: order.providerOrderId,
        amount: order.amountMinor,
        currency: order.currency,
        name: input.customer.name,
        email: input.customer.email,
      },
    };
  }
}
