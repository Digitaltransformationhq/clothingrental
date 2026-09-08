"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";

import { Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

/**
 * Search.
 *
 * Opens a command palette rather than navigating to a search page, because
 * search here is a way of moving around the catalogue, not a destination.
 * Ctrl/⌘-K opens it from anywhere.
 *
 * Suggestions are written rather than generated: they show what this
 * marketplace is actually good for, which does more for a first-time visitor
 * than an empty box does.
 */

const SUGGESTIONS = [
  "black dress",
  "wedding saree",
  "designer blazer",
  "lehenga under ₹2000",
  "sherwani in Delhi",
  "vacation outfits",
] as const;

const RECENT_KEY = "almirah:recent-searches";

export function SearchTrigger() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [recent, setRecent] = React.useState<string[]>([]);

  /**
   * Reads recent searches when the palette opens.
   *
   * Called from the open handler rather than from an effect on `open`: this is
   * a response to an event, not state that needs keeping in step with
   * something external.
   */
  const loadRecent = React.useCallback(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_KEY);
      setRecent(stored ? (JSON.parse(stored) as string[]).slice(0, 5) : []);
    } catch {
      // Private browsing, or storage disabled. Recent searches are a
      // convenience; their absence must not break search.
      setRecent([]);
    }
  }, []);

  const onOpenChange = React.useCallback(
    (next: boolean) => {
      if (next) loadRecent();
      setOpen(next);
    },
    [loadRecent],
  );

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => {
          if (!value) loadRecent();
          return !value;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadRecent]);

  const submit = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    try {
      const next = [trimmed, ...recent.filter((entry) => entry !== trimmed)].slice(0, 5);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // As above.
    }

    setOpen(false);
    setQuery("");
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        className={cn(
          "text-ink-2 hover:text-ink inline-flex h-8 w-8 items-center justify-center transition-colors",
          "group-data-[on-dark=true]/header:hover:text-ink-inverse group-data-[on-dark=true]/header:text-[color:color-mix(in_oklab,var(--color-ink-inverse)_80%,transparent)]",
        )}
        aria-label="Search the wardrobe"
      >
        <Search className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} aria-hidden="true" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-obsidian/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50" />
        <Dialog.Content className="bg-paper data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top-4 data-[state=open]:slide-in-from-top-4 sm:border-rule fixed top-0 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 duration-200 sm:top-[12vh] sm:border sm:shadow-[var(--shadow-overlay)]">
          <Dialog.Title className="sr-only">Search the wardrobe</Dialog.Title>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(query);
            }}
            className="border-rule flex items-center gap-3 border-b px-5"
          >
            <Search className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {/* A search dialog that does not focus its field is a search
                dialog nobody can use. */}
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What are you dressing for?"
              aria-label="Search"
              className="text-body-lg text-ink placeholder:text-ink-3 h-16 flex-1 bg-transparent focus:outline-none"
            />
            {/* The chip used to read ESC, which was also the button's whole
                accessible name — an icon needs the name said out loud instead.
                Escape still closes the dialog either way; the chip was only
                ever advertising it. */}
            <Dialog.Close
              aria-label="Close search"
              className="text-ink-3 hover:text-ink -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center transition-colors"
            >
              <X className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
          </form>

          <div className="max-h-[60vh] overflow-y-auto p-5">
            {recent.length > 0 ? (
              <div className="mb-6">
                <Eyebrow className="mb-3">Recent</Eyebrow>
                <ul className="space-y-1">
                  {recent.map((term) => (
                    <li key={term}>
                      <button
                        type="button"
                        onClick={() => submit(term)}
                        className="text-body text-ink-2 hover:text-ink w-full py-1.5 text-left transition-colors"
                      >
                        {term}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Eyebrow className="mb-3">Try</Eyebrow>
            <ul className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((term) => (
                <li key={term}>
                  <button
                    type="button"
                    onClick={() => submit(term)}
                    className="border-rule text-small text-ink-2 hover:border-ink hover:text-ink border px-3 py-1.5 transition-colors"
                  >
                    {term}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
