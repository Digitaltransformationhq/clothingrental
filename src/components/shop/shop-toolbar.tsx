"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

import {
  parseShopFilters,
  serialiseShopFilters,
  SORT_OPTIONS,
  type SortOption,
} from "@/domain/catalog/filters";

/**
 * The result count and sort control.
 *
 * The count is stated in words rather than as a bare number, because "51 pieces"
 * reads as a sentence and "51" reads as a metric.
 */
export function ShopToolbar({
  total,
  filters,
}: {
  total: number;
  filters: ReturnType<typeof parseShopFilters>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setSort = (sort: SortOption) => {
    const next = parseShopFilters(new URLSearchParams(searchParams.toString()));
    router.push(`${pathname}${serialiseShopFilters({ ...next, sort, page: undefined })}`, {
      scroll: false,
    });
  };

  const current = SORT_OPTIONS.find((option) => option.value === filters.sort) ?? SORT_OPTIONS[0];

  return (
    <div className="border-rule flex items-center justify-between gap-4 border-b pb-4">
      <p className="meta text-ink-2" aria-live="polite">
        <span className="numeric text-ink">{total}</span> {total === 1 ? "piece" : "pieces"}
      </p>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="text-small text-ink-2 hover:text-ink inline-flex items-center gap-2 transition-colors">
          <span className="text-ink-3">Sort</span>
          <span className="text-ink">{current.label}</span>
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="border-rule bg-surface z-50 min-w-52 border py-1 shadow-[var(--shadow-overlay)]"
          >
            {SORT_OPTIONS.map((option) => (
              <DropdownMenu.Item
                key={option.value}
                onSelect={() => setSort(option.value)}
                className="text-small text-ink-2 data-[highlighted]:bg-paper-2 data-[highlighted]:text-ink flex cursor-pointer items-center justify-between gap-3 px-4 py-2 transition-colors outline-none"
              >
                {option.label}
                {option.value === filters.sort ? (
                  <Check className="text-ink h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                ) : null}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
