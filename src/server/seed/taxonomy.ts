/**
 * The catalogue's vocabulary: what a garment can be, what it can be worn to,
 * and the sizes and colours the filter rail is built from.
 *
 * Kept as data rather than as enums because a marketplace's taxonomy grows —
 * new categories, new occasions, a colour nobody anticipated — and none of
 * that should require a migration.
 */

export interface SeedCategory {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly parent?: string;
  readonly sortOrder: number;
}

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  // Top-level groupings.
  {
    slug: "indian-wear",
    name: "Indian wear",
    tagline: "Woven, worked and worn for generations.",
    sortOrder: 10,
  },
  {
    slug: "occasion-wear",
    name: "Occasion wear",
    tagline: "For the nights that ask for something.",
    sortOrder: 20,
  },
  {
    slug: "tailoring",
    name: "Tailoring",
    tagline: "Structure, shoulders and a good lining.",
    sortOrder: 30,
  },
  {
    slug: "everyday",
    name: "Everyday",
    tagline: "The clothes between the occasions.",
    sortOrder: 40,
  },

  // Indian wear.
  {
    slug: "sarees",
    name: "Sarees",
    tagline: "Nine yards, and the drape is the whole argument.",
    parent: "indian-wear",
    sortOrder: 11,
  },
  {
    slug: "lehengas",
    name: "Lehengas",
    tagline: "Weight, work and a skirt with an opinion.",
    parent: "indian-wear",
    sortOrder: 12,
  },
  {
    slug: "kurtas",
    name: "Kurtas",
    tagline: "The most forgiving thing in anyone's cupboard.",
    parent: "indian-wear",
    sortOrder: 13,
  },
  {
    slug: "sherwanis",
    name: "Sherwanis",
    tagline: "For the one photograph everybody keeps.",
    parent: "indian-wear",
    sortOrder: 14,
  },
  {
    slug: "anarkalis",
    name: "Anarkalis",
    tagline: "Floor-length and built to move.",
    parent: "indian-wear",
    sortOrder: 15,
  },

  // Occasion wear.
  {
    slug: "gowns",
    name: "Gowns",
    tagline: "Long, deliberate, photographed from the stairs.",
    parent: "occasion-wear",
    sortOrder: 21,
  },
  {
    slug: "dresses",
    name: "Dresses",
    tagline: "One decision, whole outfit.",
    parent: "occasion-wear",
    sortOrder: 22,
  },
  {
    slug: "co-ords",
    name: "Co-ords",
    tagline: "Two pieces pretending to be one.",
    parent: "occasion-wear",
    sortOrder: 23,
  },

  // Tailoring.
  {
    slug: "blazers",
    name: "Blazers",
    tagline: "The fastest way to look like you meant it.",
    parent: "tailoring",
    sortOrder: 31,
  },
  {
    slug: "suits",
    name: "Suits",
    tagline: "Cut, cloth, and somewhere to be.",
    parent: "tailoring",
    sortOrder: 32,
  },
  {
    slug: "jackets",
    name: "Jackets",
    tagline: "Outerwear worth the cupboard space.",
    parent: "tailoring",
    sortOrder: 33,
  },

  // Everyday.
  {
    slug: "shirts",
    name: "Shirts",
    tagline: "Collar, cuff, quiet confidence.",
    parent: "everyday",
    sortOrder: 41,
  },
  {
    slug: "tops",
    name: "Tops",
    tagline: "The half of the outfit people actually see.",
    parent: "everyday",
    sortOrder: 42,
  },
  {
    slug: "skirts",
    name: "Skirts",
    tagline: "Length is a decision, not a default.",
    parent: "everyday",
    sortOrder: 43,
  },
  {
    slug: "trousers",
    name: "Trousers",
    tagline: "Where good tailoring shows first.",
    parent: "everyday",
    sortOrder: 44,
  },
];

export interface SeedOccasion {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly sortOrder: number;
}

