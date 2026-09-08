import { SEED_GARMENTS } from "./catalogue";
import { SEED_COLORS, SEED_OCCASIONS } from "./taxonomy";

/**
 * Everything the photography generator renders, derived from the catalogue
 * rather than listed separately — so a garment can never be added without its
 * frames, and a frame can never be orphaned.
 */

export interface PhotographyBrief {
  /** Becomes the storage key stem: `<key>-1`, `<key>-2`, … */
  readonly key: string;
  /** The colour the composition is built from. */
  readonly baseHex: string;
  readonly variants: number;
  readonly width: number;
  readonly height: number;
}

const colourBySlug = new Map(SEED_COLORS.map((colour) => [colour.slug, colour.hex]));

/** Three frames per garment: the drape, a closer crop, a detail. */
const FRAMES_PER_GARMENT = 3;

/** The 4:5 the entire listing grid is built on. */
export const GARMENT_FRAME = { width: 1200, height: 1500 } as const;

const garmentBriefs: PhotographyBrief[] = SEED_GARMENTS.map((garment) => {
  const baseHex = colourBySlug.get(garment.color);
  if (!baseHex) {
    throw new Error(
      `Garment "${garment.slug}" references colour "${garment.color}", which is not in the taxonomy.`,
    );
  }
  return {
    key: garment.slug,
    baseHex,
    variants: FRAMES_PER_GARMENT,
    ...GARMENT_FRAME,
  };
});

/**
 * Occasion tiles.
 *
 * Deliberately not a uniform set: the homepage lays these out at different
 * proportions so the section reads as an edited page rather than as a grid of
 * equal boxes. The ratio is a property of the tile, so the layout and the
 * asset agree.
 */
const OCCASION_ART: Record<string, { hex: string; width: number; height: number }> = {
  wedding: { hex: "#6E1F2E", width: 1200, height: 1500 },
  festive: { hex: "#B4741F", width: 1400, height: 1050 },
  party: { hex: "#2A2340", width: 1000, height: 1250 },
  "date-night": { hex: "#4A2A44", width: 1400, height: 1000 },
  formal: { hex: "#25262B", width: 1100, height: 1400 },
  office: { hex: "#5A5C55", width: 1400, height: 1050 },
  vacation: { hex: "#3E7080", width: 1300, height: 1300 },
  traditional: { hex: "#8A4A22", width: 1000, height: 1250 },
  casual: { hex: "#6B6A5C", width: 1400, height: 1000 },
};

const occasionBriefs: PhotographyBrief[] = SEED_OCCASIONS.map((occasion) => {
  const art = OCCASION_ART[occasion.slug] ?? { hex: "#5A5449", width: 1200, height: 1200 };
  return {
    key: `occasion-${occasion.slug}`,
    baseHex: art.hex,
    variants: 1,
    width: art.width,
    height: art.height,
  };
});

/** Editorial imagery for the homepage bands and collection covers. */
const editorialBriefs: PhotographyBrief[] = [
  { key: "editorial-hero", baseHex: "#7A4A3C", variants: 1, width: 2200, height: 1400 },
  { key: "editorial-shared-wardrobe", baseHex: "#4A3B32", variants: 1, width: 1500, height: 1100 },
  {
    key: "editorial-list-your-clothes",
    baseHex: "#5E4A38",
    variants: 1,
    width: 1500,
    height: 1800,
  },
  { key: "editorial-closing", baseHex: "#2C2A26", variants: 1, width: 2200, height: 1200 },
  {
    key: "collection-the-wedding-season",
    baseHex: "#6E1F2E",
    variants: 1,
    width: 1600,
    height: 1000,
  },
  { key: "collection-quiet-luxury", baseHex: "#9A8B72", variants: 1, width: 1600, height: 1000 },
  { key: "collection-handloom-first", baseHex: "#3F5A4A", variants: 1, width: 1600, height: 1000 },
  { key: "collection-black-tie", baseHex: "#22232A", variants: 1, width: 1600, height: 1000 },
  { key: "collection-festive-nights", baseHex: "#A8641F", variants: 1, width: 1600, height: 1000 },
];

export const PHOTOGRAPHY_PLAN: readonly PhotographyBrief[] = [
  ...garmentBriefs,
  ...occasionBriefs,
  ...editorialBriefs,
];

/** Storage keys for one garment's frames, in display order. */
export function garmentImageKeys(slug: string): string[] {
  return Array.from({ length: FRAMES_PER_GARMENT }, (_, index) => `${slug}-${index + 1}`);
}
