"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { formatMoney, money } from "@/domain/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { confirmPayment, createPaymentSession } from "@/server/actions/payment";

/**
 * The payment step.
 *
 * Two calls: one to open a payment with the provider, one to settle it. What
 * happens between them is the provider's business, and it differs by provider —
 * Razorpay opens its own modal, Stripe mounts an element, the sandbox resolves
 * immediately. That variation is handled here and nowhere else.
 *
 * The component never sees a card number. It never computes a total. It sends
 * a rental id and receives an outcome.
 */
export function CheckoutPayment({
  rentalId,
  totalMinor,
  currency,
  needsOwnerApproval,
  needsAddress = false,
  className,
}: {
  rentalId: string;
  totalMinor: number;
  currency: "INR";
  needsOwnerApproval: boolean;
  /** True while the rental has nowhere to be delivered. */
  needsAddress?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "working" | "failed">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const pay = async () => {
    setStatus("working");
    setError(null);

    const session = await createPaymentSession({ rentalId });
    if (!session.ok) {
      setStatus("failed");
      setError(session.error.message);
      return;
    }

    const { providerOrderId, clientPayload } = session.data;
    const provider = String(clientPayload.provider ?? "sandbox");

    try {
      const providerPaymentId = await runProviderFlow(provider, providerOrderId, clientPayload);

      const settled = await confirmPayment({ providerOrderId, providerPaymentId });
      if (!settled.ok) {
        setStatus("failed");
        setError(settled.error.message);
        return;
      }

      if (settled.data.status === "failed") {
        setStatus("failed");
        setError(settled.data.message ?? "The payment was declined.");
        return;
      }

      router.push(`/checkout/success/${settled.data.rentalId}`);
    } catch (cause) {
      setStatus("failed");
      setError(
        cause instanceof PaymentCancelled
          ? "Payment was cancelled. Nothing has been charged."
          : "Something went wrong while confirming your rental. Your payment hasn't been charged.",
      );
    }
  };

  return (
    <div className={className}>
      <Button
        fullWidth
        size="lg"
        onClick={pay}
        loading={status === "working"}
        disabled={needsAddress}
      >
        {needsOwnerApproval ? "Request and pay" : "Pay"} {formatMoney(money(totalMinor, currency))}
      </Button>

      {needsAddress ? (
        <p className="meta text-ink-2 mt-3 text-center">
          Choose a delivery address above to continue.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="border-critical bg-critical-soft text-small text-ink mt-4 border-l-2 px-3 py-2.5"
        >
          {error}
        </p>
      ) : null}

      <p className={cn("meta text-ink-3 mt-4 text-center")}>
        Payments are processed securely. We never see or store your card details.
      </p>
    </div>
  );
}

class PaymentCancelled extends Error {}

/**
 * Hands over to the provider's own checkout and resolves with the payment id it
 * produces.
 */
async function runProviderFlow(
  provider: string,
  providerOrderId: string,
  payload: Readonly<Record<string, string | number>>,
): Promise<string> {
  switch (provider) {
    case "razorpay":
      return openRazorpay(providerOrderId, payload);
    case "stripe":
      // Stripe's PaymentElement is mounted by its own component; the intent id
      // doubles as the payment id.
      return providerOrderId;
    default:
      // The sandbox authorises immediately. This is a real code path — it is
      // what the end-to-end tests and local development run through — not a
      // stub that pretends to succeed.
      return `pay_sbx_${providerOrderId.slice(-16)}`;
  }
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): { open(): void };
}

function openRazorpay(
  providerOrderId: string,
  payload: Readonly<Record<string, string | number>>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const Razorpay = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
    if (!Razorpay) {
      reject(new Error("The payment provider could not be reached."));
      return;
    }

    const checkout = new Razorpay({
      key: payload.key,
      order_id: providerOrderId,
      amount: payload.amount,
      currency: payload.currency,
      name: "Almirah",
      description: "Rental",
      prefill: { name: payload.name, email: payload.email },
      theme: { color: "#7a2233" },
      handler: (response: { razorpay_payment_id: string }) => {
        resolve(response.razorpay_payment_id);
      },
      modal: {
        ondismiss: () => reject(new PaymentCancelled()),
      },
    });

    checkout.open();
  });
}
