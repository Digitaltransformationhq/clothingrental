/**
 * Legal documents.
 *
 * Written in the same voice as the rest of the site. Every one opens with a
 * plain summary of what it actually means, because a member agreeing to terms
 * they cannot read has not meaningfully agreed to anything — and in a
 * peer-to-peer marketplace, the terms decide who pays when a dress comes back
 * torn.
 *
 * These are drafted to be honest and readable rather than to be exhaustive. A
 * real deployment should have them reviewed by a lawyer qualified in the
 * relevant jurisdiction before launch; the figures and mechanics in them do
 * match what the application actually does.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface LegalDocument {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
}

const documents = {
  terms: {
    eyebrow: "Legal",
    title: "Terms of use",
    summary:
      "Almirah is a marketplace. We connect the person who owns a garment with the person renting it, hold the money in between, and step in when something goes wrong. We do not own the clothes.",
    updated: "1 September 2026",
    sections: [
      {
        heading: "What Almirah is",
        paragraphs: [
          "Almirah operates a platform on which members list their own clothing for rent and other members rent it. Each rental is an agreement between those two members. We are not a party to it, and we do not own, inspect or store any of the garments listed.",
          "What we do provide is the mechanism: identity verification, the availability and pricing system, payment processing, the holding of security deposits, and a dispute process when the two members cannot agree.",
        ],
      },
      {
        heading: "Who may use it",
        paragraphs: [
          "You must be at least 18 and legally able to enter a contract. One account per person. You are responsible for what happens under your account, which is why we ask you not to share your password and why signing out everywhere exists in your settings.",
        ],
      },
      {
        heading: "Listing a garment",
        paragraphs: [
          "You may only list clothing you own outright. Your listing must describe the piece accurately, including any flaw, and the photographs must be of the actual garment rather than of the same item modelled elsewhere.",
          "Every listing is reviewed before it appears. We may decline or remove a listing that is inaccurate, that infringes somebody else's rights, or that we judge unsafe to rent.",
        ],
      },
      {
        heading: "Renting a garment",
        paragraphs: [
          "When you book, you agree to return the piece by the return date, in the condition it arrived in, allowing for ordinary wear. You may not alter it, dye it, or have it cleaned anywhere other than as its owner instructs.",
          "The rental agreement sets out what happens if it comes back late, damaged, or not at all.",
        ],
      },
      {
        heading: "Fees",
        paragraphs: [
          "Renters pay the rental, a service fee, delivery where applicable, GST, and a refundable deposit. Owners are paid the rental less a 15% commission. Every figure is shown before payment.",
        ],
      },
      {
        heading: "Ending your account",
        paragraphs: [
          "You may close your account at any time, provided no rental is in progress. We may suspend an account that breaks these terms, and will tell you why. Suspension takes effect immediately and takes any live listings down with it.",
        ],
      },
      {
        heading: "Our liability",
        paragraphs: [
          "We are responsible for operating the platform properly and for handling money and deposits as described. We are not responsible for the condition, fit, authenticity or safety of a garment listed by a member, nor for what happens while it is in somebody's possession.",
          "Nothing here limits liability that cannot be limited by law.",
        ],
      },
    ],
  },

  privacy: {
    eyebrow: "Legal",
    title: "Privacy",
    summary:
      "We collect what is needed to run a rental marketplace and nothing beyond it. We never sell your data. Your address is shown to an owner only after a booking is confirmed, and only until it is returned.",
    updated: "1 September 2026",
    sections: [
      {
        heading: "What we hold",
        paragraphs: ["The data Almirah stores about you falls into five groups."],
        list: [
          "Account: your name, email address and password, stored as a salted scrypt hash that cannot be reversed.",
          "Profile: your handle, city and anything you write about yourself. This is public.",
          "Addresses: where rentals are delivered. Private, and shared only as described below.",
          "Rentals: what you rented or lent, when, and for how much. Retained as long as tax law requires.",
          "Payments: the last four digits of a payout account and the payment provider's reference. Card numbers never reach our servers.",
        ],
      },
      {
        heading: "Who sees your address",
        paragraphs: [
          "An owner sees a delivery address only after they have accepted the booking it belongs to, and only until the piece is returned. Before that, and after it, they see your name and city.",
          "Nobody else sees it, and we do not use it for anything other than getting a garment to you and back.",
        ],
      },
      {
        heading: "Photographs",
        paragraphs: [
          "Every image uploaded to Almirah is re-encoded on our servers, which strips its metadata. Phone photographs routinely carry the GPS coordinates of where they were taken, and a listing photographed at home should not publish somebody's address.",
        ],
      },
      {
        heading: "What we never do",
        paragraphs: [],
        list: [
          "We do not sell personal data.",
          "We do not share it with advertisers.",
          "We do not use your messages for anything except delivering them and investigating a report.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can see and correct most of what we hold from your account settings. You can ask for a copy of everything, or for your account and data to be deleted, and we will do it within 30 days — except for records we are legally required to keep, such as completed transactions.",
        ],
      },
    ],
  },

  "rental-agreement": {
    eyebrow: "Legal",
    title: "Rental agreement",
    summary:
      "The agreement between the two members in a rental. In short: return it on time, in the state it arrived, and your deposit comes back in full. Ordinary wear is expected and never charged for.",
    updated: "1 September 2026",
    sections: [
      {
        heading: "The rental period",
        paragraphs: [
          "The period runs from the start date to the return date shown on your booking. The garment must be sent back, or handed back, on the return date. Turnaround days after that are the owner's, for cleaning and inspection, and are already blocked in the calendar.",
        ],
      },
      {
        heading: "Condition on return",
        paragraphs: [
          "Return the piece as it arrived. Do not have it cleaned unless the owner has asked you to; specialist garments are frequently damaged by ordinary dry cleaning.",
        ],
      },
      {
        heading: "What is ordinary wear",
        paragraphs: [
          "Clothes that are worn show it, and that is the arrangement. None of the following is ever charged for:",
        ],
        list: [
          "A loose thread or a small pull in a knit.",
          "A faint mark that comes out in normal cleaning.",
          "A stretched hook, a loosened button, a worn heel tip.",
          "Creasing, or a hem that needs pressing.",
        ],
      },
      {
        heading: "What is damage",
        paragraphs: ["These may be charged against the deposit:"],
        list: [
          "A tear, a burn, or a hole.",
          "A stain that survives professional cleaning.",
          "Lost or broken embellishment — beading, sequins, mirrors, buttons.",
          "Alteration of any kind without the owner's written agreement.",
          "Non-return, or return so late that another booking is lost.",
        ],
      },
      {
        heading: "How a claim works",
        paragraphs: [
          "The owner reports damage with photographs within 48 hours of the piece being returned. You are told immediately and may respond with your own account and photographs. Almirah decides, states the reason to both of you, and releases or deducts from the deposit accordingly.",
          "A deduction never exceeds the deposit, and never exceeds the cost of repair or the garment's residual value, whichever is lower. If you disagree with the decision you may escalate it, and a second person will review it.",
        ],
      },
      {
        heading: "Late return",
        paragraphs: [
          "A late return is charged at the listing's extra-day rate for each day, taken from the deposit. If the delay costs the owner a confirmed booking, the deposit may also cover that rental.",
        ],
      },
    ],
  },

  cancellation: {
    eyebrow: "Legal",
    title: "Cancellations",
    summary:
      "Cancel more than seven days ahead and everything comes back. Inside a week, half the rental is returned along with your full deposit. If the owner cancels, you are refunded in full, whenever it happens.",
    updated: "1 September 2026",
    sections: [
      {
        heading: "If you cancel",
        paragraphs: [
          "More than seven days before the start date: the rental, the service fee, delivery and the deposit are all refunded in full.",
          "Seven days or fewer: half the rental is refunded, along with the full deposit and any delivery charge. The service fee is retained, because the work it pays for — verification, payment handling, support — has already been done.",
          "After the rental has started: the rental is not refunded. Your deposit is still returned in full once the piece is back.",
        ],
      },
      {
        heading: "If the owner cancels",
        paragraphs: [
          "You are refunded everything you paid, immediately, however close to the date it happens. We will also try to find you something comparable in time, and where we can, we will cover the difference in price.",
          "Owners who cancel confirmed bookings repeatedly are removed from the marketplace. A cancellation two days before a wedding is not a minor inconvenience.",
        ],
      },
      {
        heading: "If a piece is not as described",
        paragraphs: [
          "Tell us within 24 hours of it arriving, with photographs. If a garment is materially different from its listing — the wrong size, damaged on arrival, not the piece photographed — the rental is refunded in full and the listing is reviewed.",
        ],
      },
      {
        heading: "How refunds reach you",
        paragraphs: [
          "Refunds go back to the card or account you paid from. Most arrive within three working days; some banks take up to seven. Deposits are released within three days of a clean return, separately from any rental refund.",
        ],
      },
    ],
  },
} satisfies Record<string, LegalDocument>;

export type LegalSlug = keyof typeof documents;

/**
 * Re-exported through the interface rather than as the literal object.
 * `satisfies` alone would narrow each section to its own exact shape, which
 * quietly removes the optional `list` from every section that does not use one
 * — and then reading `section.list` is a type error at the one place it is
 * needed.
 */
export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDocument> = documents;
