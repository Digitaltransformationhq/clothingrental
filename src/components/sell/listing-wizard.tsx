"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  emptyDraft,
  type ListingDraft,
  type Photo,
  validateStep,
  WIZARD_STEPS,
  type WizardStepId,
} from "@/domain/listing/draft";
import { formatMoney, money, subtract } from "@/domain/money";
import { quoteRental, suggestedBaseRate, suggestedDeposit } from "@/domain/rental/pricing";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media";
import { createListing, updateListing } from "@/server/actions/listings";
import { PhotoUploader } from "./photo-uploader";
import { Field, NumberField, OptionGrid, TextArea, Toggle } from "./fields";

/**
 * The listing wizard.
 *
 * Eight steps, one question each, rather than a single form with forty inputs.
 * The difference matters: a member listing a garment is doing unpaid work for
 * the marketplace, and every field they meet at once is a reason to stop.
 *
 * Two things make it feel worth finishing:
 *
 *  · The preview on the right is the real `ListingTile` composition, updating
 *    as they type — they can see the thing they are making.
 *  · The pricing step shows what they would actually be paid, commission and
 *    all, rather than only what the renter pays. Owners care about one of those
 *    numbers and marketplaces habitually show the other.
 *
 * Progress is held in the URL hash and in session storage, so a refresh or a
 * misplaced back button does not discard twenty minutes of work.
 */

export interface WizardTaxonomy {
  categories: Array<{ slug: string; name: string; parent: string | null }>;
  brands: Array<{ slug: string; name: string }>;
  sizes: Array<{ slug: string; label: string }>;
  colours: Array<{ slug: string; name: string; hex: string }>;
  occasions: Array<{ slug: string; name: string }>;
}

const STORAGE_KEY = "almirah:listing-draft";

