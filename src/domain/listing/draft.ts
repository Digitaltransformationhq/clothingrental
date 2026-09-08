import { z } from "zod";

/**
 * The listing draft.
 *
 * One schema, used in three places: the wizard validates each step against a
 * slice of it in the browser, the server action validates the whole thing on
 * submission, and the edit form reuses both. There is no second definition of
 * what a valid listing is, so the two cannot disagree.
 *
 * Client-safe — this module imports nothing but zod.
 */

export const PHOTO_MIN = 3;
export const PHOTO_MAX = 8;

export const photoSchema = z.object({
  storageKey: z.string().min(1).max(200),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurDataUrl: z.string().max(4000).optional(),
  alt: z.string().max(200).optional(),
});

export type Photo = z.infer<typeof photoSchema>;

/** Rupees in the form, paise everywhere else. */
const rupees = (max: number) =>
  z
    .number({ message: "Enter an amount" })
    .int("Whole rupees, please")
    .min(0)
    .max(max, `That's above the ${max.toLocaleString("en-IN")} limit`);

export const listingDraftSchema = z.object({
  // ── Step 1 · Photographs ─────────────────────────────────────────────────
  photos: z
    .array(photoSchema)
    .min(PHOTO_MIN, `Add at least ${PHOTO_MIN} photographs — front, back and a detail.`)
    .max(PHOTO_MAX, `Up to ${PHOTO_MAX} photographs.`),

  // ── Step 2 · What it is ──────────────────────────────────────────────────
  title: z
    .string()
    .trim()
    .min(4, "Give it a name people would search for")
    .max(90, "Keep the name under 90 characters"),
  categorySlug: z.string().min(1, "Choose a category"),
  brandSlug: z.string().optional(),
  gender: z.enum(["WOMEN", "MEN", "UNISEX"]),

  // ── Step 3 · Details ─────────────────────────────────────────────────────
  description: z.string().trim().min(1, "Add a description"),
  condition: z.enum(["NEW_WITH_TAGS", "LIKE_NEW", "GENTLY_WORN", "WELL_LOVED"]),
  colourSlug: z.string().min(1, "Choose the closest colour"),
  occasionSlugs: z.array(z.string()).min(1, "Pick at least one occasion").max(6),
  fabric: z.string().trim().max(120).optional(),
  careInstructions: z.string().trim().max(400).optional(),
  retailPriceRupees: rupees(2_000_000).optional(),

  // ── Step 4 · Sizing ──────────────────────────────────────────────────────
  sizeSlug: z.string().min(1, "Choose a size"),
  // Millimetres in the model, centimetres in the form: nobody measures a
  // garment in millimetres, and nobody should have to.
  bustCm: z.number().int().min(0).max(300).optional(),
  waistCm: z.number().int().min(0).max(300).optional(),
  hipCm: z.number().int().min(0).max(300).optional(),
  lengthCm: z.number().int().min(0).max(300).optional(),
  shoulderCm: z.number().int().min(0).max(150).optional(),
  sleeveCm: z.number().int().min(0).max(150).optional(),

  // ── Step 5 · Price ───────────────────────────────────────────────────────
  baseRateRupees: rupees(200_000).refine((value) => value >= 100, "At least ₹100"),
  // No default any more, so an empty field is reachable and needs a message
  // of its own rather than Zod's "expected number, received undefined".
  baseDurationDays: z
    .number({ message: "How many days does the base rate cover?" })
    .int("Whole days, please")
    .min(1, "At least one day")
    .max(14, "At most 14 days"),
  extraDayRateRupees: rupees(50_000),
  depositRupees: rupees(500_000),
  cleaningFeeRupees: rupees(20_000).optional(),

  // ── Step 6 · Availability ────────────────────────────────────────────────
  minRentalDays: z.number().int().min(1).max(60),
  maxRentalDays: z.number().int().min(1).max(90),
  bufferDays: z.number().int().min(0).max(14),
  leadTimeDays: z.number().int().min(0).max(30),
  instantBook: z.boolean(),

  // ── Step 7 · Handover ────────────────────────────────────────────────────
  fulfilment: z
    .array(z.enum(["PICKUP", "LOCAL_DELIVERY", "SHIPPING"]))
    .min(1, "Choose at least one way to hand it over"),
  deliveryFeeRupees: rupees(5_000).optional(),
  city: z.string().trim().min(2, "Which city is it in?").max(80),
  state: z.string().trim().min(2, "Which state?").max(80),
  rentalTerms: z.string().trim().max(600).optional(),
});

