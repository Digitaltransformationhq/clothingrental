"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOutEverywhere } from "@/server/actions/profile";

/**
 * Ends every session, including this one.
 *
 * Confirmed before running, because it signs the member out of the device they
 * are currently using — which is the intended behaviour, and still a surprise
 * if it happens without warning.
 */
export function SignOutEverywhere({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = async () => {
    if (!window.confirm("Sign out on every device, including this one?")) return;
    setPending(true);
    await signOutEverywhere();
    // Navigate first, then refresh — this one runs from a page the member can
    // no longer see, so leaving them on it to be bounced by its own guard is a
    // worse exit than sending them home. The refresh has to come second, or
    // the navigation supersedes it and the header keeps the signed-in menu.
    router.replace("/");
    router.refresh();
  };

  return (
    <div className={className}>
      <Button variant="secondary" size="sm" loading={pending} onClick={run}>
        Sign out everywhere
      </Button>
      <p className="meta text-ink-3 mt-2">
        Ends every session, including this one. Use this if you have lost a device.
      </p>
    </div>
  );
}
