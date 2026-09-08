/**
 * The route-level loading state.
 *
 * A thin progress rule at the top of the page rather than a full-page skeleton.
 * Most navigations here resolve quickly, and replacing the whole page with grey
 * rectangles for 200ms is more disruptive than the wait it is covering.
 *
 * Pages whose content genuinely takes time — the shop grid — supply their own
 * skeleton that matches their real layout.
 */
export default function Loading() {
  return (
    <div className="page-gutter py-24" role="status" aria-live="polite">
      <div className="page-width">
        <div className="bg-rule h-px w-full overflow-hidden">
          <div className="bg-ink h-full w-1/3 animate-[loading_1.2s_var(--ease-editorial)_infinite]" />
        </div>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
