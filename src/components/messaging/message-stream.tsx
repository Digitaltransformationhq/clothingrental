"use client";

import * as React from "react";

import { formatRelativeTime } from "@/domain/dates";
import { cn } from "@/lib/cn";

/**
 * The message stream.
 *
 * Two kinds of thing appear here and they are drawn differently on purpose:
 *
 *  · Messages between members, aligned left and right.
 *  · Platform events — "Booking accepted", "Payment received" — drawn as a
 *    centred rule with a label, because they are not somebody talking. Styling
 *    them as chat bubbles from a nameless participant is confusing, and
 *    hiding them entirely loses the record of what happened when.
 */

export interface StreamMessage {
  id: string;
  body: string;
  kind: "TEXT" | "SYSTEM";
  systemEvent?: string | null;
  fromMe: boolean;
  createdAt: string;
}

export function MessageStream({
  messages,
  counterpartName,
  className,
}: {
  messages: StreamMessage[];
  counterpartName: string;
  className?: string;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);

  // Opens at the newest message, which is what a thread is for.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <p className={cn("border-rule text-small text-ink-2 border-t py-10 text-center", className)}>
        No messages yet. Say hello — owners reply faster to a real question than to “is this
        available?”.
      </p>
    );
  }

  return (
    <ol className={cn("space-y-4", className)} aria-label="Messages">
      {messages.map((message) => {
        if (message.kind === "SYSTEM") {
          return (
            <li key={message.id} className="flex items-center gap-4 py-2">
              <span className="bg-rule h-px flex-1" />
              <span className="meta text-ink-3 shrink-0">
                {message.body}
                <span className="text-ink-3 ml-2">
                  {formatRelativeTime(new Date(message.createdAt))}
                </span>
              </span>
              <span className="bg-rule h-px flex-1" />
            </li>
          );
        }

        return (
          <li
            key={message.id}
            className={cn("flex flex-col", message.fromMe ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "text-body max-w-[85%] px-4 py-3 leading-relaxed sm:max-w-[75%]",
                message.fromMe
                  ? "bg-ink text-ink-inverse"
                  : "border-rule bg-surface text-ink border",
              )}
            >
              <p className="break-words whitespace-pre-wrap">{message.body}</p>
            </div>
            <p className="meta text-ink-3 mt-1.5">
              <span className="sr-only">{message.fromMe ? "You" : counterpartName}, </span>
              {formatRelativeTime(new Date(message.createdAt))}
            </p>
          </li>
        );
      })}
      <div ref={endRef} />
    </ol>
  );
}
