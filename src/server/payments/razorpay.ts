import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

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
  type WebhookEventKind,
  WebhookVerificationError,
} from "./provider";

/**
 * Razorpay.
 *
 * Implemented against the REST API directly rather than through the SDK: the
 * surface we need is four endpoints, and a first-party dependency that ships
 * its own HTTP client and Node built-ins is a poor trade for that.
 *
 * Razorpay works in paise natively, which matches how this codebase stores
 * money end to end — there is no conversion anywhere in this file, and that is
 * deliberate.
 */

const API_BASE = "https://api.razorpay.com/v1";

interface RazorpayConfig {
  readonly keyId: string;
  readonly keySecret: string;
  readonly webhookSecret: string;
}

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: "created" | "attempted" | "paid";
  receipt?: string;
}

interface RazorpayPaymentResponse {
  id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  error_code?: string;
  error_description?: string;
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly id = "razorpay" as const;

  private readonly config: RazorpayConfig;

  constructor(config: RazorpayConfig) {
    this.config = config;
  }

  // ── HTTP ──────────────────────────────────────────────────────────────────

  private authorizationHeader(): string {
    const token = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64");
    return `Basic ${token}`;
  }

  private async request<T>(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.authorizationHeader(),
      "Content-Type": "application/json",
    };

    // Razorpay honours this header on write endpoints, which is what makes a
    // retried capture safe.
    if (init.idempotencyKey) headers["X-Razorpay-Idempotency-Key"] = init.idempotencyKey;

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: init.method,
        headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
        // A payment call that hangs must not hold a request open indefinitely.
        signal: AbortSignal.timeout(20_000),
      });
    } catch (cause) {
      throw new PaymentError("Could not reach the payment provider.", {
        code: "network_error",
        retryable: true,
        cause,
      });
    }

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (!response.ok) {
      const error = (payload.error ?? {}) as { code?: string; description?: string };
      throw new PaymentError(error.description ?? "The payment provider rejected the request.", {
        code: error.code ?? `http_${response.status}`,
        // 5xx and rate limits are worth retrying; a rejected card is not.
        retryable: response.status >= 500 || response.status === 429,
      });
    }

    return payload as T;
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const order = await this.request<RazorpayOrderResponse>("/orders", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.reference,
        // Razorpay's own two-step flow. We authorise first and capture once the
        // booking has been written, so a database failure cannot leave a member
        // charged for a rental that does not exist.
        payment_capture: false,
        notes: {
          reference: input.reference,
          userId: input.customer.id,
          ...input.metadata,
        },
      },
    });

    return {
      providerOrderId: order.id,
      amountMinor: order.amount,
      currency: order.currency,
      status: order.status === "paid" ? "captured" : "created",
      clientPayload: {
        provider: "razorpay",
        // Publishable key only. The secret never leaves the server.
        key: this.config.keyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: input.customer.name,
        email: input.customer.email,
      },
    };
  }

  async fetchOrder(providerOrderId: string): Promise<ProviderOrder | null> {
    try {
      const order = await this.request<RazorpayOrderResponse>(`/orders/${providerOrderId}`, {
        method: "GET",
      });
      return {
        providerOrderId: order.id,
        amountMinor: order.amount,
        currency: order.currency,
        status: order.status === "paid" ? "captured" : "created",
        clientPayload: {},
      };
    } catch (error) {
      if (error instanceof PaymentError && error.code === "http_400") return null;
      throw error;
    }
  }

  async capture(input: CaptureInput): Promise<CaptureResult> {
    try {
      const payment = await this.request<RazorpayPaymentResponse>(
        `/payments/${input.providerPaymentId}/capture`,
        {
          method: "POST",
          idempotencyKey: input.idempotencyKey,
          body: { amount: input.amountMinor, currency: input.currency },
        },
      );

      return {
        providerPaymentId: payment.id,
        capturedMinor: payment.amount,
        status: payment.status === "captured" ? "captured" : "failed",
        failureCode: payment.error_code,
        failureMessage: payment.error_description,
      };
    } catch (error) {
      if (error instanceof PaymentError && !error.retryable) {
        return {
          providerPaymentId: input.providerPaymentId,
          capturedMinor: 0,
          status: "failed",
          failureCode: error.code,
          failureMessage: error.message,
        };
      }
      throw error;
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await this.request<{ id: string; amount: number; status: string }>(
      `/payments/${input.providerPaymentId}/refund`,
      {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body: {
          amount: input.amountMinor,
          speed: "normal",
          notes: { reason: input.reason },
        },
      },
    );

    return {
      providerRefundId: refund.id,
      amountMinor: refund.amount,
      status:
        refund.status === "processed"
          ? "succeeded"
          : refund.status === "failed"
            ? "failed"
            : "pending",
    };
  }

  async payout(input: PayoutInput): Promise<PayoutResult> {
    // RazorpayX payouts require a fund account created for the beneficiary.
    // Without one there is nothing to credit, and failing here is far better
    // than reporting a payout that never happened.
    if (!input.beneficiary.providerAccountId) {
      throw new PaymentError("This member has no verified payout account with the provider yet.", {
        code: "beneficiary_missing",
      });
    }

    const payout = await this.request<{ id: string; status: string; failure_reason?: string }>(
      "/payouts",
      {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body: {
          fund_account_id: input.beneficiary.providerAccountId,
          amount: input.amountMinor,
          currency: input.currency,
          mode: input.beneficiary.upiHandle ? "UPI" : "IMPS",
          purpose: "payout",
          reference_id: input.reference,
          narration: "Almirah earnings",
        },
      },
    );

    const status =
      payout.status === "processed"
        ? "paid"
        : payout.status === "failed" || payout.status === "reversed"
          ? "failed"
          : payout.status === "queued"
            ? "scheduled"
            : "processing";

    return {
      providerPayoutId: payout.id,
      status,
      failureMessage: payout.failure_reason,
    };
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  /**
   * Razorpay signs the raw request body with HMAC-SHA256 under the webhook
   * secret. Verification happens before the body is trusted for anything —
   * an unverified webhook is an anonymous internet user claiming a payment
   * succeeded.
   */
  async verifyWebhook(input: {
    rawBody: string;
    headers: Readonly<Record<string, string | undefined>>;
  }): Promise<WebhookEvent> {
    const signature = input.headers["x-razorpay-signature"];
    if (!signature) {
      throw new WebhookVerificationError("The webhook carried no signature header.");
    }

    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(input.rawBody)
      .digest("hex");

    const provided = Buffer.from(signature, "utf8");
    const computed = Buffer.from(expected, "utf8");

    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      throw new WebhookVerificationError();
    }

    const body = JSON.parse(input.rawBody) as {
      event?: string;
      payload?: {
        payment?: { entity?: RazorpayPaymentResponse & { order_id?: string } };
        refund?: { entity?: { id?: string; amount?: number; payment_id?: string } };
        payout?: { entity?: { id?: string; failure_reason?: string } };
      };
    };

    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    const payoutEntity = body.payload?.payout?.entity;

    const kindByEvent: Record<string, WebhookEventKind> = {
      "payment.authorized": "payment.authorized",
      "payment.captured": "payment.captured",
      "payment.failed": "payment.failed",
      "refund.processed": "refund.processed",
      "refund.failed": "refund.failed",
      "payout.processed": "payout.processed",
      "payout.failed": "payout.failed",
    };

    return {
      // Razorpay does not send a dedicated event id on every webhook, so the
      // entity id plus event name is what the receiver de-duplicates on.
      id: `${body.event ?? "unknown"}:${payment?.id ?? refund?.id ?? payoutEntity?.id ?? signature.slice(0, 16)}`,
      kind: kindByEvent[body.event ?? ""] ?? "unknown",
      providerOrderId: payment?.order_id,
      providerPaymentId: payment?.id ?? refund?.payment_id,
      providerRefundId: refund?.id,
      providerPayoutId: payoutEntity?.id,
      amountMinor: payment?.amount ?? refund?.amount,
      currency: payment?.currency,
      failureCode: payment?.error_code,
      failureMessage: payment?.error_description ?? payoutEntity?.failure_reason,
      signature,
      receivedAt: new Date(),
    };
  }
}
