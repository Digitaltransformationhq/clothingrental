/**
 * Generates the photography the seed catalogue references.
 *
 * Almirah is carried by its imagery, and a demo full of grey boxes with an
 * image icon in the middle misrepresents what the interface actually looks
 * like. Equally, hot-linking stock photographs from an unstable third-party URL
 * is not something a production repository should do.
 *
 * So the catalogue ships with generated art direction: tonal drapery studies
 * derived deterministically from each garment's own colour and slug. They read
 * as a deliberate photographic treatment rather than as missing assets, and
 * every frame is reproducible from the seed data alone.
 *
 * ── Replacing these with real photography ──────────────────────────────────
 *
 * Nothing in the application knows these files exist. Images are stored as
 * opaque keys (`ClothingImage.storageKey`) and resolved to URLs at render time
 * by `src/lib/media.ts`. To move to real photography:
 *
 *   1. Point NEXT_PUBLIC_MEDIA_BASE_URL at your bucket or CDN, and
 *   2. Upload files under the same keys — or let members upload through the
 *      listing wizard, which writes new keys as they go.
 *
 * No code change, no migration, no redeploy.
 *
 * Usage:  npm run media:generate        (about six minutes for 171 frames)
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { PHOTOGRAPHY_PLAN, type PhotographyBrief } from "../src/server/seed/photography-plan";

const OUTPUT_DIR = path.join(process.cwd(), "public", "photography");

/**
 * A small deterministic generator. Every visual decision below is driven by
 * this, seeded from the frame's key, so regenerating produces exactly the same
 * catalogue.
 */
function createRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return ((hash >>> 0) % 100_000) / 100_000;
  };
}

// ── Colour ──────────────────────────────────────────────────────────────────

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l: lightness * 100 };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return { h: (hue * 60 + 360) % 360, s: saturation * 100, l: lightness * 100 };
}

const css = ({ h, s, l }: Hsl, alpha = 1) =>
  alpha === 1
    ? `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alpha})`;

/** Shifts lightness and saturation while keeping the hue anchored. */
const at = (colour: Hsl, dl: number, ds = 0): Hsl => ({
  h: colour.h,
  s: Math.min(92, Math.max(3, colour.s + ds)),
  l: Math.min(97, Math.max(4, colour.l + dl)),
});

/**
 * Pulls a garment's colour into the catalogue's register.
 *
 * Saturation is cut and lightness is compressed towards the middle, so that
 * fifty photographs from fifty different wardrobes still read as one shop.
 * Fully saturated colour is what makes generated imagery look generated.
 */
function anchor(baseHex: string): Hsl {
  const raw = hexToHsl(baseHex);
  return {
    h: raw.h,
    s: Math.min(raw.s * 0.72, 52),
    l: Math.min(Math.max(raw.l * 0.86 + 6, 18), 70),
  };
}

// ── Composition ─────────────────────────────────────────────────────────────

/**
 * Draws one frame as SVG: a fall of cloth under a single light.
 *
 * The structure is a many-stop linear gradient whose stops alternate between
 * highlight ridges and shadow valleys at irregular intervals — that is what
 * produces folds. A second, coarser gradient crosses it to break the
 * regularity, and both are warped by one turbulence displacement so the fold
 * lines wander the way fabric does instead of running dead straight.
 *
 * The important constraint is that gradients are free and filters are not.
 * An earlier version of this file built the same idea out of blurred shapes and
 * took a hundred times longer to produce a considerably worse image: the blur
 * that made it look like cloth also destroyed every edge that made it read as
 * cloth. Almost all of the structure here comes from gradient stops, and
 * exactly one displacement filter does the organic work.
 */
