"use client";

import * as React from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { IMAGE_SIZES, type ImageRef, mediaUrl } from "@/lib/media";

/**
 * The garment gallery.
 *
 * Desktop is a stacked column at full column width — the way a lookbook runs,
 * rather than one big image with four thumbnails under it. Photography is what
 * sells a rental, so it gets the space.
 *
 * Mobile is a snap-scrolling track with a counter, because a stacked column of
 * three tall images is a very long page on a phone.
 *
 * Both open the same fullscreen viewer, which supports arrow keys, escape, and
 * announces its position.
 */
export function ItemGallery({ images, title }: { images: ImageRef[]; title: string }) {
  const [active, setActive] = React.useState(0);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const trackRef = React.useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return <div className="bg-paper-3 aspect-[4/5] w-full" aria-hidden="true" />;
  }

  const onTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  const open = (index: number) => {
    setActive(index);
    setViewerOpen(true);
  };

  return (
    <>
      {/* ── Mobile: swipeable ────────────────────────────────────────────── */}
      <div className="relative lg:hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <button
              key={image.storageKey}
              type="button"
              onClick={() => open(index)}
              className="relative aspect-[4/5] w-full shrink-0 snap-start"
              aria-label={`View ${title}, image ${index + 1} of ${images.length}, full screen`}
            >
              <Image
                src={mediaUrl(image.storageKey)}
                alt={image.alt}
                fill
                sizes="100vw"
                priority={index === 0}
                placeholder={image.blurDataUrl ? "blur" : "empty"}
                blurDataURL={image.blurDataUrl ?? undefined}
                className="object-cover"
              />
            </button>
          ))}
        </div>

        {images.length > 1 ? (
          <p
            className="numeric bg-paper/92 text-ink absolute right-4 bottom-4 px-2 py-1 text-[0.6875rem] tracking-[0.08em]"
            aria-live="polite"
          >
            {active + 1} / {images.length}
          </p>
        ) : null}
      </div>

      {/* ── Desktop: stacked column ──────────────────────────────────────── */}
      <div className="hidden gap-2 lg:grid">
        {images.map((image, index) => (
          <button
            key={image.storageKey}
            type="button"
            onClick={() => open(index)}
            className="photo-zoom group relative block w-full cursor-zoom-in"
            aria-label={`View ${title}, image ${index + 1} of ${images.length}, full screen`}
          >
            <div className="photo-frame aspect-[4/5] w-full">
              <Image
                src={mediaUrl(image.storageKey)}
                alt={image.alt}
                fill
                sizes={IMAGE_SIZES.gallery}
                priority={index === 0}
                loading={index === 0 ? "eager" : "lazy"}
                placeholder={image.blurDataUrl ? "blur" : "empty"}
                blurDataURL={image.blurDataUrl ?? undefined}
                className="object-cover"
              />
            </div>
          </button>
        ))}
      </div>

      <GalleryViewer
        images={images}
        title={title}
        index={active}
        onIndexChange={setActive}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}

function GalleryViewer({
  images,
  title,
  index,
  onIndexChange,
  open,
  onOpenChange,
}: {
  images: ImageRef[];
  title: string;
  index: number;
  onIndexChange: (next: number) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const step = React.useCallback(
    (delta: number) => {
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  const current = images[index];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-obsidian/95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 flex flex-col">
          <Dialog.Title className="sr-only">{title} — photographs</Dialog.Title>

          <div className="text-ink-inverse flex items-center justify-between px-5 py-4">
            <p className="numeric text-small" aria-live="polite">
              {index + 1} / {images.length}
            </p>
            <Dialog.Close
              aria-label="Close"
              className="text-ink-inverse/70 hover:text-ink-inverse -mr-2 p-2"
            >
              <X className="h-6 w-6" strokeWidth={1.25} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="relative flex-1">
            {current ? (
              <Image
                src={mediaUrl(current.storageKey)}
                alt={current.alt}
                fill
                sizes="100vw"
                // The viewer preserves the photograph's own proportions rather
                // than cropping it to the grid's 4:5.
                className="object-contain"
              />
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="flex items-center justify-center gap-3 px-5 py-5">
              <ViewerButton direction="previous" onClick={() => step(-1)} />
              <div className="flex gap-2">
                {images.map((image, dotIndex) => (
                  <button
                    key={image.storageKey}
                    type="button"
                    onClick={() => onIndexChange(dotIndex)}
                    aria-label={`Image ${dotIndex + 1}`}
                    aria-current={dotIndex === index}
                    className={cn(
                      "h-1 w-8 transition-colors",
                      dotIndex === index ? "bg-paper" : "bg-paper/30 hover:bg-paper/60",
                    )}
                  />
                ))}
              </div>
              <ViewerButton direction="next" onClick={() => step(1)} />
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ViewerButton({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} image`}
      className="text-ink-inverse/70 hover:text-ink-inverse grid h-10 w-10 place-items-center transition-colors"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d={direction === "previous" ? "M10 2 4 8l6 6" : "M6 2l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    </button>
  );
}
