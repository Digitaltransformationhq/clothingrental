"use client";

import * as React from "react";
import Image from "next/image";

import { PHOTO_MAX, PHOTO_MIN, type Photo } from "@/domain/listing/draft";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";

/**
 * The photograph uploader.
 *
 * Photography is the product, so this step gets the most care in the wizard:
 * drag and drop, multiple files, per-file progress, reordering by drag, delete,
 * and an explicit cover image — the first frame, marked as such, because that is
 * the one doing the selling in every grid on the site.
 *
 * Uploads run concurrently and each carries its own state, so one large file
 * failing does not discard the four that succeeded.
 */

interface PendingUpload {
  id: string;
  name: string;
  progress: number;
  error?: string;
  previewUrl: string;
}

export function PhotoUploader({
  photos,
  onChange,
  error,
}: {
  photos: Photo[];
  onChange: (next: Photo[]) => void;
  error?: string;
}) {
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const remaining = PHOTO_MAX - photos.length - pending.length;

  const upload = React.useCallback(
    async (files: File[]) => {
      const accepted = files.slice(0, Math.max(0, remaining));
      if (accepted.length === 0) return;

      const entries: PendingUpload[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        progress: 0,
        previewUrl: URL.createObjectURL(file),
      }));

      setPending((current) => [...current, ...entries]);

      await Promise.all(
        accepted.map(
          (file, index) =>
            new Promise<void>((resolve) => {
              const entry = entries[index];
              const body = new FormData();
              body.append("file", file);

              // XHR rather than fetch: fetch still has no upload progress, and
              // a member uploading eight photographs on a phone connection
              // needs to see something happening.
              const request = new XMLHttpRequest();
              request.open("POST", "/api/uploads");

              request.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                const progress = Math.round((event.loaded / event.total) * 100);
                setPending((current) =>
                  current.map((item) => (item.id === entry.id ? { ...item, progress } : item)),
                );
              };

              request.onload = () => {
                let payload: { ok?: boolean; data?: Photo; error?: { message?: string } } = {};
                try {
                  payload = JSON.parse(request.responseText);
                } catch {
                  payload = {};
                }

                if (request.status >= 200 && request.status < 300 && payload.ok && payload.data) {
                  const stored = payload.data as Photo & { key?: string };
                  onChange([
                    ...photos,
                    {
                      storageKey: (stored as { key?: string }).key ?? stored.storageKey,
                      width: stored.width,
                      height: stored.height,
                      blurDataUrl: stored.blurDataUrl,
                    },
                  ]);
                  setPending((current) => current.filter((item) => item.id !== entry.id));
                  URL.revokeObjectURL(entry.previewUrl);
                } else {
                  setPending((current) =>
                    current.map((item) =>
                      item.id === entry.id
                        ? {
                            ...item,
                            error: payload.error?.message ?? "That upload didn't work.",
                            progress: 100,
                          }
                        : item,
                    ),
                  );
                }
                resolve();
              };

              request.onerror = () => {
                setPending((current) =>
                  current.map((item) =>
                    item.id === entry.id
                      ? { ...item, error: "The connection dropped. Try again.", progress: 100 }
                      : item,
                  ),
                );
                resolve();
              };

              request.send(body);
            }),
        ),
      );
    },
    [photos, onChange, remaining],
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div>
      {/* ── Drop zone ─────────────────────────────────────────────────────── */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void upload(
            [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/")),
          );
        }}
        className={cn(
          "border border-dashed p-10 text-center transition-colors",
          dragOver ? "border-ink bg-paper-2" : "border-rule-strong",
          remaining <= 0 && "opacity-50",
        )}
      >
        <p className="title-2">Drag photographs here</p>
        <p className="meta text-ink-2 mt-2">
          {PHOTO_MIN}–{PHOTO_MAX} images. JPEG, PNG, WebP or HEIC, up to 12MB each.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={remaining <= 0}
          className="border-rule-strong text-ink hover:border-ink hover:bg-ink hover:text-ink-inverse mt-5 border px-4 py-2.5 text-[0.75rem] tracking-[0.12em] uppercase transition-colors disabled:opacity-40"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          aria-label="Choose photographs to upload"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
          multiple
          className="sr-only"
          onChange={(event) => {
            void upload([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        <p className="meta text-ink-3 mt-4">
          Natural light, plain background, and one photograph of any flaw. Honest listings get
          better reviews.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-small text-critical mt-3">
          {error}
        </p>
      ) : null}

      {/* ── The set ───────────────────────────────────────────────────────── */}
      {photos.length > 0 || pending.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <li
              key={photo.storageKey}
              draggable
              onDragStart={() => setDraggingIndex(index)}
              onDragEnd={() => setDraggingIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingIndex !== null) move(draggingIndex, index);
                setDraggingIndex(null);
              }}
              className={cn(
                "group relative cursor-grab active:cursor-grabbing",
                draggingIndex === index && "opacity-40",
              )}
            >
              <div className="bg-paper-3 relative aspect-[4/5] w-full overflow-hidden">
                <Image
                  src={mediaUrl(photo.storageKey)}
                  alt=""
                  fill
                  sizes="200px"
                  placeholder={photo.blurDataUrl ? "blur" : "empty"}
                  blurDataURL={photo.blurDataUrl}
                  className="object-cover"
                />

                {index === 0 ? (
                  <span className="bg-ink text-ink-inverse absolute top-0 left-0 px-2 py-1 text-[0.625rem] tracking-[0.1em] uppercase">
                    Cover
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => onChange(photos.filter((_, i) => i !== index))}
                  className="bg-paper/90 text-ink absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove photograph ${index + 1}`}
                >
                  <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" aria-hidden="true">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>

              {/* Keyboard-accessible reordering. Drag and drop alone is not an
                  accessible control, and "make it the cover" is the single
                  thing people most want to do here. */}
              <div className="mt-2 flex items-center justify-between">
                <span className="meta text-ink-3">{index + 1}</span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move photograph ${index + 1} earlier`}
                    className="text-small text-ink-2 hover:text-ink px-1.5 disabled:opacity-25"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === photos.length - 1}
                    aria-label={`Move photograph ${index + 1} later`}
                    className="text-small text-ink-2 hover:text-ink px-1.5 disabled:opacity-25"
                  >
                    →
                  </button>
                </span>
              </div>
            </li>
          ))}

          {pending.map((entry) => (
            <li key={entry.id}>
              <div className="bg-paper-3 relative aspect-[4/5] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                <img
                  src={entry.previewUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-40"
                />
                <div className="bg-rule absolute inset-x-0 bottom-0 h-0.5">
                  <div
                    className="bg-ink h-full transition-[width] duration-200"
                    style={{ width: `${entry.progress}%` }}
                  />
                </div>
              </div>
              <p className="meta text-ink-3 mt-2 truncate">
                {entry.error ? (
                  <span className="text-critical">{entry.error}</span>
                ) : (
                  `${entry.progress}%`
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="meta text-ink-3 mt-4" aria-live="polite">
        {photos.length} of {PHOTO_MAX} added
        {photos.length > 0 && photos.length < PHOTO_MIN
          ? ` — ${PHOTO_MIN - photos.length} more to go`
          : ""}
        {photos.length > 1 ? " · drag to reorder; the first is the cover" : ""}
      </p>
    </div>
  );
}
