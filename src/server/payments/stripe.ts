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
 * Stripe.
 *
 * Included to demonstrate that the payment port is genuinely provider-agnostic
 * rather than a Razorpay interface with a different name. Nothing above
 * `PaymentProvider` changes to run on this instead.
 *
 * Implemented against the REST API with form encoding, which is what Stripe
 * accepts, and using PaymentIntents with manual capture — the same
 * authorise-then-capture shape the booking flow needs, so a database failure
 * cannot leave a member charged for a rental that was never written.
 */

const API_BASE = "https://api.stripe.com/v1";

interface StripeConfig {
  readonly secretKey: string;
  readonly webhookSecret: string;
}

interface StripePaymentIntent {
  id: string;
  amount: number;
  amount_received?: number;
  currency: string;
  status:
    | "requires_payment_method"
    | "requires_confirmation"
    | "requires_capture"
    | "processing"
    | "succeeded"
    | "canceled";
  client_secret?: string;
  last_payment_error?: { code?: string; message?: string };
}

export class StripePaymentProvider implements PaymentProvider {
  readonly id = "stripe" as const;

  constructor(private readonly config: StripeConfig) {}

  /** Stripe takes `application/x-www-form-urlencoded`, including for nesting. */
  private encode(payload: Record<string, string | number | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) params.append(key, String(value));
    }
    return params.toString();
  }

  private async request<T>(
    path: string,
    init: {
      method: "GET" | "POST";
      body?: Record<string, string | number | undefined>;
      idempotencyKey?: string;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: init.method,
        headers,
        body: init.body ? this.encode(init.body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (cause) {
      throw new PaymentError("Could not reach the payment provider.", {
        code: "network_error",
        retryable: true,
        cause,
      });
    }

    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const error = (payload.error ?? {}) as { code?: string; message?: string; type?: string };
      throw new PaymentError(error.message ?? "The payment provider rejected the request.", {
        code: error.code ?? error.type ?? `http_${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      });
    }

    return payload as T;
  }

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const intent = await this.request<StripePaymentIntent>("/payment_intents", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: input.amountMinor,
        currency: input.currency.toLowerCase(),
        // Authorise now, capture once the booking is written.
        capture_method: "manual",
        "automatic_payment_methods[enabled]": "true",
        receipt_email: input.customer.email,
        description: `Almirah rental ${input.reference}`,
        "metadata[reference]": input.reference,
        "metadata[userId]": input.customer.id,
      },
    });

    return {
      providerOrderId: intent.id,
      amountMinor: intent.amount,
      currency: intent.currency.toUpperCase(),
      status: mapIntentStatus(intent.status),
      clientPayload: {
        provider: "stripe",
        // A client secret is scoped to this one intent and is safe in the
        // browser; the secret key never leaves the server.
        clientSecret: intent.client_secret ?? "",
        amount: intent.amount,
        currency: intent.currency.toUpperCase(),
      },
    };
  }

  async fetchOrder(providerOrderId: string): Promise<ProviderOrder | null> {
    try {
      const intent = await this.request<StripePaymentIntent>(
        `/payment_intents/${providerOrderId}`,
        {
          method: "GET",
        },
      );
      return {
        providerOrderId: intent.id,
        amountMinor: intent.amount,
        currency: intent.currency.toUpperCase(),
        status: mapIntentStatus(intent.status),
        clientPayload: {},
      };
    } catch (error) {
      if (error instanceof PaymentError && error.code.startsWith("http_4")) return null;
      throw error;
    }
  }

  async capture(input: CaptureInput): Promise<CaptureResult> {
    try {
      const intent = await this.request<StripePaymentIntent>(
        `/payment_intents/${input.providerOrderId}/capture`,
        {
          method: "POST",
          idempotencyKey: input.idempotencyKey,
          body: { amount_to_capture: input.amountMinor },
        },
      );

      return {
        providerPaymentId: intent.id,
        capturedMinor: intent.amount_received ?? intent.amount,
        status: intent.status === "succeeded" ? "captured" : "failed",
        failureCode: intent.last_payment_error?.code,
        failureMessage: intent.last_payment_error?.message,
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
    const refund = await this.request<{ id: string; amount: number; status: string }>("/refunds", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        payment_intent: input.providerPaymentId,
        amount: input.amountMinor,
        "metadata[reason]": input.reason,
      },
    });

    return {
      providerRefundId: refund.id,
      amountMinor: refund.amount,
      status:
        refund.status === "succeeded"
          ? "succeeded"
          : refund.status === "failed"
            ? "failed"
            : "pending",
    };
  }

  async payout(input: PayoutInput): Promise<PayoutResult> {
    if (!input.beneficiary.providerAccountId) {
      throw new PaymentError("This member has no connected account with the provider yet.", {
        code: "beneficiary_missing",
      });
    }

    const transfer = await this.request<{ id: string }>("/transfers", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: input.amountMinor,
        currency: input.currency.toLowerCase(),
        destination: input.beneficiary.providerAccountId,
        transfer_group: input.reference,
      },
    });

    return { providerPayoutId: transfer.id, status: "paid" };
  }

  /**
   * Stripe signs with a timestamped scheme: `t=<ts>,v1=<sig>`, where the
   * signature covers `<ts>.<rawBody>`. The timestamp is checked as well as the
   * signature, because a valid signature replayed a week later is still a
   * replay.
   */
  async verifyWebhook(input: {
    rawBody: string;
    headers: Readonly<Record<string, string | undefined>>;
  }): Promise<WebhookEvent> {
    const header = input.headers["stripe-signature"];
    if (!header) throw new WebhookVerificationError("The webhook carried no signature header.");

    const parts = Object.fromEntries(
      header.split(",").map((piece) => piece.split("=") as [string, string]),
    );
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) throw new WebhookVerificationError("Malformed signature header.");

    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
      throw new WebhookVerificationError("The webhook timestamp is outside the accepted window.");
    }

    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(`${timestamp}.${input.rawBody}`)
      .digest("hex");

    const provided = Buffer.from(signature, "utf8");
    const computed = Buffer.from(expected, "utf8");
    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      throw new WebhookVerificationError();
    }

    const body = JSON.parse(input.rawBody) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    const object = body.data?.object ?? {};

    const kindByType: Record<string, WebhookEventKind> = {
      "payment_intent.amount_capturable_updated": "payment.authorized",
      "payment_intent.succeeded": "payment.captured",
      "payment_intent.payment_failed": "payment.failed",
      "charge.refunded": "refund.processed",
      "transfer.created": "payout.processed",
      "transfer.failed": "payout.failed",
    };

    return {
      id: body.id ?? signature.slice(0, 24),
      kind: kindByType[body.type ?? ""] ?? "unknown",
      providerOrderId: object.id as string | undefined,
      providerPaymentId: object.id as string | undefined,
      amountMinor: object.amount as number | undefined,
      currency: (object.currency as string | undefined)?.toUpperCase(),
      signature,
      receivedAt: new Date(),
    };
  }
}

function mapIntentStatus(status: StripePaymentIntent["status"]): ProviderOrder["status"] {
  switch (status) {
    case "requires_capture":
      return "authorized";
    case "succeeded":
      return "captured";
    case "canceled":
      return "failed";
    default:
      return "created";
  }
}