export type ListingDraft = z.infer<typeof listingDraftSchema>;

/**
 * Cross-field rules.
 *
 * Kept apart from the field schema because they only make sense once several
 * steps have been filled in, and the wizard validates step by step.
 */
export const listingDraftRefined = listingDraftSchema
  .refine((draft) => draft.maxRentalDays >= draft.minRentalDays, {
    message: "The longest rental cannot be shorter than the shortest one.",
    path: ["maxRentalDays"],
  })
  .refine(
    (draft) =>
      draft.retailPriceRupees === undefined || draft.baseRateRupees <= draft.retailPriceRupees,
    {
      message: "A rental should cost less than buying the piece outright.",
      path: ["baseRateRupees"],
    },
  )
  .refine(
    (draft) =>
      !draft.fulfilment.includes("PICKUP") || draft.fulfilment.length > 1 || draft.city.length > 0,
    { message: "Collection needs a city.", path: ["city"] },
  );

// ── Steps ───────────────────────────────────────────────────────────────────

export const WIZARD_STEPS = [
  { id: "photos", title: "Photographs", question: "Show us the piece" },
  { id: "identity", title: "The piece", question: "What are you listing?" },
  { id: "details", title: "Details", question: "Tell us about it" },
  { id: "sizing", title: "Sizing", question: "How does it fit?" },
  { id: "pricing", title: "Price", question: "What's it worth for a few days?" },
  { id: "availability", title: "Availability", question: "When can it go out?" },
  { id: "handover", title: "Handover", question: "How does it reach people?" },
  { id: "review", title: "Review", question: "Ready?" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/** Which fields belong to which step, for per-step validation. */
export const STEP_FIELDS: Record<WizardStepId, Array<keyof ListingDraft>> = {
  photos: ["photos"],
  identity: ["title", "categorySlug", "brandSlug", "gender"],
  details: [
    "description",
    "condition",
    "colourSlug",
    "occasionSlugs",
    "fabric",
    "careInstructions",
    "retailPriceRupees",
  ],
  sizing: ["sizeSlug", "bustCm", "waistCm", "hipCm", "lengthCm", "shoulderCm", "sleeveCm"],
  pricing: [
    "baseRateRupees",
    "baseDurationDays",
    "extraDayRateRupees",
    "depositRupees",
    "cleaningFeeRupees",
  ],
  availability: ["minRentalDays", "maxRentalDays", "bufferDays", "leadTimeDays", "instantBook"],
  handover: ["fulfilment", "deliveryFeeRupees", "city", "state", "rentalTerms"],
  review: [],
};

/** Sensible starting values, so the wizard is never an empty form. */
export function emptyDraft(defaults?: Partial<ListingDraft>): Partial<ListingDraft> {
  return {
    photos: [],
    gender: "WOMEN",
    condition: "LIKE_NEW",
    occasionSlugs: [],
    minRentalDays: 3,
    maxRentalDays: 14,
    bufferDays: 1,
    leadTimeDays: 1,
    instantBook: false,
    fulfilment: ["SHIPPING"],
    ...defaults,
  };
}

/** Validates one step in isolation, for the wizard's Next button. */
export function validateStep(
  step: WizardStepId,
  draft: Partial<ListingDraft>,
): { ok: true } | { ok: false; errors: Record<string, string> } {
  const fields = STEP_FIELDS[step];
  if (fields.length === 0) return { ok: true };

  const shape = listingDraftSchema.pick(
    Object.fromEntries(fields.map((field) => [field, true])) as never,
  );

  const result = shape.safeParse(draft);
  if (result.success) return { ok: true };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