export function ListingWizard({
  taxonomy,
  initial,
  listingId,
  defaultCity,
  defaultState,
}: {
  taxonomy: WizardTaxonomy;
  initial?: Partial<ListingDraft>;
  listingId?: string;
  defaultCity?: string;
  defaultState?: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(listingId);

  const [draft, setDraft] = React.useState<Partial<ListingDraft>>(() => {
    const base = emptyDraft({ city: defaultCity, state: defaultState, ...initial });
    // An abandoned draft is restored here, in the initialiser, rather than in
    // an effect: the wizard then renders the recovered values on its first
    // paint instead of flashing an empty form and correcting itself. Never
    // applied when editing an existing listing, whose values are authoritative.
    if (listingId) return base;
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      return stored ? { ...base, ...(JSON.parse(stored) as Partial<ListingDraft>) } : base;
    } catch {
      return base;
    }
  });
  const [stepIndex, setStepIndex] = React.useState(0);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isEditing) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* as above */
    }
  }, [draft, isEditing]);

  const step = WIZARD_STEPS[stepIndex];
  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K] | undefined) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const goNext = () => {
    const result = validateStep(step.id, draft);
    if (!result.ok) {
      setErrors(result.errors);
      // Move focus to the first thing that is wrong, rather than leaving the
      // member to hunt for it.
      const firstField = Object.keys(result.errors)[0];
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-field="${firstField}"]`)?.focus();
      });
      return;
    }
    setErrors({});
    setStepIndex((index) => Math.min(index + 1, WIZARD_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrors({});
    setStepIndex((index) => Math.max(0, index - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setSubmitting(true);
    setFormError(null);

    const result = isEditing
      ? await updateListing({ ...(draft as ListingDraft), listingId: listingId as string })
      : await createListing(draft as ListingDraft);

    if (!result.ok) {
      setSubmitting(false);
      setFormError(result.error.message);
      setErrors((result.error.fields ?? {}) as Record<string, string>);
      return;
    }

    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clean up */
    }

    router.push(`/sell/submitted?listing=${result.data.listingId}`);
  };

  return (
    <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <Progress stepIndex={stepIndex} total={WIZARD_STEPS.length} title={step.title} />

        <div className="mt-10">
          <p className="label text-ink-3">
            Step {stepIndex + 1} of {WIZARD_STEPS.length} · {step.title}
          </p>
          <h2 className="display-3 mt-3">{step.question}</h2>

          <div className="mt-8">
            <StepBody
              step={step.id}
              draft={draft}
              set={set}
              errors={errors}
              taxonomy={taxonomy}
              onEdit={setStepIndex}
            />
          </div>

          {formError ? (
            <p
              role="alert"
              className="border-critical bg-critical-soft text-small text-ink mt-6 border-l-2 px-4 py-3"
            >
              {formError}
            </p>
          ) : null}

          <div className="border-rule mt-10 flex items-center justify-between border-t pt-6">
            {stepIndex > 0 ? (
              <Button variant="quiet" onClick={goBack} type="button">
                Back
              </Button>
            ) : (
              <span />
            )}

            {step.id === "review" ? (
              <Button onClick={submit} loading={submitting} size="lg">
                {isEditing ? "Save changes" : "Submit for review"}
              </Button>
            ) : (
              <Button onClick={goNext} type="button">
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <LivePreview draft={draft} taxonomy={taxonomy} />
      </aside>
    </div>
  );
}

/**
 * Progress.
 *
 * One rule that fills as the draft advances, and nothing else.
 *
 * It replaced a row of eight labelled segments. At eight steps each label had
 * about a hundred pixels of a shared row, which put "Photographs" and
 * "Availability" on the edge of truncating, and the row then repeated the
 * "Step 3 of 8" line sitting directly beneath it. Three things on screen were
 * answering the same question.
 *
 * A progressbar, not a nav: it no longer navigates anywhere, so it should not
 * claim to. Going back a step is the Back button; going back several is the
 * review step, which stayed editable in place.
 */
function Progress({
  stepIndex,
  total,
  title,
}: {
  stepIndex: number;
  total: number;
  title: string;
}) {
  const reached = stepIndex + 1;

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={reached}
      // The number alone reads as "3" out of nowhere. This is what a screen
      // reader actually announces.
      aria-valuetext={`Step ${reached} of ${total} — ${title}`}
      className="bg-rule h-0.5 w-full overflow-hidden"
    >
      <span
        className="bg-ink block h-full transition-[width] duration-[--duration-base] ease-[--ease-editorial]"
        style={{ width: `${(reached / total) * 100}%` }}
      />
    </div>
  );
}

/** The live preview: the real tile composition, from the draft. */
function LivePreview({
  draft,
  taxonomy,
}: {
  draft: Partial<ListingDraft>;
  taxonomy: WizardTaxonomy;
}) {
  const cover = draft.photos?.[0];
  const brand = taxonomy.brands.find((entry) => entry.slug === draft.brandSlug);
  const size = taxonomy.sizes.find((entry) => entry.slug === draft.sizeSlug);

  return (
    <div>
      <p className="label text-ink-3 mb-4">How it will look</p>

      <div className="border-rule bg-surface border p-4">
        <div className="bg-paper-3 relative aspect-[4/5] w-full overflow-hidden">
          {cover ? (
            <Image
              src={mediaUrl(cover.storageKey)}
              alt=""
              fill
              sizes="260px"
              placeholder={cover.blurDataUrl ? "blur" : "empty"}
              blurDataURL={cover.blurDataUrl}
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center">
              {/* On `paper-3` rather than `paper`, where the tertiary ink drops
                  to 4.1:1. The secondary tone clears AA on every ground. */}
              <p className="meta text-ink-2 px-6 text-center">Your cover photograph appears here</p>
            </div>
          )}
        </div>

        <div className="pt-3.5">
          {brand ? (
            <p className="meta text-ink-3 tracking-[0.1em] uppercase">{brand.name}</p>
          ) : null}
          <p className="text-body text-ink mt-1">{draft.title || "Untitled piece"}</p>
          <p className="numeric text-body text-ink mt-2">
            {draft.baseRateRupees ? formatMoney(money(draft.baseRateRupees * 100, "INR")) : "₹—"}
            <span className="text-ink-3"> / {draft.baseDurationDays ?? "—"} days</span>
          </p>
          <p className="meta text-ink-3 mt-1.5">
            {size ? `Size ${size.label}` : "Size —"}
            {draft.city ? ` · ${draft.city}` : ""}
          </p>
        </div>
      </div>

      <p className="meta text-ink-3 mt-4">
        Listings are checked by us before they go live. It usually takes a few hours.
      </p>
    </div>
  );
}

// ── Step bodies ─────────────────────────────────────────────────────────────

function StepBody({
  step,
  draft,
  set,
  errors,
  taxonomy,
  onEdit,
}: {
  step: WizardStepId;
  draft: Partial<ListingDraft>;
  set: <K extends keyof ListingDraft>(key: K, value: ListingDraft[K] | undefined) => void;
  errors: Record<string, string>;
  taxonomy: WizardTaxonomy;
  onEdit: (index: number) => void;
}) {
  switch (step) {
    case "photos":
      return (
        <PhotoUploader
          photos={draft.photos ?? []}
          onChange={(next: Photo[]) => set("photos", next)}
          error={errors.photos}
        />
      );

    case "identity":
      return (
        <div className="space-y-8">
          <Field
            label="What is it?"
            name="title"
            hint="How you would describe it to a friend. “Black satin midi dress”, not “Dress 1”."
            value={draft.title ?? ""}
            onChange={(value) => set("title", value)}
            error={errors.title}
          />

          <OptionGrid
            label="Category"
            name="categorySlug"
            options={taxonomy.categories.map((entry) => ({
              value: entry.slug,
              label: entry.name,
              group: entry.parent ?? undefined,
            }))}
            value={draft.categorySlug}
            onChange={(value) => set("categorySlug", value)}
            error={errors.categorySlug}
            grouped
          />

          <OptionGrid
            label="Brand"
            name="brandSlug"
            hint="Optional. Leave it out if it is unlabelled or you are not sure."
            options={taxonomy.brands.map((entry) => ({ value: entry.slug, label: entry.name }))}
            value={draft.brandSlug}
            onChange={(value) => set("brandSlug", value)}
            error={errors.brandSlug}
            searchable
            clearable
          />

          <OptionGrid
            label="Worn by"
            name="gender"
            options={[
              { value: "WOMEN", label: "Women" },
              { value: "MEN", label: "Men" },
              { value: "UNISEX", label: "Anyone" },
            ]}
            value={draft.gender}
            onChange={(value) => set("gender", value as ListingDraft["gender"])}
            error={errors.gender}
          />
        </div>
      );

    case "details":
      return (
        <div className="space-y-8">
          <TextArea
            label="Describe it"
            name="description"
            hint="Where you wore it, how it fits, anything a photograph will not show. Mention any flaw — honest listings get better reviews, and a surprise on arrival is what causes disputes."
            rows={7}
            value={draft.description ?? ""}
            onChange={(value) => set("description", value)}
            error={errors.description}
          />

          <OptionGrid
            label="Condition"
            name="condition"
            options={[
              { value: "NEW_WITH_TAGS", label: "New, with tags" },
              { value: "LIKE_NEW", label: "Like new" },
              { value: "GENTLY_WORN", label: "Gently worn" },
              { value: "WELL_LOVED", label: "Well loved" },
            ]}
            value={draft.condition}
            onChange={(value) => set("condition", value as ListingDraft["condition"])}
            error={errors.condition}
          />

          <OptionGrid
            label="Closest colour"
            name="colourSlug"
            options={taxonomy.colours.map((entry) => ({
              value: entry.slug,
              label: entry.name,
              swatch: entry.hex,
            }))}
            value={draft.colourSlug}
            onChange={(value) => set("colourSlug", value)}
            error={errors.colourSlug}
          />

          <OptionGrid
            label="Right for"
            name="occasionSlugs"
            hint="Choose every occasion it genuinely suits — this is how people find it."
            options={taxonomy.occasions.map((entry) => ({ value: entry.slug, label: entry.name }))}
            values={draft.occasionSlugs}
            onChangeMultiple={(values) => set("occasionSlugs", values)}
            error={errors.occasionSlugs}
            multiple
          />

          <div className="grid gap-8 sm:grid-cols-2">
            <Field
              label="Fabric"
              name="fabric"
              optional
              hint="Silk, cotton, wool blend…"
              value={draft.fabric ?? ""}
              onChange={(value) => set("fabric", value)}
              error={errors.fabric}
            />
            <NumberField
              label="Retail price"
              name="retailPriceRupees"
              optional
              prefix="₹"
              hint="What it cost new. Used only to suggest a fair rate."
              value={draft.retailPriceRupees}
              onChange={(value) => set("retailPriceRupees", value)}
              error={errors.retailPriceRupees}
            />
          </div>

          <TextArea
            label="Care instructions"
            name="careInstructions"
            optional
            rows={3}
            hint="Anything the renter must or must not do."
            value={draft.careInstructions ?? ""}
            onChange={(value) => set("careInstructions", value)}
            error={errors.careInstructions}
          />
        </div>
      );

    case "sizing":
      return (
        <div className="space-y-8">
          <OptionGrid
            label="Size"
            name="sizeSlug"
            options={taxonomy.sizes.map((entry) => ({ value: entry.slug, label: entry.label }))}
            value={draft.sizeSlug}
            onChange={(value) => set("sizeSlug", value)}
            error={errors.sizeSlug}
          />

          <div>
            <p className="label text-ink-2 mb-2">Measurements</p>
            <p className="meta text-ink-3 mb-5 max-w-prose">
              Measured flat, in centimetres. Optional, but listings with measurements are rented
              considerably more often — sizes differ wildly between labels and people know it.
            </p>

            <div className="grid gap-6 sm:grid-cols-3">
              {(
                [
                  ["bustCm", "Bust"],
                  ["waistCm", "Waist"],
                  ["hipCm", "Hip"],
                  ["shoulderCm", "Shoulder"],
                  ["sleeveCm", "Sleeve"],
                  ["lengthCm", "Length"],
                ] as const
              ).map(([key, label]) => (
                <NumberField
                  key={key}
                  label={label}
                  name={key}
                  optional
                  suffix="cm"
                  value={draft[key]}
                  onChange={(value) => set(key, value)}
                  error={errors[key]}
                />
              ))}
            </div>
          </div>
        </div>
      );

    case "pricing":
      return <PricingStep draft={draft} set={set} errors={errors} />;

    case "availability":
      return (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <NumberField
              label="Shortest rental"
              name="minRentalDays"
              suffix="days"
              value={draft.minRentalDays}
              onChange={(value) => set("minRentalDays", value ?? 3)}
              error={errors.minRentalDays}
            />
            <NumberField
              label="Longest rental"
              name="maxRentalDays"
              suffix="days"
              value={draft.maxRentalDays}
              onChange={(value) => set("maxRentalDays", value ?? 14)}
              error={errors.maxRentalDays}
            />
            <NumberField
              label="Notice you need"
              name="leadTimeDays"
              suffix="days"
              hint="Before a rental can start."
              value={draft.leadTimeDays}
              onChange={(value) => set("leadTimeDays", value ?? 1)}
              error={errors.leadTimeDays}
            />
            <NumberField
              label="Turnaround after return"
              name="bufferDays"
              suffix="days"
              hint="Kept free for cleaning. Nobody can book these days."
              value={draft.bufferDays}
              onChange={(value) => set("bufferDays", value ?? 1)}
              error={errors.bufferDays}
            />
          </div>

          <Toggle
            label="Let people book instantly"
            hint="Without instant booking you approve every request yourself. Instant listings are rented roughly twice as often — but you give up the right to say no."
            checked={draft.instantBook ?? false}
            onChange={(value) => set("instantBook", value)}
          />
        </div>
      );

    case "handover":
      return (
        <div className="space-y-8">
          <OptionGrid
            label="How can people get it?"
            name="fulfilment"
            options={[
              { value: "PICKUP", label: "Collect in person" },
              { value: "LOCAL_DELIVERY", label: "I'll deliver locally" },
              { value: "SHIPPING", label: "I'll ship it" },
            ]}
            values={draft.fulfilment}
            onChangeMultiple={(values) => set("fulfilment", values as ListingDraft["fulfilment"])}
            error={errors.fulfilment}
            multiple
          />

          {draft.fulfilment && draft.fulfilment.some((mode) => mode !== "PICKUP") ? (
            <NumberField
              label="Delivery or shipping fee"
              name="deliveryFeeRupees"
              prefix="₹"
              optional
              hint="Charged once, covering both directions. Leave blank if you would rather absorb it."
              value={draft.deliveryFeeRupees}
              onChange={(value) => set("deliveryFeeRupees", value)}
              error={errors.deliveryFeeRupees}
            />
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="City"
              name="city"
              value={draft.city ?? ""}
              onChange={(value) => set("city", value)}
              error={errors.city}
            />
            <Field
              label="State"
              name="state"
              value={draft.state ?? ""}
              onChange={(value) => set("state", value)}
              error={errors.state}
            />
          </div>

          <TextArea
            label="Anything you'd like renters to know"
            name="rentalTerms"
            optional
            rows={4}
            hint="Shown before anyone pays. “Please don't pin through the border”, that sort of thing."
            value={draft.rentalTerms ?? ""}
            onChange={(value) => set("rentalTerms", value)}
            error={errors.rentalTerms}
          />
        </div>
      );

    case "review":
      return <ReviewStep draft={draft} taxonomy={taxonomy} onEdit={onEdit} />;
  }
}

/**
 * Pricing.
 *
 * Shows the owner what *they* get, not what the renter pays. Marketplaces
 * routinely show only the latter, which is how owners end up surprised by
 * commission after their first rental.
 */
function PricingStep({
  draft,
  set,
  errors,
}: {
  draft: Partial<ListingDraft>;
  set: <K extends keyof ListingDraft>(key: K, value: ListingDraft[K] | undefined) => void;
  errors: Record<string, string>;
}) {
  const retailMinor = draft.retailPriceRupees ? draft.retailPriceRupees * 100 : null;
  const suggestedRate = Math.round(suggestedBaseRate(retailMinor) / 100);
  const suggestedDep = Math.round(suggestedDeposit(retailMinor) / 100);

  const quote =
    draft.baseRateRupees && draft.baseDurationDays
      ? quoteRental({
          pricing: {
            currency: "INR",
            baseRateMinor: draft.baseRateRupees * 100,
            baseDurationDays: draft.baseDurationDays,
            extraDayRateMinor: (draft.extraDayRateRupees ?? 0) * 100,
            depositMinor: (draft.depositRupees ?? 0) * 100,
            cleaningFeeMinor: (draft.cleaningFeeRupees ?? 0) * 100,
            deliveryFeeMinor: (draft.deliveryFeeRupees ?? 0) * 100,
          },
          days: draft.baseDurationDays,
        })
      : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <NumberField
          label="Rate"
          name="baseRateRupees"
          prefix="₹"
          hint={
            retailMinor
              ? `Similar pieces go for around ₹${suggestedRate.toLocaleString("en-IN")}.`
              : undefined
          }
          value={draft.baseRateRupees}
          onChange={(value) => set("baseRateRupees", value ?? 0)}
          error={errors.baseRateRupees}
        />
        <NumberField
          label="For how many days"
          name="baseDurationDays"
          suffix="days"
          value={draft.baseDurationDays}
          onChange={(value) => set("baseDurationDays", value)}
          error={errors.baseDurationDays}
        />
        <NumberField
          label="Each extra day"
          name="extraDayRateRupees"
          prefix="₹"
          hint="Roughly a quarter of the base rate works well."
          value={draft.extraDayRateRupees}
          onChange={(value) => set("extraDayRateRupees", value ?? 0)}
          error={errors.extraDayRateRupees}
        />
        <NumberField
          label="Security deposit"
          name="depositRupees"
          prefix="₹"
          hint={
            retailMinor
              ? `Around ₹${suggestedDep.toLocaleString("en-IN")} for a piece of this value. Returned in full on a clean return.`
              : "Returned to the renter in full on a clean return."
          }
          value={draft.depositRupees}
          onChange={(value) => set("depositRupees", value ?? 0)}
          error={errors.depositRupees}
        />
      </div>

      <NumberField
        label="Cleaning fee"
        name="cleaningFeeRupees"
        prefix="₹"
        optional
        hint="Only if the piece genuinely needs specialist cleaning between rentals."
        value={draft.cleaningFeeRupees}
        onChange={(value) => set("cleaningFeeRupees", value)}
        error={errors.cleaningFeeRupees}
      />

      {quote ? (
        <div className="border-rule bg-paper-2 border p-6">
          <p className="label text-ink-3 mb-4">On a {draft.baseDurationDays}-day rental</p>

          {/* Builds from the figures the owner actually typed, down to the
              payout. The previous card jumped from the renter's total straight
              to the payout, and those two do not differ by the commission
              alone — the service fee, tax and delivery are charged on top and
              were never the owner's — so the subtraction on screen did not
              come out. Everything the owner is paid from is above the rule;
              everything collected from the renter on top is below it. */}
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-small text-ink-2">
                Your rate
                <span className="meta text-ink-3 mt-0.5 block">
                  {draft.baseDurationDays} {draft.baseDurationDays === 1 ? "day" : "days"}
                </span>
              </dt>
              <dd className="numeric text-small text-ink">{formatMoney(quote.baseAmount)}</dd>
            </div>

            {quote.extraDays > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-small text-ink-2">
                  {quote.extraDays} extra {quote.extraDays === 1 ? "day" : "days"}
                </dt>
                <dd className="numeric text-small text-ink">
                  {formatMoney(quote.extraDaysAmount)}
                </dd>
              </div>
            ) : null}

            {quote.cleaningFee.amountMinor > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-small text-ink-2">Cleaning</dt>
                <dd className="numeric text-small text-ink">{formatMoney(quote.cleaningFee)}</dd>
              </div>
            ) : null}

            <div className="border-rule flex justify-between gap-4 border-t pt-3">
              <dt className="text-small text-ink">Your rental price</dt>
              <dd className="numeric text-small text-ink">{formatMoney(quote.rentalSubtotal)}</dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-small text-ink-2">
                Almirah’s commission
                <span className="meta text-ink-3 mt-0.5 block">
                  {(quote.commissionBps / 100).toFixed(0)}% of your rental price
                </span>
              </dt>
              <dd className="numeric text-small text-ink-2">−{formatMoney(quote.commission)}</dd>
            </div>

            <div className="border-ink flex items-baseline justify-between gap-4 border-t pt-3">
              <dt className="text-body text-ink font-medium">You receive</dt>
              <dd className="numeric font-display text-ink text-[1.5rem] leading-none">
                {formatMoney(quote.ownerEarnings)}
              </dd>
            </div>
          </dl>

          <p className="meta text-ink-3 mt-4">
            Paid out once the piece is back with you and the rental closes.
          </p>

          {/* The renter's side of the same rental, kept apart so it cannot be
              read as part of the owner's arithmetic. */}
          <dl className="border-rule mt-5 space-y-2 border-t pt-4">
            <div className="flex justify-between gap-4">
              <dt className="meta text-ink-3">Fees and tax, added on for the renter</dt>
              <dd className="numeric meta text-ink-3">
                {formatMoney(subtract(quote.costToRenter, quote.rentalSubtotal))}
              </dd>
            </div>
            {quote.deposit.amountMinor > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="meta text-ink-3">Deposit, refunded on a clean return</dt>
                <dd className="numeric meta text-ink-3">{formatMoney(quote.deposit)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="meta text-ink-2">The renter pays today</dt>
              <dd className="numeric meta text-ink-2">{formatMoney(quote.total)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

/** The final read-through, with every step editable in place. */
function ReviewStep({
  draft,
  taxonomy,
  onEdit,
}: {
  draft: Partial<ListingDraft>;
  taxonomy: WizardTaxonomy;
  onEdit: (index: number) => void;
}) {
  const name = (list: Array<{ slug: string; name?: string; label?: string }>, slug?: string) =>
    list.find((entry) => entry.slug === slug)?.name ??
    list.find((entry) => entry.slug === slug)?.label ??
    "—";

  const sections: Array<{ step: number; title: string; rows: Array<[string, string]> }> = [
    {
      step: 0,
      title: "Photographs",
      rows: [["Images", `${draft.photos?.length ?? 0} added`]],
    },
    {
      step: 1,
      title: "The piece",
      rows: [
        ["Name", draft.title ?? "—"],
        ["Category", name(taxonomy.categories, draft.categorySlug)],
        ["Brand", draft.brandSlug ? name(taxonomy.brands, draft.brandSlug) : "Unlabelled"],
      ],
    },
    {
      step: 3,
      title: "Sizing",
      rows: [["Size", name(taxonomy.sizes, draft.sizeSlug)]],
    },
    {
      step: 4,
      title: "Price",
      rows: [
        [
          "Rate",
          draft.baseRateRupees
            ? `₹${draft.baseRateRupees.toLocaleString("en-IN")} / ${draft.baseDurationDays} days`
            : "—",
        ],
        ["Deposit", draft.depositRupees ? `₹${draft.depositRupees.toLocaleString("en-IN")}` : "—"],
      ],
    },
    {
      step: 5,
      title: "Availability",
      rows: [
        ["Rental length", `${draft.minRentalDays}–${draft.maxRentalDays} days`],
        ["Booking", draft.instantBook ? "Instant" : "You approve each request"],
      ],
    },
    {
      step: 6,
      title: "Handover",
      rows: [
        ["Ways to get it", (draft.fulfilment ?? []).length ? draft.fulfilment!.join(", ") : "—"],
        ["Where", [draft.city, draft.state].filter(Boolean).join(", ") || "—"],
      ],
    },
  ];

  return (
    <div>
      <p className="body-lg mb-8 max-w-prose">
        One read-through before it goes to us. We check every listing before it appears — usually
        within a few hours — and will come back to you if anything needs changing.
      </p>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h3 className="label text-ink-3">{section.title}</h3>
              <button
                type="button"
                onClick={() => onEdit(section.step)}
                className="link-underline meta text-ink-2"
              >
                Edit
              </button>
            </div>
            <dl className="border-rule border-t">
              {section.rows.map(([label, value]) => (
                <div
                  key={label}
                  className="border-rule flex items-baseline justify-between gap-6 border-b py-2.5"
                >
                  <dt className="text-small text-ink-2">{label}</dt>
                  <dd className="text-small text-ink text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
