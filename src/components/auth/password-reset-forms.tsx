"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "./auth-form";

/**
 * The two halves of a forgotten password: asking for a link, and using it.
 *
 * The request form always ends on the same confirmation, whether or not the
 * address belongs to an account — the same reason sign-in never says which
 * of the two fields was wrong.
 */

export function ForgotPasswordForm() {
  const [pending, setPending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | undefined>();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldError(undefined);

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email.includes("@")) {
      setFieldError("That doesn't look like an email address.");
      return;
    }

    setPending(true);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "/auth/reset-password",
    });
    setPending(false);

    if (result.error) {
      setError(
        result.error.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : "We couldn't send that just now. Try again in a moment.",
      );
      return;
    }
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <div>
        <p className="text-body text-ink-2">
          If there&apos;s an account for <span className="text-ink">{sentTo}</span>, a link to
          choose a new password is on its way. It works once and expires in an hour.
        </p>
        <p className="meta text-ink-3 mt-4">
          Nothing after a few minutes? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="link-underline text-ink-2"
          >
            try another address
          </button>
          .
        </p>
        <BackToSignIn />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Alert message={error} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={fieldError}
        hint="The address you signed up with."
      />
      <Button type="submit" fullWidth size="lg" loading={pending} className="mt-8">
        Send reset link
      </Button>
      <BackToSignIn />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // No token means the link was expired, already used, or mangled on the way
  // — better-auth redirects here with `?error=INVALID_TOKEN` in all three cases.
  if (!token) {
    return (
      <div>
        <p className="text-body text-ink-2">
          That link has expired or has already been used. Reset links work once, for an hour.
        </p>
        <ButtonLink href="/auth/forgot-password" fullWidth size="lg" className="mt-8">
          Send a new link
        </ButtonLink>
        <BackToSignIn />
      </div>
    );
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    const problems: Record<string, string> = {};
    if (password.length < 10) {
      problems.password = "Ten characters or more, please — a short phrase works well.";
    } else if (password.length > 128) {
      problems.password = "That's longer than we can store. Keep it under 128 characters.";
    }
    if (!problems.password && confirm !== password) problems.confirm = "These don't match.";
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      return;
    }

    setPending(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) {
      setPending(false);
      setError(
        result.error.code === "INVALID_TOKEN"
          ? "That link has expired or has already been used. Ask for a new one."
          : "We couldn't change your password. Try again in a moment.",
      );
      return;
    }

    router.push("/auth/sign-in?reset=1");
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Alert message={error} />
      <div className="space-y-5">
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password}
          hint="At least ten characters."
        />
        <Field
          label="Type it again"
          name="confirm"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />
      </div>
      <Button type="submit" fullWidth size="lg" loading={pending} className="mt-8">
        Set new password
      </Button>
      <p className="meta text-ink-3 mt-6 text-center">
        You&apos;ll be signed out everywhere else once it&apos;s changed.
      </p>
    </form>
  );
}

function Alert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="border-critical bg-critical-soft text-small text-ink mb-6 border-l-2 px-4 py-3"
    >
      {message}
    </p>
  );
}

function BackToSignIn() {
  return (
    <p className="meta text-ink-2 mt-6 text-center">
      Remembered it?{" "}
      <Link href="/auth/sign-in" className="link-underline text-ink">
        Sign in
      </Link>
    </p>
  );
}
