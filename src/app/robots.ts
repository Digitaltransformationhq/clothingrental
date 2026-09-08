import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * robots.txt
 *
 * Everything private or thin is disallowed rather than merely un-indexed:
 * the account area, checkout, the administration tool, search results and
 * shared wishlist links. Crawling them would cost budget that belongs to the
 * catalogue, and in the case of a wishlist token it would publish something
 * meant to be shared privately.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account/",
          "/checkout/",
          "/admin/",
          "/api/",
          "/auth/",
          "/search",
          "/wishlist/",
          "/sell/new",
          "/sell/submitted",
          "/progress",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
