import "server-only";

/**
 * The payment port.
 *
 * Everything above this interface — checkout, refunds, deposits, payouts —
 * speaks only in these terms. No route handler, server action or component
 * imports a provider SDK, constructs a provider payload, or branches on which
 * provider is configured. Swapping Razorpay for Stripe is implementing this
 * interface once.
 *
 * Three rules the port exists to enforce:
 *
 *  1. Amounts crossing this boundary are always integers in minor units,
 *     always accompanied by a currency, and always computed server-side.
 *  2. A webhook is untrusted input until `verifyWebhook` has authenticated it
 *     against the provider's signing secret.
 *  3. Every operation is idempotent on a key the caller controls, because
 *     payment networks retry and a retried capture must not charge twice.
 */

export type PaymentProviderId = "razorpay" | "stripe" | "sandbox";

export interface MoneyAmount {
  readonly amountMinor: number;
  readonly currency: string;
}

// ── Orders ──────────────────────────────────────────────────────────────────

export interface CreateOrderInput extends MoneyAmount {
  /** Our own rental reference. Sent to the provider for reconciliation. */
  readonly reference: string;
  /**
   * Caller-controlled idempotency key. Submitting the same key twice must
   * return the original order rather than creating a second one.
   */
  readonly idempotencyKey: string;
  readonly customer: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  };
  /** Non-sensitive context echoed back on the webhook. */
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ProviderOrder {
  readonly providerOrderId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: "created" | "authorized" | "captured" | "failed";
  /**
   * Everything the browser needs to open the provider's checkout. Deliberately
   * opaque to our code and containing only publishable values — never a secret.
   */
  readonly clientPayload: Readonly<Record<string, string | number>>;
}

// ── Capture and refund ──────────────────────────────────────────────────────

export interface CaptureInput {
  readonly providerOrderId: string;
  readonly providerPaymentId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly idempotencyKey: string;
}

export interface CaptureResult {
  readonly providerPaymentId: string;
  readonly capturedMinor: number;
  readonly status: "captured" | "failed";
  readonly failureCode?: string;
  readonly failureMessage?: string;
}

export interface RefundInput {
  readonly providerPaymentId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface RefundResult {
  readonly providerRefundId: string;
  readonly amountMinor: number;
  readonly status: "pending" | "succeeded" | "failed";
  readonly failureMessage?: string;
}

// ── Payouts ─────────────────────────────────────────────────────────────────

export interface PayoutInput {
  readonly reference: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly beneficiary: {
    readonly userId: string;
    readonly name: string;
    /** Provider-held beneficiary handle. Never raw banking details. */
    readonly providerAccountId?: string;
    readonly upiHandle?: string;
  };
  readonly idempotencyKey: string;
}

export interface PayoutResult {
  readonly providerPayoutId: string;
  readonly status: "scheduled" | "processing" | "paid" | "failed";
  readonly failureMessage?: string;
}

// ── Webhooks ────────────────────────────────────────────────────────────────

export type WebhookEventKind =
  | "payment.authorized"
  | "payment.captured"
  | "payment.failed"
  | "refund.processed"
  | "refund.failed"
  | "payout.processed"
  | "payout.failed"
  | "unknown";

export interface WebhookEvent {
  /** Provider's event id, used to reject replays. */
  readonly id: string;
  readonly kind: WebhookEventKind;
  readonly providerOrderId?: string;
  readonly providerPaymentId?: string;
  readonly providerRefundId?: string;
  readonly providerPayoutId?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly signature: string;
  readonly receivedAt: Date;
}

export class PaymentError extends Error {
  readonly code: string;
  /** Whether retrying the same request could plausibly succeed. */
  readonly retryable: boolean;

  constructor(message: string, options: { code: string; retryable?: boolean; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "PaymentError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

export class WebhookVerificationError extends Error {
  constructor(message = "The webhook signature could not be verified.") {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/**
 * The contract every payment provider implements.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;

  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;

  /**
   * Confirms with the provider what was actually paid.
   *
   * This is the method that makes client-reported success untrustworthy by
   * design: the browser saying "payment complete" is only ever a hint, and a
   * booking is confirmed against this call or against a webhook, never against
   * a redirect.
   */
  fetchOrder(providerOrderId: string): Promise<ProviderOrder | null>;

  capture(input: CaptureInput): Promise<CaptureResult>;

  refund(input: RefundInput): Promise<RefundResult>;

  payout(input: PayoutInput): Promise<PayoutResult>;

  /**
   * Authenticates a raw webhook body against the signing secret and parses it.
   *
   * Takes the raw bytes rather than a parsed object, because signatures are
   * computed over the exact payload and JSON round-tripping changes it.
   * Throws `WebhookVerificationError` if the signature does not match.
   */
  verifyWebhook(input: {
    rawBody: string;
    headers: Readonly<Record<string, string | undefined>>;
  }): Promise<WebhookEvent>;
}
