/**
 * Media resolution.
 *
 * The database stores opaque storage keys, never URLs. This module is the only
 * place a key becomes something a browser can fetch — which is what makes
 * moving from local files to S3, or putting a CDN in front of either, a change
 * to one environment variable rather than a migration over every image row.
 *
 * Safe to import from Client Components: it reads only a public base URL.
 */

const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "/photography").replace(/\/+$/, "");

/**
 * Member uploads resolve against their own base.
 *
 * The seeded photography ships with the repo in `public/photography`. Uploads do
 * not: the storage driver writes them to `public/uploads` locally and to a
 * bucket in production, so they were never reachable under `MEDIA_BASE` and
 * every uploaded photograph 404ed. Point this at the bucket's public URL
 * wherever `S3_*` is configured.
 */
const UPLOAD_BASE = (process.env.NEXT_PUBLIC_UPLOAD_BASE_URL || "/uploads").replace(/\/+$/, "");

/** The namespace `storeImage()` writes member uploads under. */
const UPLOAD_PREFIX = "listings/";

export interface ImageRef {
  readonly storageKey: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly blurDataUrl?: string | null;
}

/**
 * The URL for a stored image.
 *
 * Keys are stored without an extension so the format can change — a key
 * uploaded as JPEG and later transcoded to AVIF keeps its identity. The `.webp`
 * suffix here is the storage format the pipeline writes.
 */
export function mediaUrl(storageKey: string): string {
  if (!storageKey) return FALLBACK_IMAGE.storageKey;
  // Already absolute (an external CDN, or a member's remote avatar).
  if (/^https?:\/\//.test(storageKey) || storageKey.startsWith("data:")) return storageKey;
  const base = storageKey.startsWith(UPLOAD_PREFIX) ? UPLOAD_BASE : MEDIA_BASE;
  return `${base}/${storageKey}.webp`;
}

/**
 * The ratio every listing image is presented at.
 *
 * Fixing it is what turns fifty photographs taken by fifty different members
 * into a grid that reads as a shop. Galleries on the listing page are free to
 * honour the original ratio; the grid is not.
 */
export const LISTING_ASPECT = { width: 4, height: 5 } as const;
export const LISTING_ASPECT_RATIO = LISTING_ASPECT.width / LISTING_ASPECT.height;

/**
 * `sizes` values for each context an image appears in.
 *
 * Getting these right is the single highest-leverage performance decision on an
 * image-led site: without them the browser downloads a desktop-width file for a
 * phone. Each string mirrors the grid the image actually sits in.
 */
export const IMAGE_SIZES = {
  /** Shop grid: 2 up on phones, 3 on tablets, 4 on desktop. */
  grid: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 380px",
  /** Homepage rail: fixed-width cards. */
  rail: "(max-width: 640px) 68vw, (max-width: 1024px) 34vw, 300px",
  /** Listing page gallery. */
  gallery: "(max-width: 1024px) 100vw, 58vw",
  /** Full-bleed editorial band. */
  editorial: "100vw",
  /** Half-width editorial split. */
  editorialHalf: "(max-width: 1024px) 100vw, 55vw",
  /** Small square thumbnails in baskets, rentals and messages. */
  thumb: "(max-width: 640px) 88px, 120px",
  /** Occasion tiles. */
  tile: "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw",
} as const;

/**
 * Shown when a listing has no photography at all — which should not happen,
 * since the listing wizard requires at least one image, but a broken image icon
 * is not an acceptable failure mode on a page selling clothes.
 */
export const FALLBACK_IMAGE: ImageRef = {
  storageKey: "",
  alt: "Photography not available for this piece",
  width: 1400,
  height: 1750,
};

/**
 * Writes the alt text for a garment photograph.
 *
 * Centralised because alt text written per-component drifts immediately, and
 * because "image" and "photo" are noise to a screen reader — it already knows
 * it is announcing an image.
 */
export function garmentAlt(input: {
  title: string;
  brand?: string | null;
  colour?: string | null;
  frame?: number;
  total?: number;
}): string {
  const parts = [input.title];
  if (input.brand) parts.push(`by ${input.brand}`);
  if (input.colour) parts.push(`in ${input.colour.toLowerCase()}`);
  const base = parts.join(" ");
  if (input.frame && input.total && input.total > 1) {
    return `${base} — view ${input.frame} of ${input.total}`;
  }
  return base;
}

/**
 * A deterministic avatar for a member without an uploaded photograph.
 *
 * Renders their initials over a tone derived from their profile, as an inline
 * SVG data URI — no network request, no layout shift, and consistent between
 * server and client render.
 */
export function initialsAvatar(name: string, hue: number): string {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<rect width="96" height="96" fill="hsl(${hue} 22% 82%)"/>
<text x="48" y="48" font-family="Georgia, serif" font-size="34" fill="hsl(${hue} 30% 26%)"
 text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
