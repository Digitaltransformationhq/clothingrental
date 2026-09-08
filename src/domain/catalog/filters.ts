import { z } from "zod";

/**
 * Shop filters.
 *
 * The URL is the state. Every filter a member applies is a query parameter, so
 * a filtered view can be linked, bookmarked, shared and indexed — and the back
 * button does what it should. Nothing about the catalogue's state lives in a
 * client-side store.
 *
 * This module is the single definition of that contract. The shop page parses
 * incoming parameters with it on the server, the filter rail writes them with
 * it in the browser, and neither can drift from the other.
 *
 * Client-safe: no server imports.
 */

export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newly listed" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "rating", label: "Best rated" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const GENDER_OPTIONS = [
  { value: "WOMEN", label: "Women" },
  { value: "MEN", label: "Men" },
  { value: "UNISEX", label: "Unisex" },
] as const;

export const CONDITION_OPTIONS = [
  { value: "NEW_WITH_TAGS", label: "New, with tags" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "GENTLY_WORN", label: "Gently worn" },
  { value: "WELL_LOVED", label: "Well loved" },
] as const;

export const AVAILABILITY_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "now", label: "Available now" },
  { value: "instant", label: "Books instantly" },
] as const;

/** Prices are handled in whole rupees in the URL and paise everywhere else. */
export const PRICE_CEILING_RUPEES = 15_000;

/** Repeated parameters arrive as `?size=s&size=m`; single ones as a string. */
const multi = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return [] as string[];
    const list = Array.isArray(value) ? value : [value];
    return list
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  });

const positiveInt = (max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return undefined;
      const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) return undefined;
      return Math.min(Math.trunc(parsed), max);
    });

const isoDate = z
  .union([z.string(), z.undefined()])
  .optional()
  .transform((value) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined,
  );

/**
 * Deliberately forgiving: a filter value that no longer exists, or a malformed
 * price, is dropped rather than raising. A stale link from a bookmark should
 * still show a shop, not an error page.
 */
export const shopFilterSchema = z.object({
  q: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((value) =>
      typeof value === "string" ? value.trim().slice(0, 120) || undefined : undefined,
    ),
  category: multi,
  occasion: multi,
  size: multi,
  brand: multi,
  colour: multi,
  gender: multi,
  condition: multi,
  city: multi,
  minPrice: positiveInt(PRICE_CEILING_RUPEES),
  maxPrice: positiveInt(PRICE_CEILING_RUPEES),
  /** Rental window the member needs the garment for. */
  from: isoDate,
  to: isoDate,
  days: positiveInt(60),
  availability: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((value) =>
      value === "now" || value === "instant" ? (value as "now" | "instant") : "any",
    ),
  sort: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((value) => {
      const allowed = SORT_OPTIONS.map((option) => option.value) as readonly string[];
      return allowed.includes(value as string) ? (value as SortOption) : "recommended";
    }),
  page: positiveInt(500),
});

export type ShopFilters = z.infer<typeof shopFilterSchema>;

export const PAGE_SIZE = 24;

/** Parses raw search params, whatever shape the framework hands over. */
export function parseShopFilters(
  input: Record<string, string | string[] | undefined> | URLSearchParams,
): ShopFilters {
  const raw =
    input instanceof URLSearchParams
      ? Object.fromEntries(
          [...new Set(input.keys())].map((key) => {
            const all = input.getAll(key);
            return [key, all.length > 1 ? all : all[0]];
          }),
        )
      : input;

  const parsed = shopFilterSchema.parse(raw);

  // A reversed price range is a slider mishap, not an empty shop.
  if (
    parsed.minPrice !== undefined &&
    parsed.maxPrice !== undefined &&
    parsed.minPrice > parsed.maxPrice
  ) {
    return { ...parsed, minPrice: parsed.maxPrice, maxPrice: parsed.minPrice };
  }
  return parsed;
}

/**
 * Serialises filters back to a query string.
 *
 * Defaults are omitted so the canonical URL for an unfiltered shop is `/shop`
 * and not `/shop?sort=recommended&page=1`, which matters for both crawlers and
 * for whether a shared link looks like something a person would send.
 */
export function serialiseShopFilters(filters: Partial<ShopFilters>): string {
  const params = new URLSearchParams();

  const appendAll = (key: string, values: string[] | undefined) => {
    for (const value of values ?? []) params.append(key, value);
  };

  if (filters.q) params.set("q", filters.q);
  appendAll("category", filters.category);
  appendAll("occasion", filters.occasion);
  appendAll("size", filters.size);
  appendAll("brand", filters.brand);
  appendAll("colour", filters.colour);
  appendAll("gender", filters.gender);
  appendAll("condition", filters.condition);
  appendAll("city", filters.city);

  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.days !== undefined) params.set("days", String(filters.days));
  if (filters.availability && filters.availability !== "any") {
    params.set("availability", filters.availability);
  }
  if (filters.sort && filters.sort !== "recommended") params.set("sort", filters.sort);
  if (filters.page !== undefined && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Toggles one value of a multi-select filter and returns the next filter state,
 * always resetting to page one — staying on page seven after narrowing the
 * results is a reliable way to show an empty shop.
 */
export function toggleFilterValue(
  filters: ShopFilters,
  key: "category" | "occasion" | "size" | "brand" | "colour" | "gender" | "condition" | "city",
  value: string,
): ShopFilters {
  const current = filters[key];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return { ...filters, [key]: next, page: undefined };
}

/** How many filters are applied, for the "Filters (3)" affordance on mobile. */
export function countActiveFilters(filters: ShopFilters): number {
  let count = 0;
  for (const key of [
    "category",
    "occasion",
    "size",
    "brand",
    "colour",
    "gender",
    "condition",
    "city",
  ] as const) {
    count += filters[key].length;
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) count += 1;
  if (filters.from && filters.to) count += 1;
  if (filters.availability !== "any") count += 1;
  return count;
}

export function hasActiveFilters(filters: ShopFilters): boolean {
  return countActiveFilters(filters) > 0 || Boolean(filters.q);
}

/** The filters cleared, keeping the sort the member chose. */
export function clearedFilters(filters: ShopFilters): ShopFilters {
  return shopFilterSchema.parse({ sort: filters.sort });
}