function composeSvg(brief: PhotographyBrief, variant: number): string {
  const { width, height } = brief;
  const random = createRandom(`${brief.key}:${variant}`);
  const base = anchor(brief.baseHex);

  // The garment's own "hand" — how the cloth behaves — seeded from the key
  // alone, so all three frames of one piece share a character while two
  // different pieces do not. Without this every frame in the grid comes out at
  // the same fold frequency and fifty photographs read as one repeated texture.
  const cloth = createRandom(brief.key);
  const clothWeight = cloth(); // 0 = fine and pleated, 1 = heavy and broad
  const minBand = 2 + clothWeight * 9; // narrowest fold
  const bandSpread = 4 + clothWeight * 22; // variation between folds
  const contrast = 0.62 + cloth() * 0.85; // matte linen → lustrous satin

  // Fold bands. Irregular, alternating light and shade.
  const foldStops: string[] = [];
  let offset = 0;
  let band = 0;
  while (offset < 100) {
    const swing = (6 + random() * 18) * contrast;
    const tone = band % 2 === 0 ? at(base, swing, -6) : at(base, -swing * 0.9, 3);
    foldStops.push(
      `<stop offset="${Math.min(offset, 100).toFixed(2)}%" stop-color="${css(tone)}"/>`,
    );
    offset += minBand + random() * bandSpread;
    band += 1;
  }
  foldStops.push(`<stop offset="100%" stop-color="${css(at(base, -10))}"/>`);

  // A coarser pass at a different angle, in neutral light and shade.
  const crossStops: string[] = [];
  let cross = 0;
  let crossBand = 0;
  while (cross < 100) {
    crossStops.push(
      `<stop offset="${Math.min(cross, 100).toFixed(2)}%" stop-color="hsl(0 0% ${
        crossBand % 2 === 0 ? 100 : 0
      }% / ${(0.05 + random() * 0.09).toFixed(3)})"/>`,
    );
    cross += 14 + random() * 26;
    crossBand += 1;
  }

  // The drape's direction is a property of the garment; the crop is a property
  // of the frame. Varying both — rather than only the crop, as an earlier
  // version did — is what stops every cover image in the grid sharing an angle.
  const foldAngle = -34 + cloth() * 68;
  const zoom = (0.94 + cloth() * 0.5) * [1, 1.28, 1.62][variant % 3];
  const keyX = 20 + random() * 60;
  const keyY = 14 + random() * 48;

  // Displacement is expressed relative to the frame so that a wide editorial
  // band and a tall garment frame get the same visual amount of wander.
  const displacement = Math.round(Math.min(width, height) * 0.038);
  const bleedX = Math.round(width * 0.1);
  const bleedY = Math.round(height * 0.1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <linearGradient id="folds" x1="0" y1="0" x2="1" y2="0"
    gradientTransform="rotate(${foldAngle.toFixed(2)} 0.5 0.5)">
    ${foldStops.join("\n    ")}
  </linearGradient>
  <linearGradient id="cross" x1="0" y1="0" x2="0.6" y2="1">
    ${crossStops.join("\n    ")}
  </linearGradient>
  <radialGradient id="key" cx="${keyX.toFixed(1)}%" cy="${keyY.toFixed(1)}%" r="62%">
    <stop offset="0%" stop-color="hsl(${base.h.toFixed(0)} 30% 96% / 0.42)"/>
    <stop offset="60%" stop-color="hsl(${base.h.toFixed(0)} 30% 96% / 0.08)"/>
    <stop offset="100%" stop-color="hsl(${base.h.toFixed(0)} 30% 96% / 0)"/>
  </radialGradient>
  <radialGradient id="vignette" cx="50%" cy="44%" r="76%">
    <stop offset="52%" stop-color="hsl(0 0% 0% / 0)"/>
    <stop offset="100%" stop-color="hsl(0 0% 0% / 0.42)"/>
  </radialGradient>
  <filter id="warp" x="-6%" y="-6%" width="112%" height="112%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.0042" numOctaves="3"
      seed="${Math.floor(random() * 9999)}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${displacement}"
      xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="2.2"/>
  </filter>
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
</defs>

<rect width="${width}" height="${height}" fill="${css(at(base, -14))}"/>
<g transform="translate(${(width / 2).toFixed(0)} ${(height / 2).toFixed(0)}) scale(${zoom}) translate(${(-width / 2).toFixed(0)} ${(-height / 2).toFixed(0)})">
  <rect x="${-bleedX}" y="${-bleedY}" width="${width + bleedX * 2}" height="${height + bleedY * 2}"
    fill="url(#folds)" filter="url(#warp)"/>
  <rect x="${-bleedX}" y="${-bleedY}" width="${width + bleedX * 2}" height="${height + bleedY * 2}"
    fill="url(#cross)" filter="url(#warp)"/>
</g>
<rect width="${width}" height="${height}" fill="url(#key)"/>
<rect width="${width}" height="${height}" fill="url(#vignette)"/>
<rect width="${width}" height="${height}" filter="url(#grain)" opacity="0.055"/>
</svg>`;
}

// ── Output ──────────────────────────────────────────────────────────────────

async function renderFrame(brief: PhotographyBrief, variant: number): Promise<void> {
  await sharp(Buffer.from(composeSvg(brief, variant)))
    .webp({ quality: 82, effort: 4 })
    .toFile(path.join(OUTPUT_DIR, `${brief.key}-${variant + 1}.webp`));
}

/**
 * The tiny inline preview stored on `ClothingImage.blurDataUrl`.
 *
 * At 12px wide it costs well under a kilobyte — small enough to inline without
 * weighing down the document, and enough to stop the grid flashing empty while
 * images decode.
 */
export async function renderBlurPlaceholder(
  brief: PhotographyBrief,
  variant: number,
): Promise<string> {
  const buffer = await sharp(Buffer.from(composeSvg(brief, variant)))
    .resize(12, Math.max(1, Math.round((12 * brief.height) / brief.width)), { fit: "cover" })
    .webp({ quality: 55 })
    .toBuffer();
  return `data:image/webp;base64,${buffer.toString("base64")}`;
}

async function main(): Promise<void> {
  const started = Date.now();

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const frames = PHOTOGRAPHY_PLAN.flatMap((brief) =>
    Array.from({ length: brief.variants }, (_, variant) => ({ brief, variant })),
  );

  let done = 0;
  // Rasterisation is CPU-bound and largely fixed-cost per frame, so frames are
  // run in small concurrent batches rather than all at once — libvips exhausts
  // its worker pool if several hundred are queued together.
  const CONCURRENCY = 8;
  for (let index = 0; index < frames.length; index += CONCURRENCY) {
    await Promise.all(
      frames.slice(index, index + CONCURRENCY).map(async ({ brief, variant }) => {
        await renderFrame(brief, variant);
        done += 1;
      }),
    );
    process.stdout.write(`  ${done}/${frames.length} frames\r`);
  }

  await writeFile(
    path.join(OUTPUT_DIR, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: "deterministic",
        briefs: PHOTOGRAPHY_PLAN.length,
        frames: frames.length,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  process.stdout.write(
    `\n  ${frames.length} frames written to public/photography in ${seconds}s\n`,
  );
}

// Only run when invoked directly, so the blur helper can be imported by the seed.
if (process.argv[1]?.includes("generate-photography")) {
  main().catch((error) => {
    console.error("Photography generation failed:", error);
    process.exit(1);
  });
}
