import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Forgotten password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <Eyebrow className="mb-4">It happens</Eyebrow>
      <h1 className="display-3 mb-4">Forgotten your password?</h1>
      <p className="text-body text-ink-2 mb-8">
        Tell us your email and we&apos;ll send a link to choose a new one.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