export const SEED_OCCASIONS: readonly SeedOccasion[] = [
  {
    slug: "wedding",
    name: "Wedding",
    tagline: "Somebody else's big day, and you still have to look right.",
    sortOrder: 1,
  },
  {
    slug: "festive",
    name: "Festive",
    tagline: "Diwali, Eid, Puja, and the twelve dinners around them.",
    sortOrder: 2,
  },
  {
    slug: "party",
    name: "Party",
    tagline: "Loud rooms, late hours, good photographs.",
    sortOrder: 3,
  },
  { slug: "date-night", name: "Date night", tagline: "Dressed, but not dressed up.", sortOrder: 4 },
  { slug: "formal", name: "Formal", tagline: "When the invitation specifies.", sortOrder: 5 },
  {
    slug: "office",
    name: "Office",
    tagline: "The room you have to be taken seriously in.",
    sortOrder: 6,
  },
  {
    slug: "vacation",
    name: "Vacation",
    tagline: "Packed light, photographed heavily.",
    sortOrder: 7,
  },
  {
    slug: "traditional",
    name: "Traditional",
    tagline: "Handloom, heirloom, and the real thing.",
    sortOrder: 8,
  },
  { slug: "casual", name: "Casual", tagline: "Good clothes for ordinary days.", sortOrder: 9 },
];

export interface SeedBrand {
  readonly slug: string;
  readonly name: string;
  readonly isDesigner: boolean;
}

export const SEED_BRANDS: readonly SeedBrand[] = [
  { slug: "anavila", name: "Anavila", isDesigner: true },
  { slug: "raw-mango", name: "Raw Mango", isDesigner: true },
  { slug: "sabyasachi", name: "Sabyasachi", isDesigner: true },
  { slug: "ritu-kumar", name: "Ritu Kumar", isDesigner: true },
  { slug: "masaba", name: "Masaba", isDesigner: true },
  { slug: "anita-dongre", name: "Anita Dongre", isDesigner: true },
  { slug: "payal-singhal", name: "Payal Singhal", isDesigner: true },
  { slug: "torani", name: "Torani", isDesigner: true },
  { slug: "bodice", name: "Bodice", isDesigner: true },
  { slug: "pero", name: "Péro", isDesigner: true },
  { slug: "amit-aggarwal", name: "Amit Aggarwal", isDesigner: true },
  { slug: "gaurav-gupta-atelier", name: "Gaurav Gupta", isDesigner: true },
  { slug: "tarun-tahiliani", name: "Tarun Tahiliani", isDesigner: true },
  { slug: "antar-agni", name: "Antar-Agni", isDesigner: true },
  { slug: "suket-dhir", name: "Suket Dhir", isDesigner: true },
  { slug: "nikasha", name: "Nikasha", isDesigner: true },
  { slug: "good-earth", name: "Good Earth", isDesigner: false },
  { slug: "fabindia", name: "Fabindia", isDesigner: false },
  { slug: "kanjivaram-atelier", name: "Kanchipuram Weavers Co-op", isDesigner: false },
  { slug: "zara", name: "Zara", isDesigner: false },
  { slug: "mango", name: "Mango", isDesigner: false },
  { slug: "massimo-dutti", name: "Massimo Dutti", isDesigner: false },
  { slug: "cos", name: "COS", isDesigner: false },
  { slug: "self-portrait", name: "Self-Portrait", isDesigner: true },
  { slug: "reformation", name: "Reformation", isDesigner: false },
  { slug: "allsaints", name: "AllSaints", isDesigner: false },
  { slug: "theory", name: "Theory", isDesigner: false },
  { slug: "sandro", name: "Sandro", isDesigner: false },
  { slug: "unbranded", name: "Unlabelled", isDesigner: false },
];

export interface SeedSize {
  readonly slug: string;
  readonly label: string;
  readonly system: "ALPHA" | "NUMERIC_UK" | "NUMERIC_EU" | "NUMERIC_IN" | "FREE_SIZE";
  readonly sortOrder: number;
}

