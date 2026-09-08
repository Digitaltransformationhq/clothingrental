import { redirect } from "next/navigation";

/**
 * The account root opens on rentals: it is the thing most members come here
 * for, and a landing page of links to five other pages is a page nobody wants.
 */
export default function AccountPage() {
  redirect("/account/rentals");
}
