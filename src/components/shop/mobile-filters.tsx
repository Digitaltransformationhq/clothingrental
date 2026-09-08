"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";

import { countActiveFilters, type ShopFilters } from "@/domain/catalog/filters";
import type { FilterFacets } from "@/server/services/listings";
import { FilterRail } from "./filter-rail";

/**
 * Filters on a phone.
 *
 * A floating trigger that stays reachable while scrolling a long grid, opening
 * a drawer from the bottom — where a thumb is, rather than at the top of the
 * screen where a header would put it.
 *
 * The drawer stays open as filters are applied so several can be set in one
 * go, and the footer button reports the live result count, which is the
 * question a member actually has while filtering.
 */
export function MobileFilters({
  facets,
  filters,
  total,
}: {
  facets: FilterFacets;
  filters: ShopFilters;
  total: number;
}) {
  const [open, setOpen] = React.useState(false);
  const activeCount = countActiveFilters(filters);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="border-ink bg-ink text-ink-inverse fixed bottom-6 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 border px-5 py-3 text-[0.75rem] tracking-[0.12em] uppercase shadow-[var(--shadow-overlay)] lg:hidden">
        <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        Filter
        {activeCount > 0 ? <span className="numeric">({activeCount})</span> : null}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-obsidian/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50" />
        <Dialog.Content className="bg-paper data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[88svh] flex-col duration-300">
          <div className="border-rule flex items-center justify-between border-b px-5 py-4">
            <Dialog.Title className="title-2">Filter</Dialog.Title>
            <Dialog.Close aria-label="Close filters" className="text-ink-2 -mr-2 p-2">
              <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <FilterRail facets={facets} />
          </div>

          <div className="border-rule border-t p-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-ink text-ink-inverse h-12 w-full text-[0.75rem] tracking-[0.14em] uppercase"
            >
              Show {total} {total === 1 ? "piece" : "pieces"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
