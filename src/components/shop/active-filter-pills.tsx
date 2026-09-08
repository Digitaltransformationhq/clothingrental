"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import {
  clearedFilters,
  parseShopFilters,
  serialiseShopFilters,
  type ShopFilters,
  toggleFilterValue,
} from "@/domain/catalog/filters";
import type { FilterFacets } from "@/server/services/listings";

/**
 * Applied filters, shown above the results.
 *
 * On desktop the rail already shows what is ticked, but a member who scrolled
 * past it — or arrived from a link, or is on a phone — has no other way to know
 * why they are seeing forty pieces instead of five hundred. Each pill removes
 * exactly its own filter.
 */
export function ActiveFilterPills({
  filters,
  facets,
}: {
  filters: ShopFilters;
  facets: FilterFacets;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (next: ShopFilters) => {
    router.push(`${pathname}${serialiseShopFilters(next)}`, { scroll: false });
  };

  const current = parseShopFilters(new URLSearchParams(searchParams.toString()));

  // Slugs are what the URL carries; names are what a member recognises.
  const labelFor = (key: keyof ShopFilters, value: string): string => {
    switch (key) {
      case "category":
        return facets.categories.find((entry) => entry.slug === value)?.name ?? value;
      case "occasion":
        return facets.occasions.find((entry) => entry.slug === value)?.name ?? value;
      case "size":
        return `Size ${facets.sizes.find((entry) => entry.slug === value)?.label ?? value}`;
      case "brand":
        return facets.brands.find((entry) => entry.slug === value)?.name ?? value;
      case "colour":
        return facets.colours.find((entry) => entry.slug === value)?.name ?? value;
      case "condition":
        return value
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
      case "gender":
        return value.charAt(0) + value.slice(1).toLowerCase();
      default:
        return value;
    }
  };

  const pills: Array<{ key: string; label: string; onRemove: () => void }> = [];

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
    for (const value of filters[key]) {
      pills.push({
        key: `${key}:${value}`,
        label: labelFor(key, value),
        onRemove: () => apply(toggleFilterValue(current, key, value)),
      });
    }
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice ? `₹${filters.minPrice.toLocaleString("en-IN")}` : "Any";
    const max = filters.maxPrice ? `₹${filters.maxPrice.toLocaleString("en-IN")}` : "Any";
    pills.push({
      key: "price",
      label: `${min} – ${max}`,
      onRemove: () =>
        apply({ ...current, minPrice: undefined, maxPrice: undefined, page: undefined }),
    });
  }

  if (filters.availability !== "any") {
    pills.push({
      key: "availability",
      label: filters.availability === "now" ? "Available now" : "Books instantly",
      onRemove: () => apply({ ...current, availability: "any", page: undefined }),
    });
  }

  if (filters.from && filters.to) {
    pills.push({
      key: "dates",
      label: `${filters.from} → ${filters.to}`,
      onRemove: () => apply({ ...current, from: undefined, to: undefined, page: undefined }),
    });
  }

  if (pills.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2 pt-5">
      {pills.map((pill) => (
        <li key={pill.key}>
          <button
            type="button"
            onClick={pill.onRemove}
            className="group border-rule-strong text-small text-ink hover:border-ink hover:bg-ink hover:text-ink-inverse inline-flex items-center gap-1.5 border px-2.5 py-1.5 transition-colors"
          >
            {pill.label}
            <X
              className="h-3 w-3 opacity-50 group-hover:opacity-100"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="sr-only">Remove filter</span>
          </button>
        </li>
      ))}
      {pills.length > 1 ? (
        <li>
          <button
            type="button"
            onClick={() => apply(clearedFilters(current))}
            className="link-underline meta text-ink-2 ml-1"
          >
            Clear all
          </button>
        </li>
      ) : null}
    </ul>
  );
}
