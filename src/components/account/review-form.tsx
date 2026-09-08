"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/sell/fields";
import { cn } from "@/lib/cn";
import { leaveReview } from "@/server/actions/reviews";

/**
 * The review form.
 *
 * A renter is asked about the garment — fit, condition, whether it matched its
 * listing — because those three are what the next renter needs to know and what
 * no photograph can tell them. An owner is asked about the person.
 *
 * Stars are radio buttons underneath, so the whole thing works from a keyboard
 * and announces properly, rather than being a row of clickable glyphs.
 */
export function ReviewForm({
  bookingId,
  perspective,
  counterpartName,
}: {
  bookingId: string;
  perspective: "RENTER" | "OWNER";
  counterpartName: string;
}) {
  const router = useRouter();
  const [rating, setRating] = React.useState(0);
  const [fit, setFit] = React.useState(0);
  const [condition, setCondition] = React.useState(0);
  const [accuracy, setAccuracy] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (rating === 0) {
      setError("Choose a rating first.");
      return;
    }

    setPending(true);
    setError(null);

    const result = await leaveReview({
      bookingId,
      rating,
      ...(perspective === "RENTER"
        ? {
            fitRating: fit || undefined,
            conditionRating: condition || undefined,
            accuracyRating: accuracy || undefined,
          }
        : {}),
      body: body.trim() || undefined,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    router.push("/account/rentals");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <Stars
        label={perspective === "RENTER" ? "Overall" : `How was ${counterpartName.split(" ")[0]}?`}
        name="rating"
        value={rating}
        onChange={setRating}
      />

      {perspective === "RENTER" ? (
        <div className="border-rule space-y-6 border-t pt-8">
          <Stars label="Did it fit as described?" name="fit" value={fit} onChange={setFit} />
          <Stars
            label="What condition was it in?"
            name="condition"
            value={condition}
            onChange={setCondition}
          />
          <Stars
            label="Was it as the listing described?"
            name="accuracy"
            value={accuracy}
            onChange={setAccuracy}
          />
        </div>
      ) : null}

      <div className="border-rule border-t pt-8">
        <TextArea
          label="Anything you'd add?"
          name="body"
          optional
          rows={5}
          value={body}
          onChange={setBody}
          hint={
            perspective === "RENTER"
              ? "What the photographs did not show, how it ran for size, how the handover went. This is the single most useful thing on a listing for the next person."
              : "Did it come back on time and looked after? Other owners rely on this."
          }
          counter={{ current: body.length, max: 2000 }}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" loading={pending}>
          Publish review
        </Button>
        <p className="meta text-ink-3">
          Published under your name. It cannot be edited afterwards.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-critical bg-critical-soft text-small text-ink border-l-2 px-3 py-2"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

const LABELS = ["", "Poor", "Not great", "Fine", "Good", "Excellent"];

function Stars({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [hovered, setHovered] = React.useState(0);
  const shown = hovered || value;

  return (
    <fieldset>
      <legend className="label text-ink-2 mb-3">{label}</legend>
      <div className="flex items-center gap-3">
        <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <label
              key={star}
              onMouseEnter={() => setHovered(star)}
              className="cursor-pointer p-0.5"
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "block text-[1.5rem] leading-none transition-colors",
                  "peer-focus-visible:outline-claret peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                  star <= shown ? "text-claret" : "text-rule-strong",
                )}
              >
                ★
              </span>
              <span className="sr-only">
                {star} out of 5 — {LABELS[star]}
              </span>
            </label>
          ))}
        </div>
        <span className="meta text-ink-2" aria-live="polite">
          {shown > 0 ? LABELS[shown] : ""}
        </span>
      </div>
    </fieldset>
  );
}
