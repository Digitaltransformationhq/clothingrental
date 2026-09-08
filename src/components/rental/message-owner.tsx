"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { startConversation } from "@/server/actions/messages";

/**
 * Opens the thread with a piece's owner and goes to it.
 *
 * This used to be a link to `/account/messages` — the inbox, which on a first
 * rental is empty. The action it needs already existed and nothing called it:
 * `startConversation` finds the existing thread for the listing or creates one,
 * so the button lands on a conversation rather than on a list of them.
 */
export function MessageOwner({ listingId, className }: { listingId: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const open = async () => {
    setPending(true);
    setError(null);
    const result = await startConversation({ listingId });

    if (!result.ok) {
      setPending(false);
      setError(result.error?.message ?? "That thread could not be opened.");
      return;
    }
    // Deliberately not clearing `pending`: the button should stay busy until the
    // new route has painted, rather than flicking back to idle mid-navigation.
    router.push(`/account/messages/${result.data.conversationId}`);
  };

  return (
    <div className={className}>
      <Button variant="secondary" loading={pending} onClick={open}>
        Message the owner
      </Button>
      {error ? (
        <p role="alert" className="text-small text-critical mt-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}