export const SEED_SIZES: readonly SeedSize[] = [
  { slug: "xs", label: "XS", system: "ALPHA", sortOrder: 10 },
  { slug: "s", label: "S", system: "ALPHA", sortOrder: 20 },
  { slug: "m", label: "M", system: "ALPHA", sortOrder: 30 },
  { slug: "l", label: "L", system: "ALPHA", sortOrder: 40 },
  { slug: "xl", label: "XL", system: "ALPHA", sortOrder: 50 },
  { slug: "xxl", label: "XXL", system: "ALPHA", sortOrder: 60 },
  { slug: "free-size", label: "Free size", system: "FREE_SIZE", sortOrder: 70 },
  { slug: "uk-38", label: "38", system: "NUMERIC_UK", sortOrder: 80 },
  { slug: "uk-40", label: "40", system: "NUMERIC_UK", sortOrder: 90 },
  { slug: "uk-42", label: "42", system: "NUMERIC_UK", sortOrder: 100 },
  { slug: "in-30", label: "30", system: "NUMERIC_IN", sortOrder: 110 },
  { slug: "in-32", label: "32", system: "NUMERIC_IN", sortOrder: 120 },
  { slug: "in-34", label: "34", system: "NUMERIC_IN", sortOrder: 130 },
];

export interface SeedColor {
  readonly slug: string;
  readonly name: string;
  readonly hex: string;
  readonly family: string;
}

export const SEED_COLORS: readonly SeedColor[] = [
  { slug: "ivory", name: "Ivory", hex: "#EAE0D0", family: "Neutral" },
  { slug: "champagne", name: "Champagne", hex: "#D8C7A8", family: "Neutral" },
  { slug: "sand", name: "Sand", hex: "#C6B394", family: "Neutral" },
  { slug: "black", name: "Black", hex: "#1B1A1D", family: "Black" },
  { slug: "charcoal", name: "Charcoal", hex: "#3A3A38", family: "Grey" },
  { slug: "silver-grey", name: "Silver grey", hex: "#B7B4AD", family: "Grey" },
  { slug: "claret", name: "Claret", hex: "#6E1F2E", family: "Red" },
  { slug: "crimson", name: "Crimson", hex: "#A3172B", family: "Red" },
  { slug: "rust", name: "Rust", hex: "#9C4A25", family: "Orange" },
  { slug: "terracotta", name: "Terracotta", hex: "#A85B3C", family: "Orange" },
  { slug: "saffron", name: "Saffron", hex: "#D08428", family: "Yellow" },
  { slug: "mustard", name: "Mustard", hex: "#BE8C1F", family: "Yellow" },
  { slug: "old-gold", name: "Old gold", hex: "#AE8C42", family: "Yellow" },
  { slug: "blush", name: "Blush", hex: "#DFBCBD", family: "Pink" },
  { slug: "rose", name: "Rose", hex: "#C0788A", family: "Pink" },
  { slug: "emerald", name: "Emerald", hex: "#1F5A45", family: "Green" },
  { slug: "bottle-green", name: "Bottle green", hex: "#254237", family: "Green" },
  { slug: "olive", name: "Olive", hex: "#5B5E3C", family: "Green" },
  { slug: "sage", name: "Sage", hex: "#9BA891", family: "Green" },
  { slug: "cobalt", name: "Cobalt", hex: "#2A4784", family: "Blue" },
  { slug: "indigo", name: "Indigo", hex: "#2C3552", family: "Blue" },
  { slug: "powder-blue", name: "Powder blue", hex: "#A6BCCF", family: "Blue" },
  { slug: "aubergine", name: "Aubergine", hex: "#4A2A44", family: "Purple" },
  { slug: "lilac", name: "Lilac", hex: "#B0A2C4", family: "Purple" },
  { slug: "coffee", name: "Coffee", hex: "#4A382C", family: "Brown" },
];
