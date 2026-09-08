import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <Eyebrow className="mb-4">Welcome back</Eyebrow>
      <h1 className="display-3 mb-8">Sign in</h1>
      <Suspense fallback={null}>
        <AuthForm mode="sign-in" />
      </Suspense>
    </>
  );
}
