"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { postMessage } from "@/server/actions/messages";

/**
 * The composer.
 *
 * Grows with the message rather than scrolling inside a fixed box, submits on
 * ⌘/Ctrl-Enter, and keeps the text if sending fails — losing a message you
 * just typed because the network dropped is unforgivable and entirely common.
 */
export function MessageComposer({
  conversationId,
  className,
}: {
  conversationId: string;
  className?: string;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  }, []);

  React.useEffect(resize, [body, resize]);

  const send = async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    const result = await postMessage({ conversationId, body: trimmed });
    setSending(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setBody("");
    router.refresh();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className={className}
    >
      <label htmlFor="message-body" className="sr-only">
        Write a message
      </label>
      <textarea
        ref={textareaRef}
        id="message-body"
        value={body}
        rows={2}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void send();
          }
        }}
        placeholder="Ask about fit, dates or collection…"
        className={cn(
          "bg-surface text-body text-ink w-full resize-none border p-3.5 leading-relaxed",
          "placeholder:text-ink-3 focus:outline-none",
          error ? "border-critical" : "border-rule focus:border-ink",
        )}
      />

      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="meta text-ink-3">
          <kbd className="border-rule border px-1 py-0.5">⌘</kbd>
          <span className="mx-1">+</span>
          <kbd className="border-rule border px-1 py-0.5">↵</kbd> to send
        </p>
        <Button type="submit" size="sm" loading={sending} disabled={body.trim().length === 0}>
          Send
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-small text-critical mt-3">
          {error}
        </p>
      ) : null}
    </form>
  );
}
