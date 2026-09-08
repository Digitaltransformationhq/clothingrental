"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as Accordion from "@radix-ui/react-accordion";
import { Check, ChevronDown } from "lucide-react";

import {
  AVAILABILITY_OPTIONS,
  CONDITION_OPTIONS,
  GENDER_OPTIONS,
  clearedFilters,
  countActiveFilters,
  parseShopFilters,
  serialiseShopFilters,
  type ShopFilters,
  toggleFilterValue,
} from "@/domain/catalog/filters";
import { cn } from "@/lib/cn";
import type { FilterFacets } from "@/server/services/listings";

/**
 * The filter rail.
 *
 * Filters write to the URL and nothing else. There is no local filter state to
 * fall out of step with the address bar, the back button works, and a filtered
 * view can be sent to somebody.
 *
 * Navigation is wrapped in a transition so the grid dims rather than blanking
 * while the server responds — the results stay readable and the page does not
 * jump.
 */
export function FilterRail({
  facets,
  className,
  onNavigate,
}: {
  facets: FilterFacets;
  className?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();

  const filters = React.useMemo(
    () => parseShopFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const apply = (next: ShopFilters) => {
    startTransition(() => {
      // `scroll: false` keeps the member's place in a long grid when they tick
      // a box halfway down the page.
      router.push(`${pathname}${serialiseShopFilters(next)}`, { scroll: false });
      onNavigate?.();
    });
  };

  const toggle = (key: Parameters<typeof toggleFilterValue>[1], value: string) => {
    apply(toggleFilterValue(filters, key, value));
  };

  const activeCount = countActiveFilters(filters);

  // Categories arrive flat with a parent reference; grouping them here keeps
  // the query simple and the rail readable.
  const grouped = React.useMemo(() => {
    const map = new Map<string, { name: string; children: FilterFacets["categories"] }>();
    for (const category of facets.categories) {
      const parentSlug = category.parent?.slug ?? "other";
      const parentName = category.parent?.name ?? "Other";
      if (!map.has(parentSlug)) map.set(parentSlug, { name: parentName, children: [] });
      map.get(parentSlug)?.children.push(category);
    }
    return [...map.entries()];
  }, [facets.categories]);

  return (
    <div className={cn("text-small", className)}>
      <div className="border-rule flex items-baseline justify-between border-b pb-4">
        <h2 className="label text-ink">Filter</h2>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => apply(clearedFilters(filters))}
            className="link-underline meta text-ink-2"
          >
            Clear all ({activeCount})
          </button>
        ) : null}
      </div>

      <Accordion.Root
        type="multiple"
        defaultValue={["category", "occasion", "size", "price"]}
        className="divide-rule divide-y"
      >
        <FilterSection value="category" label="Category">
          <div className="space-y-5">
            {grouped.map(([slug, group]) => (
              <div key={slug}>
                <p className="meta text-ink-3 mb-2">{group.name}</p>
                <ul className="space-y-1.5">
                  {group.children.map((category) => (
                    <li key={category.slug}>
                      <FilterCheck
                        checked={filters.category.includes(category.slug)}
                        onChange={() => toggle("category", category.slug)}
                        label={category.name}
                        count={category._count.items}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection value="occasion" label="Occasion">
          <ul className="space-y-1.5">
            {facets.occasions.map((occasion) => (
              <li key={occasion.slug}>
                <FilterCheck
                  checked={filters.occasion.includes(occasion.slug)}
                  onChange={() => toggle("occasion", occasion.slug)}
                  label={occasion.name}
                />
              </li>
            ))}
          </ul>
        </FilterSection>

        <FilterSection value="size" label="Size">
          {/* Sizes are a swatch grid rather than a list: they are short, there
              are many, and people scan them by shape. */}
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => {
              const active = filters.size.includes(size.slug);
              return (
                <button
                  key={size.slug}
                  type="button"
                  onClick={() => toggle("size", size.slug)}
                  aria-pressed={active}
                  className={cn(
                    "text-small min-w-11 border px-2.5 py-2 text-center transition-colors",
                    active
                      ? "border-ink bg-ink text-ink-inverse"
                      : "border-rule text-ink-2 hover:border-ink hover:text-ink",
                  )}
                >
                  {size.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection value="price" label="Price">
          <PriceFilter
            key={`${filters.minPrice ?? ""}-${filters.maxPrice ?? ""}`}
            filters={filters}
            facets={facets}
            onApply={apply}
          />
        </FilterSection>

        <FilterSection value="colour" label="Colour">
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {facets.colours.map((colour) => {
              const active = filters.colour.includes(colour.slug);
              return (
                <li key={colour.slug}>
                  <button
                    type="button"
                    onClick={() => toggle("colour", colour.slug)}
                    aria-pressed={active}
                    className="group flex w-full items-center gap-2 py-1 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 border",
                        active
                          ? "border-ink ring-ink ring-offset-paper ring-1 ring-offset-2"
                          : "border-rule-strong",
                      )}
                      style={{ backgroundColor: colour.hex }}
                    />
                    <span
                      className={cn(
                        "truncate transition-colors",
                        active ? "text-ink" : "text-ink-2 group-hover:text-ink",
                      )}
                    >
                      {colour.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </FilterSection>

        <FilterSection value="brand" label="Brand">
          <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {facets.brands.map((brand) => (
              <li key={brand.slug}>
                <FilterCheck
                  checked={filters.brand.includes(brand.slug)}
                  onChange={() => toggle("brand", brand.slug)}
                  label={brand.name}
                />
              </li>
            ))}
          </ul>
        </FilterSection>

        <FilterSection value="gender" label="Worn by">
          <ul className="space-y-1.5">
            {GENDER_OPTIONS.map((option) => (
              <li key={option.value}>
                <FilterCheck
                  checked={filters.gender.includes(option.value)}
                  onChange={() => toggle("gender", option.value)}
                  label={option.label}
                />
              </li>
            ))}
          </ul>
        </FilterSection>

        <FilterSection value="condition" label="Condition">
          <ul className="space-y-1.5">
            {CONDITION_OPTIONS.map((option) => (
              <li key={option.value}>
                <FilterCheck
                  checked={filters.condition.includes(option.value)}
                  onChange={() => toggle("condition", option.value)}
                  label={option.label}
                />
              </li>
            ))}
          </ul>
        </FilterSection>

        <FilterSection value="city" label="City">
          <ul className="space-y-1.5">
            {facets.cities.map((entry) => (
              <li key={entry.city}>
                <FilterCheck
                  checked={filters.city.includes(entry.city)}
                  onChange={() => toggle("city", entry.city)}
                  label={entry.city}
                  count={entry.count}
                />
              </li>
            ))}
          </ul>
        </FilterSection>

        <FilterSection value="availability" label="Availability">
          <ul className="space-y-1.5">
            {AVAILABILITY_OPTIONS.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => apply({ ...filters, availability: option.value, page: undefined })}
                  className={cn(
                    "flex w-full items-center gap-2.5 py-1 text-left transition-colors",
                    filters.availability === option.value
                      ? "text-ink"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                      filters.availability === option.value ? "border-ink" : "border-rule-strong",
                    )}
                  >
                    {filters.availability === option.value ? (
                      <span className="bg-ink h-1.5 w-1.5 rounded-full" />
                    ) : null}
                  </span>
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </FilterSection>
      </Accordion.Root>
    </div>
  );
}

function FilterSection({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between py-4 text-left">
          <span className="text-small text-ink font-medium">{label}</span>
          <ChevronDown
            className="text-ink-3 h-4 w-4 transition-transform duration-[--duration-base] ease-[--ease-editorial] group-data-[state=open]:rotate-180"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <div className="pb-5">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

function FilterCheck({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5 py-1">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "grid h-3.5 w-3.5 shrink-0 place-items-center border transition-colors",
          "peer-focus-visible:outline-claret peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          checked
            ? "border-ink bg-ink text-ink-inverse"
            : "border-rule-strong group-hover:border-ink",
        )}
      >
        {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
      </span>
      <span
        className={cn(
          "flex-1 transition-colors",
          checked ? "text-ink" : "text-ink-2 group-hover:text-ink",
        )}
      >
        {label}
      </span>
      {count !== undefined ? <span className="meta text-ink-3">{count}</span> : null}
    </label>
  );
}

/**
 * Price is a pair of inputs rather than a slider.
 *
 * A slider looks better in a screenshot and is worse to use: it cannot be
 * typed into, it is hard to hit precisely on a phone, and "under ₹2,000" is a
 * number people already have in mind.
 */
function PriceFilter({
  filters,
  facets,
  onApply,
}: {
  filters: ShopFilters;
  facets: FilterFacets;
  onApply: (next: ShopFilters) => void;
}) {
  // Seeded from the URL once. When the URL changes — a shortcut pressed, or
  // filters cleared — the parent remounts this component via `key`, which
  // resets them. That is React's own answer to "reset state when a prop
  // changes", and avoids a render pass showing the previous value.
  const [min, setMin] = React.useState(filters.minPrice?.toString() ?? "");
  const [max, setMax] = React.useState(filters.maxPrice?.toString() ?? "");

  const commit = () => {
    onApply({
      ...filters,
      minPrice: min ? Number.parseInt(min, 10) : undefined,
      maxPrice: max ? Number.parseInt(max, 10) : undefined,
      page: undefined,
    });
  };

  const shortcuts = [
    { label: "Under ₹1,000", max: 1000 },
    { label: "₹1,000–2,500", min: 1000, max: 2500 },
    { label: "₹2,500+", min: 2500 },
  ];

  return (
    <div>
      <p className="meta text-ink-3 mb-3">
        Per {filters.days ?? 3} days · ₹{facets.priceRange.minRupees.toLocaleString("en-IN")}–
        {facets.priceRange.maxRupees.toLocaleString("en-IN")}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
        className="flex items-center gap-2"
      >
        <label className="flex-1">
          <span className="sr-only">Minimum price in rupees</span>
          <input
            inputMode="numeric"
            value={min}
            onChange={(event) => setMin(event.target.value.replace(/\D/g, ""))}
            onBlur={commit}
            placeholder="Min"
            className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink h-10 w-full border px-2.5 focus:outline-none"
          />
        </label>
        <span aria-hidden="true" className="text-ink-3">
          –
        </span>
        <label className="flex-1">
          <span className="sr-only">Maximum price in rupees</span>
          <input
            inputMode="numeric"
            value={max}
            onChange={(event) => setMax(event.target.value.replace(/\D/g, ""))}
            onBlur={commit}
            placeholder="Max"
            className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink h-10 w-full border px-2.5 focus:outline-none"
          />
        </label>
        <button type="submit" className="sr-only">
          Apply price range
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() =>
              onApply({
                ...filters,
                minPrice: shortcut.min,
                maxPrice: shortcut.max,
                page: undefined,
              })
            }
            className="meta border-rule text-ink-2 hover:border-ink hover:text-ink border px-2 py-1 transition-colors"
          >
            {shortcut.label}
          </button>
        ))}
      </div>
    </div>
  );
}
