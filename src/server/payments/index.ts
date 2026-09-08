import "server-only";

import { env } from "@/env";
import type { PaymentProvider } from "./provider";

/**
 * Provider selection.
 *
 * The one place in the application that knows which payment provider is
 * configured. Everything else depends on the `PaymentProvider` interface, so
 * changing provider is a change to this file and an environment variable.
 */

let cached: PaymentProvider | undefined;

export async function getPaymentProvider(): Promise<PaymentProvider> {
  if (cached) return cached;

  switch (env.PAYMENT_PROVIDER) {
    case "razorpay": {
      const { RazorpayPaymentProvider } = await import("./razorpay");
      cached = new RazorpayPaymentProvider({
        keyId: env.RAZORPAY_KEY_ID as string,
        keySecret: env.RAZORPAY_KEY_SECRET as string,
        webhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? "",
      });
      break;
    }
    case "stripe": {
      const { StripePaymentProvider } = await import("./stripe");
      cached = new StripePaymentProvider({
        secretKey: env.STRIPE_SECRET_KEY as string,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
      });
      break;
    }
    default: {
      const { SandboxPaymentProvider } = await import("./sandbox");
      cached = new SandboxPaymentProvider();
    }
  }

  return cached;
}

/** Maps our provider id onto the database enum. */
export function providerEnum(id: string): "RAZORPAY" | "STRIPE" | "SANDBOX" {
  switch (id) {
    case "razorpay":
      return "RAZORPAY";
    case "stripe":
      return "STRIPE";
    default:
      return "SANDBOX";
  }
}

/** Test seam. */
export function __setPaymentProvider(provider: PaymentProvider | undefined): void {
  cached = provider;
}

export type { PaymentProvider } from "./provider";
