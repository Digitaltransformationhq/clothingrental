"use client";

import * as React from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/primitives";

/**
 * The error boundary.
 *
 * Two things a member needs to know when something breaks in a marketplace,
 * in this order: that their money is safe, and what to do next. The technical
 * detail is not one of them — `digest` is included only so support can match a
 * report to a server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // The full error is already on the server; this records that a member
    // actually saw it, which server logs alone cannot tell you.
    console.error("[almirah] rendered error boundary:", error.message);
  }, [error]);

  return (
    <div className="page-gutter py-28 sm:py-36">
      <div className="page-width max-w-xl">
        <Eyebrow className="mb-4">Something went wrong</Eyebrow>
        <h1 className="display-2">That didn’t work.</h1>
        <p className="body-lg mt-5">
          Something failed at our end rather than yours. Nothing has been charged, and no booking
          has been changed.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Back to the beginning
          </ButtonLink>
        </div>

        {error.digest ? (
          <p className="meta border-rule text-ink-3 mt-10 border-t pt-6">
            If you get in touch, quoting <span className="numeric text-ink-2">{error.digest}</span>{" "}
            will let us find exactly what happened.
          </p>
        ) : null}
      </div>
    </div>
  );
}
