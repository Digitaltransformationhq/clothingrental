import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Choose a new password",
  // The token is in the URL; never let it leave as a Referer.
  referrer: "no-referrer",
};

type SearchParams = Promise<{ token?: string | string[]; error?: string | string[] }>;

/**
 * Where the emailed link lands. better-auth checks the token first, then
 * redirects here with `?token=…` if it is valid or `?error=INVALID_TOKEN` if not.
 */
export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && token.length > 0 && !error ? token : null;

  return (
    <>
      <Eyebrow className="mb-4">Almost there</Eyebrow>
      <h1 className="display-3 mb-8">Choose a new password</h1>
      <ResetPasswordForm token={valid} />
    </>
  );
}
