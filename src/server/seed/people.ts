/**
 * The members whose wardrobes make up the seed marketplace.
 *
 * A two-sided marketplace with no people in it reads as a shop. These profiles
 * exist so the catalogue has owners with histories, ratings and locations — and
 * so "Ananya's wedding edit" is a real wardrobe rather than a label on a grid.
 */

export interface SeedPerson {
  readonly handle: string;
  readonly name: string;
  readonly email: string;
  readonly city: string;
  readonly state: string;
  readonly bio: string;
  /** Months before the seed date that this member joined. */
  readonly joinedMonthsAgo: number;
  readonly isIdentityVerified: boolean;
  readonly ratingAvgBps: number;
  readonly ratingCount: number;
  readonly rentalsHosted: number;
  readonly rentalsTaken: number;
  readonly responseRateBps: number;
  readonly responseMins: number;
  /** Hue used to generate this member's avatar, keeping the set coherent. */
  readonly avatarHue: number;
  readonly role?: "MEMBER" | "MODERATOR" | "ADMIN";
}

/**
 * Every seeded account uses this password. It is deliberately obvious, and the
 * seed refuses to run in production, so it can never reach a real deployment.
 */
export const SEED_PASSWORD = "almirah-demo-2026";

export const SEED_PEOPLE: readonly SeedPerson[] = [
  {
    handle: "ananya-desai",
    name: "Ananya Desai",
    email: "ananya@almirah.example",
    city: "Mumbai",
    state: "Maharashtra",
    bio: "Costume assistant turned stylist. Most of what I own has been to a wedding it wasn't invited to.",
    joinedMonthsAgo: 26,
    isIdentityVerified: true,
    ratingAvgBps: 49000,
    ratingCount: 37,
    rentalsHosted: 41,
    rentalsTaken: 9,
    responseRateBps: 9800,
    responseMins: 42,
    avatarHue: 348,
  },
  {
    handle: "rohan-mehta",
    name: "Rohan Mehta",
    email: "rohan@almirah.example",
    city: "Bengaluru",
    state: "Karnataka",
    bio: "I buy one good jacket a year and wear it into the ground. Happy to share the ones that survived.",
    joinedMonthsAgo: 19,
    isIdentityVerified: true,
    ratingAvgBps: 48000,
    ratingCount: 22,
    rentalsHosted: 24,
    rentalsTaken: 14,
    responseRateBps: 9400,
    responseMins: 95,
    avatarHue: 28,
  },
  {
    handle: "meher-kapadia",
    name: "Meher Kapadia",
    email: "meher@almirah.example",
    city: "Vadodara",
    state: "Gujarat",
    bio: "Three generations of saris in one cupboard. My grandmother would rather they were worn than folded.",
    joinedMonthsAgo: 33,
    isIdentityVerified: true,
    ratingAvgBps: 50000,
    ratingCount: 48,
    rentalsHosted: 53,
    rentalsTaken: 4,
    responseRateBps: 10000,
    responseMins: 20,
    avatarHue: 12,
  },
  {
    handle: "kabir-sharma",
    name: "Kabir Sharma",
    email: "kabir@almirah.example",
    city: "New Delhi",
    state: "Delhi",
    bio: "Architect. Owns more black than is reasonable. Ask me about the sherwani — it has stories.",
    joinedMonthsAgo: 15,
    isIdentityVerified: true,
    ratingAvgBps: 47000,
    ratingCount: 17,
    rentalsHosted: 19,
    rentalsTaken: 21,
    responseRateBps: 8900,
    responseMins: 180,
    avatarHue: 210,
  },
  {
    handle: "priya-raghunathan",
    name: "Priya Raghunathan",
    email: "priya@almirah.example",
    city: "Chennai",
    state: "Tamil Nadu",
    bio: "Kanjivarams from home, everything else from a very long career in advertising.",
    joinedMonthsAgo: 28,
    isIdentityVerified: true,
    ratingAvgBps: 49500,
    ratingCount: 31,
    rentalsHosted: 35,
    rentalsTaken: 7,
    responseRateBps: 9700,
    responseMins: 55,
    avatarHue: 152,
  },
  {
    handle: "zoya-qureshi",
    name: "Zoya Qureshi",
    email: "zoya@almirah.example",
    city: "Hyderabad",
    state: "Telangana",
    bio: "Wedding season is a full contact sport here. These have all survived at least one.",
    joinedMonthsAgo: 11,
    isIdentityVerified: true,
    ratingAvgBps: 48500,
    ratingCount: 14,
    rentalsHosted: 16,
    rentalsTaken: 18,
    responseRateBps: 9200,
    responseMins: 70,
    avatarHue: 268,
  },
  {
    handle: "nikhil-reddy",
    name: "Nikhil Reddy",
    email: "nikhil@almirah.example",
    city: "Pune",
    state: "Maharashtra",
    bio: "Two suits, one tuxedo, and a blazer I regret buying but which looks excellent on other people.",
    joinedMonthsAgo: 9,
    isIdentityVerified: false,
    ratingAvgBps: 46000,
    ratingCount: 8,
    rentalsHosted: 9,
    rentalsTaken: 11,
    responseRateBps: 8600,
    responseMins: 240,
    avatarHue: 195,
  },
  {
    handle: "devika-sen",
    name: "Devika Sen",
    email: "devika@almirah.example",
    city: "Kolkata",
    state: "West Bengal",
    bio: "Handloom, mostly. If it isn't woven by somebody I can name, it doesn't come home with me.",
    joinedMonthsAgo: 22,
    isIdentityVerified: true,
    ratingAvgBps: 49200,
    ratingCount: 26,
    rentalsHosted: 29,
    rentalsTaken: 6,
    responseRateBps: 9600,
    responseMins: 38,
    avatarHue: 88,
  },
  {
    handle: "tara-menon",
    name: "Tara Menon",
    email: "tara@almirah.example",
    city: "Kochi",
    state: "Kerala",
    bio: "Rents out the party half of the wardrobe so the everyday half can stay boring.",
    joinedMonthsAgo: 14,
    isIdentityVerified: true,
    ratingAvgBps: 47500,
    ratingCount: 19,
    rentalsHosted: 21,
    rentalsTaken: 25,
    responseRateBps: 9100,
    responseMins: 110,
    avatarHue: 320,
  },
  {
    handle: "arjun-malhotra",
    name: "Arjun Malhotra",
    email: "arjun@almirah.example",
    city: "Chandigarh",
    state: "Punjab",
    bio: "Bought most of this for one cousin's wedding in 2023. It deserves a better run than that.",
    joinedMonthsAgo: 7,
    isIdentityVerified: false,
    ratingAvgBps: 45000,
    ratingCount: 6,
    rentalsHosted: 7,
    rentalsTaken: 9,
    responseRateBps: 8200,
    responseMins: 300,
    avatarHue: 42,
  },
  {
    handle: "sana-kulkarni",
    name: "Sana Kulkarni",
    email: "sana@almirah.example",
    city: "Ahmedabad",
    state: "Gujarat",
    bio: "Textile designer. Everything here has been altered at least once and is better for it.",
    joinedMonthsAgo: 20,
    isIdentityVerified: true,
    ratingAvgBps: 48800,
    ratingCount: 24,
    rentalsHosted: 27,
    rentalsTaken: 12,
    responseRateBps: 9500,
    responseMins: 48,
    avatarHue: 178,
  },
  {
    handle: "rhea-dsouza",
    name: "Rhea D'Souza",
    email: "rhea@almirah.example",
    city: "Mumbai",
    state: "Maharashtra",
    bio: "Renting out the going-out clothes. I work from home now and they were getting resentful.",
    joinedMonthsAgo: 5,
    isIdentityVerified: true,
    ratingAvgBps: 47800,
    ratingCount: 11,
    rentalsHosted: 12,
    rentalsTaken: 16,
    responseRateBps: 9300,
    responseMins: 65,
    avatarHue: 300,
  },
  {
    handle: "ishaan-nair",
    name: "Ishaan Nair",
    email: "ishaan@almirah.example",
    city: "Bengaluru",
    state: "Karnataka",
    bio: "Renter, mostly. I've stopped buying things for single occasions.",
    joinedMonthsAgo: 8,
    isIdentityVerified: true,
    ratingAvgBps: 49000,
    ratingCount: 13,
    rentalsHosted: 0,
    rentalsTaken: 22,
    responseRateBps: 9000,
    responseMins: 90,
    avatarHue: 220,
  },
  {
    handle: "anjali-verma",
    name: "Anjali Verma",
    email: "anjali@almirah.example",
    city: "Jaipur",
    state: "Rajasthan",
    bio: "New here. Renting for a season of weddings I did not plan for.",
    joinedMonthsAgo: 2,
    isIdentityVerified: false,
    ratingAvgBps: 50000,
    ratingCount: 3,
    rentalsHosted: 0,
    rentalsTaken: 4,
    responseRateBps: 8800,
    responseMins: 130,
    avatarHue: 8,
  },
  {
    handle: "almirah-studio",
    name: "Nandini Bose",
    email: "nandini@almirah.example",
    city: "Mumbai",
    state: "Maharashtra",
    bio: "Wardrobe standards and member support at Almirah.",
    joinedMonthsAgo: 36,
    isIdentityVerified: true,
    ratingAvgBps: 0,
    ratingCount: 0,
    rentalsHosted: 0,
    rentalsTaken: 0,
    responseRateBps: 10000,
    responseMins: 15,
    avatarHue: 340,
    role: "ADMIN",
  },
] as const;

export const ADMIN_HANDLE = "almirah-studio";

/** Members whose wardrobes are featured on the homepage, in order. */
export const FEATURED_WARDROBES: ReadonlyArray<{
  handle: string;
  title: string;
  standfirst: string;
}> = [
  {
    handle: "meher-kapadia",
    title: "Meher's inherited saris",
    standfirst:
      "Three generations of Gujarati weaving, kept in cotton and worn far more often than they are photographed.",
  },
  {
    handle: "ananya-desai",
    title: "Ananya's wedding edit",
    standfirst:
      "What a stylist actually reaches for when the invitation says black tie optional and the venue is a Rajasthani courtyard.",
  },
  {
    handle: "rohan-mehta",
    title: "Rohan's weekend wardrobe",
    standfirst: "Four jackets, one very good knit, and nothing that needs ironing.",
  },
];
