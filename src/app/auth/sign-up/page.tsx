import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <>
      <Eyebrow className="mb-4">Join Almirah</Eyebrow>
      <h1 className="display-3 mb-8">Create an account</h1>
      <Suspense fallback={null}>
        <AuthForm mode="sign-up" />
      </Suspense>
    </>
  );
}
